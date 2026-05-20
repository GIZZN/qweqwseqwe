//! System Audio Transcriber with WASAPI Loopback
//! Captures system audio output (what plays in speakers) using Windows WASAPI loopback.
//! This is how you capture the interviewer's voice from Zoom/Teams/Discord calls.

use crate::audio_config::AUDIO_TRANSCRIBER_CONFIG;
use anyhow::{anyhow, Context, Result};
use std::time::Duration;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

#[allow(unused_imports)]
use std::time::Instant;

pub struct SystemAudioTranscriber {
    pub ctx: WhisperContext,
}

// WhisperContext is safe to send between threads as we use it sequentially
unsafe impl Send for SystemAudioTranscriber {}
unsafe impl Sync for SystemAudioTranscriber {}

impl SystemAudioTranscriber {
    pub fn new() -> Result<Self> {
        let cfg = &*AUDIO_TRANSCRIBER_CONFIG;
        if !cfg.model_path.exists() {
            return Err(anyhow!(
                "Whisper model not found at {:?}",
                cfg.model_path
            ));
        }
        let params = WhisperContextParameters::default();
        let ctx = WhisperContext::new_with_params(
            &cfg.model_path.to_string_lossy(),
            params,
        )
        .context("Failed to load whisper model")?;
        Ok(Self { ctx })
    }

    pub fn new_with_path(model_path: &std::path::Path) -> Result<Self> {
        if !model_path.exists() {
            return Err(anyhow!("Whisper model not found at {:?}", model_path));
        }
        let params = WhisperContextParameters::default();
        let ctx = WhisperContext::new_with_params(
            &model_path.to_string_lossy(),
            params,
        )
        .context("Failed to load whisper model")?;
        Ok(Self { ctx })
    }
    /// Capture system audio via WASAPI loopback and transcribe.
    pub fn capture_and_transcribe(&self) -> Result<String> {
        let cfg = &*AUDIO_TRANSCRIBER_CONFIG;
        
        println!("[AudioTranscriber] 🎧 Starting WASAPI loopback capture ({} sec)...", cfg.capture_seconds);
        
        // Run capture in a dedicated thread to avoid COM threading conflicts
        let seconds = cfg.capture_seconds;
        let audio_16k = std::thread::spawn(move || {
            Self::capture_wasapi_loopback_static(seconds)
        })
        .join()
        .map_err(|_| anyhow!("Capture thread panicked"))??;
        
        if audio_16k.is_empty() {
            return Err(anyhow!("No audio captured - is any sound playing?"));
        }

        println!("[AudioTranscriber] 🧠 Running Whisper on {} samples ({:.1}s of audio)...", 
            audio_16k.len(), audio_16k.len() as f32 / 16000.0);

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(cfg.language.as_deref());
        // Physical cores only — HT degrades Whisper performance.
        params.set_n_threads(num_cpus::get_physical().max(1) as i32);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_no_context(true);
        params.set_single_segment(true);
        params.set_translate(false);
        params.set_suppress_blank(true);
        params.set_temperature(0.0);
        params.set_temperature_inc(0.0);

        let mut state = self.ctx.create_state().context("Failed to create whisper state")?;
        state
            .full(params, &audio_16k)
            .context("Whisper transcription failed")?;

        let num_segments = state.full_n_segments();
        let mut text = String::new();
        for i in 0..num_segments {
            if let Some(seg) = state.get_segment(i) {
                if !text.is_empty() { text.push(' '); }
                text.push_str(&format!("{}", seg));
            }
        }

        let result = text.trim().to_string();
        let preview: String = result.chars().take(100).collect();
        println!("[AudioTranscriber] ✅ Result: \"{}\"", preview);
        Ok(result)
    }

