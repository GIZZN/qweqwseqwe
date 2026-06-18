//! Push-to-talk audio recorder.
//! Records WASAPI loopback audio while held, stops on release, transcribes.

use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

#[derive(Default)]
struct RecorderState {
    is_recording: bool,
    samples: Vec<f32>,
    sample_rate: u32,
}

static RECORDER: Lazy<Arc<Mutex<RecorderState>>> =
    Lazy::new(|| Arc::new(Mutex::new(RecorderState::default())));

/// Cached tiny model for fast PTT transcription
#[cfg(feature = "transcription")]
static PTT_TRANSCRIBER: Lazy<Mutex<Option<Arc<crate::audio_transcriber::SystemAudioTranscriber>>>> =
    Lazy::new(|| Mutex::new(None));

/// Inject a pre-warmed transcriber from app startup so the first PTT call
/// doesn't pay the model-load cost.
#[cfg(feature = "transcription")]
pub fn set_prewarmed_transcriber(t: Arc<crate::audio_transcriber::SystemAudioTranscriber>) {
    let mut cache = PTT_TRANSCRIBER.lock().unwrap();
    if cache.is_none() {
        *cache = Some(t);
    }
}

/// Start recording system audio into buffer
#[tauri::command]
pub async fn recorder_start() -> Result<(), String> {
    {
        let mut state = RECORDER.lock().unwrap();
        if state.is_recording {
            return Ok(()); // Already recording
        }
        state.is_recording = true;
        state.samples.clear();
        state.sample_rate = 48000;
    }

    let recorder = RECORDER.clone();

    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            record_wasapi_loopback(recorder);
        }
    });

    Ok(())
}

