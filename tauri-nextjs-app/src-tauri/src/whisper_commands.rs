//! Whisper Tauri commands.
//! Wraps the existing audio_transcriber for Tauri invoke interface.
//! Uses a global cached WhisperContext to avoid reloading 487MB model on every call.

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

/// Cached transcriber — loaded once, reused for all calls
#[cfg(feature = "transcription")]
pub static CACHED_TRANSCRIBER: Lazy<Mutex<Option<Arc<crate::audio_transcriber::SystemAudioTranscriber>>>> =
    Lazy::new(|| Mutex::new(None));

/// Track which model path is currently loaded to avoid redundant reloads
#[cfg(feature = "transcription")]
static ACTIVE_MODEL_PATH: Lazy<Mutex<Option<String>>> =
    Lazy::new(|| Mutex::new(None));

/// Get models directory path.
fn models_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_default()
        .join("models")
}

/// Check if a specific model file exists.
fn model_path(model_id: &str) -> PathBuf {
    let filename = match model_id {
        "whisper-tiny" => "ggml-tiny.bin",
        "whisper-base" => "ggml-base.bin",
        "whisper-small" => "ggml-small.bin",
        "whisper-medium" => "ggml-medium.bin",
        _ => "ggml-small.bin",
    };
    models_dir().join(filename)
}

#[tauri::command]
pub async fn whisper_initialize(model: String) -> Result<(), String> {
    let path = model_path(&model);
    if !path.exists() {
        return Err(format!(
            "Model {} not found at {:?}. Please download it first.",
            model, path
        ));
    }
    #[cfg(feature = "transcription")]
    {
        let path_str = path.to_string_lossy().to_string();

        // Skip reload if the same model is already in cache
        {
            let active = ACTIVE_MODEL_PATH.lock().unwrap();
            if active.as_deref() == Some(&path_str) {
                println!("[whisper_commands] Model '{}' already loaded, skipping", model);
                return Ok(());
            }
        }

        println!("[whisper_commands] Loading model '{}'...", model);

        // Load in a blocking thread to avoid freezing the UI
        tokio::task::spawn_blocking(move || {
            use crate::audio_transcriber::SystemAudioTranscriber;
            let transcriber = SystemAudioTranscriber::new_with_path(&path)
                .map_err(|e| e.to_string())?;
            {
                let mut cache = CACHED_TRANSCRIBER.lock().unwrap();
                *cache = Some(Arc::new(transcriber));
            }
            {
                let mut active = ACTIVE_MODEL_PATH.lock().unwrap();
                *active = Some(path_str.clone());
            }
            println!("[whisper_commands] Model cached and ready");
            Ok(())
        })
        .await
        .map_err(|e| format!("Task failed: {}", e))?
    }
    #[cfg(not(feature = "transcription"))]
    Ok(())
}

#[tauri::command]
pub async fn whisper_transcribe() -> Result<String, String> {
    #[cfg(feature = "transcription")]
    {
        use crate::audio_transcriber::SystemAudioTranscriber;

        // Get or create cached transcriber
        let transcriber = {
            let mut cache = CACHED_TRANSCRIBER.lock().unwrap();
            if cache.is_none() {
                println!("[whisper_commands] Loading model for first time...");
                let t = SystemAudioTranscriber::new().map_err(|e| e.to_string())?;
                *cache = Some(Arc::new(t));
            }
            cache.as_ref().unwrap().clone()
        };

        // Run capture+transcribe in blocking thread (model already loaded)
        tokio::task::spawn_blocking(move || {
            transcriber.capture_and_transcribe().map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| format!("Task failed: {}", e))?
    }
    #[cfg(not(feature = "transcription"))]
    {
        Err("Transcription feature not enabled".to_string())
    }
}

#[tauri::command]
pub fn whisper_get_installed_models() -> Result<Vec<String>, String> {
    let models = ["whisper-tiny", "whisper-base", "whisper-small", "whisper-medium"];
    let installed: Vec<String> = models
        .iter()
        .filter(|m| model_path(m).exists())
        .map(|m| m.to_string())
        .collect();
    Ok(installed)
}

#[tauri::command]
pub fn whisper_is_model_available(model: String) -> Result<bool, String> {
    Ok(model_path(&model).exists())
}

#[tauri::command]
pub async fn whisper_download_model(model: String) -> Result<(), String> {
    let url = match model.as_str() {
        "whisper-tiny" => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        "whisper-base" => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        "whisper-small" => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        "whisper-medium" => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        _ => return Err(format!("Unknown model: {}", model)),
    };

    let dest = model_path(&model);
    let dir = dest.parent().unwrap();
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create models dir: {}", e))?;

    let url_owned = url.to_string();
    let dest_clone = dest.clone();

    tokio::task::spawn_blocking(move || {
        use std::io::Write;

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(1800))
            .build()
            .map_err(|e| format!("Client build failed: {}", e))?;

        let mut response = client.get(&url_owned).send()
            .map_err(|e| format!("Download failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Download failed with status: {}", response.status()));
        }

        let mut file = fs::File::create(&dest_clone)
            .map_err(|e| format!("File create failed: {}", e))?;

        std::io::copy(&mut response, &mut file)
            .map_err(|e| format!("Write failed: {}", e))?;

        file.flush().map_err(|e| format!("Flush failed: {}", e))?;

        println!("[whisper_commands] Model downloaded to {:?}", dest_clone);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
