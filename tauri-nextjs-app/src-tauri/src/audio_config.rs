use once_cell::sync::Lazy;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct AudioTranscriberConfig {
    pub model_path: PathBuf,
    pub sample_rate_hz: u32,
    pub capture_seconds: u32,
    pub language: Option<String>,
}

impl Default for AudioTranscriberConfig {
    fn default() -> Self {
        // Use tiny model for fast transcription (39MB, ~10x faster than small)
        let model_path = std::env::current_dir()
            .unwrap_or_default()
            .join("models")
            .join("ggml-tiny.bin");

        // Fallback to small if tiny doesn't exist
        let model_path = if model_path.exists() {
            model_path
        } else {
            std::env::current_dir()
                .unwrap_or_default()
                .join("models")
                .join("ggml-small.bin")
        };

        Self {
            model_path,
            sample_rate_hz: 16_000,
            capture_seconds: 7,
            language: Some("ru".to_string()),
        }
    }
}

pub static AUDIO_TRANSCRIBER_CONFIG: Lazy<AudioTranscriberConfig> = Lazy::new(AudioTranscriberConfig::default);