/// Stop recording and return transcription
#[tauri::command]
pub async fn recorder_stop_and_transcribe() -> Result<String, String> {
    // Signal stop
    {
        let mut state = RECORDER.lock().unwrap();
        state.is_recording = false;
    }

    // Wait briefly for recording thread to drain remaining packets.
    // 30ms is enough since the capture loop polls every 10ms.
    tokio::time::sleep(tokio::time::Duration::from_millis(30)).await;

    let (samples, sample_rate) = {
        let state = RECORDER.lock().unwrap();
        (state.samples.clone(), state.sample_rate)
    };

    if samples.is_empty() {
        return Err("No audio captured".to_string());
    }

    let duration_secs = samples.len() as f32 / sample_rate as f32;
    println!("[Recorder] Captured {:.1}s of audio", duration_secs);

    // Transcribe using cached whisper
    #[cfg(feature = "transcription")]
    {
        use crate::audio_transcriber::SystemAudioTranscriber;
        use whisper_rs::{FullParams, SamplingStrategy};

        // Use PTT-specific transcriber (prefers tiny model for speed)
        let transcriber = {
            let mut cache = PTT_TRANSCRIBER.lock().unwrap();
            if cache.is_none() {
                println!("[Recorder] Loading Whisper for PTT...");
                // Try tiny first (fastest), then fall back to whatever is available
                let models_dir = std::env::current_dir().unwrap_or_default().join("models");
                let tiny_path = models_dir.join("ggml-tiny.bin");
                let small_path = models_dir.join("ggml-small.bin");
                let base_path = models_dir.join("ggml-base.bin");
                
                let model_path = if tiny_path.exists() { tiny_path }
                    else if base_path.exists() { base_path }
                    else { small_path };
                
                println!("[Recorder] Using model: {:?}", model_path);
                match SystemAudioTranscriber::new_with_path(&model_path) {
                    Ok(t) => { *cache = Some(std::sync::Arc::new(t)); }
                    Err(e) => return Err(format!("Whisper init failed: {}", e)),
                }
            }
            cache.as_ref().unwrap().clone()
        };

        tokio::task::spawn_blocking(move || {
            // Resample to 16kHz if needed
            let audio_16k = if sample_rate != 16000 {
                resample(&samples, sample_rate, 16000)
            } else {
                samples
            };

            // Limit to last 30 seconds max to keep inference fast
            let max_samples = 16000 * 30;
            let audio_16k = if audio_16k.len() > max_samples {
                audio_16k[audio_16k.len() - max_samples..].to_vec()
            } else {
                audio_16k
            };

            println!("[Recorder] Transcribing {:.1}s...", audio_16k.len() as f32 / 16000.0);

            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
            params.set_language(Some("ru"));
            // Use physical cores only — hyperthreading hurts Whisper throughput.
            let threads = num_cpus::get_physical().max(1) as i32;
            params.set_n_threads(threads);
            params.set_print_special(false);
            params.set_print_progress(false);
            params.set_print_realtime(false);
            params.set_print_timestamps(false);
            params.set_no_context(true);
            params.set_single_segment(true);
            params.set_translate(false);
            // Skip silence/non-speech segments and a few extra speed knobs.
            params.set_suppress_blank(true);
            params.set_temperature(0.0);
            // Disable temperature fallback (otherwise whisper may re-run inference
            // multiple times when confidence is low). Big speedup for short clips.
            params.set_temperature_inc(0.0);

            let mut state = transcriber.ctx.create_state()
                .map_err(|e| format!("State error: {:?}", e))?;

            let t_infer = std::time::Instant::now();
            state.full(params, &audio_16k)
                .map_err(|e| format!("Transcription failed: {:?}", e))?;
            let infer_ms = t_infer.elapsed().as_millis();

            // Timing diagnostics — appended to a file so they're visible in the
            // no-console release build. Compare dev vs prod to locate the slowdown.
            let audio_secs = audio_16k.len() as f32 / 16000.0;
            let diag = format!(
                "build={} threads={} physical={} logical={} audio_s={:.2} infer_ms={} rtf={:.2}\nsysinfo: {}\n",
                if cfg!(debug_assertions) { "debug" } else { "release" },
                threads,
                num_cpus::get_physical(),
                num_cpus::get(),
                audio_secs,
                infer_ms,
                infer_ms as f32 / (audio_secs * 1000.0).max(1.0),
                whisper_rs::print_system_info(),
            );
            println!("[Recorder][timing] {}", diag.trim());
            let _ = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(std::env::temp_dir().join("whisper_ptt_timing.log"))
                .and_then(|mut f| {
                    use std::io::Write;
                    f.write_all(diag.as_bytes())
                });

            let num_segments = state.full_n_segments();
            let mut text = String::new();
            for i in 0..num_segments {
                if let Some(seg) = state.get_segment(i) {
                    if !text.is_empty() { text.push(' '); }
                    text.push_str(&format!("{}", seg));
                }
            }

            let result = text.trim().to_string();
            println!("[Recorder] Done: \"{}\"", result.chars().take(80).collect::<String>());
            Ok(result)
        })
        .await
        .map_err(|e| format!("Task failed: {}", e))?
    }

    #[cfg(not(feature = "transcription"))]
    Err("Transcription not enabled".to_string())
}

fn resample(samples: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
    let ratio = target_rate as f64 / source_rate as f64;
    let output_len = (samples.len() as f64 * ratio) as usize;
    let mut output = Vec::with_capacity(output_len);
    for i in 0..output_len {
        let src_idx = i as f64 / ratio;
        let idx = src_idx as usize;
        let frac = src_idx - idx as f64;
        if idx + 1 < samples.len() {
            output.push(samples[idx] * (1.0 - frac as f32) + samples[idx + 1] * frac as f32);
        } else if idx < samples.len() {
            output.push(samples[idx]);
        }
    }
    output
}