    /// Capture system audio using WASAPI loopback on Windows.
    /// This captures what plays through speakers/headphones (the interviewer's voice).
    #[cfg(target_os = "windows")]
    fn capture_wasapi_loopback_static(seconds: u32) -> Result<Vec<f32>> {
        use std::ptr;
        use winapi::um::combaseapi::{CoInitializeEx, CoCreateInstance, CoUninitialize, CLSCTX_ALL};
        use winapi::um::objbase::COINIT_MULTITHREADED;
        use winapi::um::mmdeviceapi::{
            IMMDeviceEnumerator, IMMDevice, MMDeviceEnumerator,
            eRender, eConsole,
        };
        use winapi::um::audioclient::{IID_IAudioClient, IAudioClient, IID_IAudioCaptureClient, IAudioCaptureClient};
        use winapi::shared::mmreg::WAVEFORMATEX;
        use winapi::shared::winerror::S_OK;
        use winapi::shared::guiddef::GUID;
        use winapi::um::audiosessiontypes::AUDCLNT_SHAREMODE_SHARED;

        const AUDCLNT_STREAMFLAGS_LOOPBACK: u32 = 0x00020000;
        const REFTIMES_PER_SEC: i64 = 10_000_000;

        unsafe {
            // Initialize COM
            let hr = CoInitializeEx(ptr::null_mut(), COINIT_MULTITHREADED);
            if hr != S_OK && hr != 1 { // S_OK or S_FALSE (already initialized)
                return Err(anyhow!("CoInitializeEx failed: 0x{:08x}", hr));
            }

            // Create device enumerator
            let clsid_enumerator = GUID {
                Data1: 0xBCDE0395, Data2: 0xE52F, Data3: 0x467C,
                Data4: [0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E],
            };
            let iid_enumerator = GUID {
                Data1: 0xA95664D2, Data2: 0x9614, Data3: 0x4F35,
                Data4: [0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6],
            };

            let mut enumerator: *mut IMMDeviceEnumerator = ptr::null_mut();
            let hr = CoCreateInstance(
                &clsid_enumerator,
                ptr::null_mut(),
                CLSCTX_ALL,
                &iid_enumerator,
                &mut enumerator as *mut _ as *mut _,
            );
            if hr != S_OK {
                CoUninitialize();
                return Err(anyhow!("Failed to create device enumerator: 0x{:08x}", hr));
            }

            // Get default render (output) device - this is what we want to capture
            let mut device: *mut IMMDevice = ptr::null_mut();
            let hr = (*enumerator).GetDefaultAudioEndpoint(eRender, eConsole, &mut device);
            if hr != S_OK {
                (*enumerator).Release();
                CoUninitialize();
                return Err(anyhow!("Failed to get default output device: 0x{:08x}", hr));
            }

            println!("[AudioTranscriber] 🎧 Got default output device for loopback");

            // Activate audio client
            let mut audio_client: *mut IAudioClient = ptr::null_mut();
            let hr = (*device).Activate(
                &IID_IAudioClient as *const _ as *const _,
                CLSCTX_ALL,
                ptr::null_mut(),
                &mut audio_client as *mut _ as *mut _,
            );
            if hr != S_OK {
                (*device).Release();
                (*enumerator).Release();
                CoUninitialize();
                return Err(anyhow!("Failed to activate audio client: 0x{:08x}", hr));
            }

            // Get mix format
            let mut mix_format: *mut WAVEFORMATEX = ptr::null_mut();
            let hr = (*audio_client).GetMixFormat(&mut mix_format);
            if hr != S_OK {
                (*audio_client).Release();
                (*device).Release();
                (*enumerator).Release();
                CoUninitialize();
                return Err(anyhow!("Failed to get mix format: 0x{:08x}", hr));
            }

            let sample_rate = (*mix_format).nSamplesPerSec;
            let channels = (*mix_format).nChannels as usize;
            let bits_per_sample = (*mix_format).wBitsPerSample;
            println!("[AudioTranscriber] 📊 Output format: {}Hz, {}ch, {}bit", sample_rate, channels, bits_per_sample);

            // Initialize in loopback mode
            let buffer_duration = REFTIMES_PER_SEC; // 1 second buffer
            let hr = (*audio_client).Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK,
                buffer_duration,
                0,
                mix_format,
                ptr::null(),
            );
            if hr != S_OK {
                (*audio_client).Release();
                (*device).Release();
                (*enumerator).Release();
                CoUninitialize();
                return Err(anyhow!("Failed to initialize loopback: 0x{:08x}", hr));
            }

            // Get capture client
            let mut capture_client: *mut IAudioCaptureClient = ptr::null_mut();
            let hr = (*audio_client).GetService(
                &IID_IAudioCaptureClient as *const _ as *const _,
                &mut capture_client as *mut _ as *mut _,
            );
            if hr != S_OK {
                (*audio_client).Release();
                (*device).Release();
                (*enumerator).Release();
                CoUninitialize();
                return Err(anyhow!("Failed to get capture client: 0x{:08x}", hr));
            }

            // Start capturing
            let hr = (*audio_client).Start();
            if hr != S_OK {
                (*capture_client).Release();
                (*audio_client).Release();
                (*device).Release();
                (*enumerator).Release();
                CoUninitialize();
                return Err(anyhow!("Failed to start capture: 0x{:08x}", hr));
            }

            println!("[AudioTranscriber] 🎙️ Loopback capture started!");

            // Capture loop
            let mut all_samples: Vec<f32> = Vec::new();
            let capture_duration = Duration::from_secs(seconds as u64);
            let start = std::time::Instant::now();

            while start.elapsed() < capture_duration {
                std::thread::sleep(Duration::from_millis(50));

                let mut packet_length: u32 = 0;
                let hr = (*capture_client).GetNextPacketSize(&mut packet_length);
                if hr != S_OK { continue; }

                while packet_length > 0 {
                    let mut data: *mut u8 = ptr::null_mut();
                    let mut frames_available: u32 = 0;
                    let mut flags: u32 = 0;

                    let hr = (*capture_client).GetBuffer(
                        &mut data,
                        &mut frames_available,
                        &mut flags,
                        ptr::null_mut(),
                        ptr::null_mut(),
                    );
                    if hr != S_OK { break; }

                    if frames_available > 0 && !data.is_null() {
                        // Convert to f32 mono
                        let is_float = bits_per_sample == 32;
                        
                        for frame_idx in 0..frames_available as usize {
                            let mut mono_sample: f32 = 0.0;
                            
                            for ch in 0..channels {
                                let sample_offset = (frame_idx * channels + ch) * (bits_per_sample as usize / 8);
                                let sample_ptr = data.add(sample_offset);
                                
                                let sample: f32 = if is_float {
                                    *(sample_ptr as *const f32)
                                } else {
                                    // 16-bit PCM
                                    let i16_val = *(sample_ptr as *const i16);
                                    i16_val as f32 / 32768.0
                                };
                                
                                mono_sample += sample;
                            }
                            
                            all_samples.push(mono_sample / channels as f32);
                        }
                    }

                    (*capture_client).ReleaseBuffer(frames_available);

                    let hr = (*capture_client).GetNextPacketSize(&mut packet_length);
                    if hr != S_OK { break; }
                }
            }

            // Stop and cleanup
            (*audio_client).Stop();
            (*capture_client).Release();
            (*audio_client).Release();
            (*device).Release();
            (*enumerator).Release();
            CoUninitialize();

            println!("[AudioTranscriber] 📦 Captured {} samples at {}Hz", all_samples.len(), sample_rate);

            // Resample to 16kHz for Whisper
            if sample_rate != 16000 {
                println!("[AudioTranscriber] 🔄 Resampling {}Hz -> 16000Hz", sample_rate);
                Ok(Self::resample_audio(&all_samples, sample_rate, 16000))
            } else {
                Ok(all_samples)
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn capture_wasapi_loopback_static(seconds: u32) -> Result<Vec<f32>> {
        Err(anyhow!("WASAPI loopback is only available on Windows"))
    }

    /// Linear resampling
    fn resample_audio(samples: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
        let ratio = target_rate as f64 / source_rate as f64;
        let output_len = (samples.len() as f64 * ratio) as usize;
        let mut output = Vec::with_capacity(output_len);

        for i in 0..output_len {
            let src_idx = i as f64 / ratio;
            let idx = src_idx as usize;
            let frac = src_idx - idx as f64;

            if idx + 1 < samples.len() {
                let sample = samples[idx] * (1.0 - frac as f32) + samples[idx + 1] * frac as f32;
                output.push(sample);
            } else if idx < samples.len() {
                output.push(samples[idx]);
            }
        }

        output
    }
}