#[cfg(target_os = "windows")]
fn record_wasapi_loopback(recorder: Arc<Mutex<RecorderState>>) {
    use std::ptr;
    use winapi::um::combaseapi::{CoInitializeEx, CoCreateInstance, CoUninitialize, CLSCTX_ALL};
    use winapi::um::objbase::COINIT_MULTITHREADED;
    use winapi::um::mmdeviceapi::{IMMDeviceEnumerator, IMMDevice, eRender, eConsole};
    use winapi::um::audioclient::{IID_IAudioClient, IAudioClient, IID_IAudioCaptureClient, IAudioCaptureClient};
    use winapi::shared::winerror::S_OK;
    use winapi::shared::guiddef::GUID;

    const AUDCLNT_STREAMFLAGS_LOOPBACK: u32 = 0x00020000;
    const REFTIMES_PER_SEC: i64 = 10_000_000;

    unsafe {
        let hr = CoInitializeEx(ptr::null_mut(), COINIT_MULTITHREADED);
        if hr != S_OK && hr != 1 { return; }

        let clsid = GUID { Data1: 0xBCDE0395, Data2: 0xE52F, Data3: 0x467C, Data4: [0x8E,0x3D,0xC4,0x57,0x92,0x91,0x69,0x2E] };
        let iid = GUID { Data1: 0xA95664D2, Data2: 0x9614, Data3: 0x4F35, Data4: [0xA7,0x46,0xDE,0x8D,0xB6,0x36,0x17,0xE6] };

        let mut enumerator: *mut IMMDeviceEnumerator = ptr::null_mut();
        if CoCreateInstance(&clsid, ptr::null_mut(), CLSCTX_ALL, &iid, &mut enumerator as *mut _ as *mut _) != S_OK { CoUninitialize(); return; }

        let mut device: *mut IMMDevice = ptr::null_mut();
        if (*enumerator).GetDefaultAudioEndpoint(eRender, eConsole, &mut device) != S_OK { (*enumerator).Release(); CoUninitialize(); return; }

        let mut audio_client: *mut IAudioClient = ptr::null_mut();
        if (*device).Activate(&IID_IAudioClient as *const _ as *const _, CLSCTX_ALL, ptr::null_mut(), &mut audio_client as *mut _ as *mut _) != S_OK { (*device).Release(); (*enumerator).Release(); CoUninitialize(); return; }

        let mut mix_format = ptr::null_mut();
        if (*audio_client).GetMixFormat(&mut mix_format) != S_OK { (*audio_client).Release(); (*device).Release(); (*enumerator).Release(); CoUninitialize(); return; }

        let sample_rate = (*mix_format).nSamplesPerSec;
        let channels = (*mix_format).nChannels as usize;
        let bits = (*mix_format).wBitsPerSample;

        {
            let mut state = recorder.lock().unwrap();
            state.sample_rate = sample_rate;
        }

        if (*audio_client).Initialize(winapi::um::audiosessiontypes::AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, REFTIMES_PER_SEC, 0, mix_format, ptr::null()) != S_OK {
            (*audio_client).Release(); (*device).Release(); (*enumerator).Release(); CoUninitialize(); return;
        }

        let mut capture_client: *mut IAudioCaptureClient = ptr::null_mut();
        if (*audio_client).GetService(&IID_IAudioCaptureClient as *const _ as *const _, &mut capture_client as *mut _ as *mut _) != S_OK {
            (*audio_client).Release(); (*device).Release(); (*enumerator).Release(); CoUninitialize(); return;
        }

        (*audio_client).Start();
        println!("[Recorder] WASAPI loopback recording started");

        loop {
            {
                let state = recorder.lock().unwrap();
                if !state.is_recording { break; }
            }

            std::thread::sleep(std::time::Duration::from_millis(10));

            let mut packet_length: u32 = 0;
            if (*capture_client).GetNextPacketSize(&mut packet_length) != S_OK { continue; }

            while packet_length > 0 {
                let mut data: *mut u8 = ptr::null_mut();
                let mut frames: u32 = 0;
                let mut flags: u32 = 0;

                if (*capture_client).GetBuffer(&mut data, &mut frames, &mut flags, ptr::null_mut(), ptr::null_mut()) != S_OK { break; }

                if frames > 0 && !data.is_null() {
                    let is_float = bits == 32;
                    let mut new_samples = Vec::with_capacity(frames as usize);

                    for frame_idx in 0..frames as usize {
                        let mut mono: f32 = 0.0;
                        for ch in 0..channels {
                            let offset = (frame_idx * channels + ch) * (bits as usize / 8);
                            let ptr = data.add(offset);
                            let s: f32 = if is_float { *(ptr as *const f32) } else { *(ptr as *const i16) as f32 / 32768.0 };
                            mono += s;
                        }
                        new_samples.push(mono / channels as f32);
                    }

                    let mut state = recorder.lock().unwrap();
                    state.samples.extend_from_slice(&new_samples);
                }

                (*capture_client).ReleaseBuffer(frames);
                if (*capture_client).GetNextPacketSize(&mut packet_length) != S_OK { break; }
            }
        }

        (*audio_client).Stop();
        (*capture_client).Release();
        (*audio_client).Release();
        (*device).Release();
        (*enumerator).Release();
        CoUninitialize();
        println!("[Recorder] Recording stopped");
    }
}
