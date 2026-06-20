use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::collections::HashMap;
use uuid::Uuid;
use global_hotkey::{hotkey::{Code, HotKey, Modifiers}};
use std::thread;
use std::time::Duration;
use tauri::Manager;

#[cfg(feature = "transcription")]
mod audio_config;
#[cfg(feature = "transcription")]
mod audio_transcriber;
use std::sync::{Mutex, Arc};

mod cursor_manager;
mod window_manager;
mod screen_protection;
mod hotkey_manager;
mod legend_window;
mod window_behavior;
mod screenshot;
mod whisper_commands;
mod audio_recorder;

// Добавим обработчик событий для окна
#[derive(Clone)]
struct WindowEventHandler {
    standard_cursor_enabled: Arc<Mutex<bool>>,
    always_on_top_enabled: Arc<Mutex<bool>>,
}

impl WindowEventHandler {
    fn new() -> Self {
        Self {
            standard_cursor_enabled: Arc::new(Mutex::new(false)),
            always_on_top_enabled: Arc::new(Mutex::new(false)),
        }
    }
}

// Реализуем обработчик событий окна для Tauri
impl WindowEventHandler {
    fn on_window_event(&self, event: tauri::WindowEvent) {
        match event {
            tauri::WindowEvent::Resized(..) => {
                if *self.standard_cursor_enabled.lock().unwrap() {
                    cursor_manager::force_arrow_cursor_manually();
                    std::thread::spawn(|| {
                        for i in 0..1 {
                            std::thread::sleep(std::time::Duration::from_millis(i * 25));
                            cursor_manager::force_arrow_cursor_manually();
                        }
                    });
                }
            }
            tauri::WindowEvent::Moved(..) => {
                if *self.standard_cursor_enabled.lock().unwrap() {
                    cursor_manager::force_arrow_cursor_manually();
                    std::thread::spawn(|| {
                        std::thread::sleep(std::time::Duration::from_millis(50));
                        cursor_manager::force_arrow_cursor_manually();
                    });
                }
            }
            tauri::WindowEvent::CloseRequested { .. } => {
                *self.standard_cursor_enabled.lock().unwrap() = false;
                *self.always_on_top_enabled.lock().unwrap() = false;
            }
            _ => {}
        }
    }
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet() {}

#[tauri::command]
async fn capture_screenshot(
    width: Option<u32>,
    height: Option<u32>,
    jpeg_quality: Option<u8>,
) -> Result<screenshot::ScreenshotResult, String> {
    let quality = jpeg_quality.unwrap_or(80);
    tokio::task::spawn_blocking(move || {
        screenshot::capture(width, height, quality)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
fn write_file(filename: &str, content: &str) -> Result<(), String> {
    fs::write(filename, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(filename: &str) -> Result<String, String> {
    if !Path::new(filename).exists() {
        return Err(format!("Файл {} не найден", filename));
    }
    fs::read_to_string(filename).map_err(|e| e.to_string())
}

// Структуры для чата
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    id: String,
    role: String,
    content: String,
    timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSession {
    id: String,
    context: String,
    messages: Vec<Message>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl ChatSession {
    fn new(context: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            context,
            messages: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }

    fn add_message(&mut self, role: String, content: String) -> Message {
        let message = Message {
            id: Uuid::new_v4().to_string(),
            role,
            content,
            timestamp: Utc::now(),
        };
        self.messages.push(message.clone());
        self.updated_at = Utc::now();
        message
    }

    fn get_title(&self) -> String {
        if !self.context.is_empty() {
            // Используем первые 50 символов контекста как заголовок
            let title = self.context.chars().take(50).collect::<String>();
            if self.context.len() > 50 {
                format!("{}...", title)
            } else {
                title
            }
        } else if !self.messages.is_empty() {
            let first_msg = &self.messages[0];
            let title = first_msg.content.chars().take(50).collect::<String>();
            if first_msg.content.len() > 50 {
                format!("{}...", title)
            } else {
                title
            }
        } else {
            format!("Новый чат {}", self.created_at.format("%d.%m %H:%M"))
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSessionSummary {
    id: String,
    title: String,
    message_count: usize,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<&ChatSession> for ChatSessionSummary {
    fn from(session: &ChatSession) -> Self {
        Self {
            id: session.id.clone(),
            title: session.get_title(),
            message_count: session.messages.len(),
            created_at: session.created_at,
            updated_at: session.updated_at,
        }
    }
}

// Глобальное состояние чата
static CHAT_SESSIONS: Lazy<RwLock<HashMap<String, ChatSession>>> = Lazy::new(|| {
    RwLock::new(HashMap::new())
});

/// Get the storage path for chat sessions. Uses %APPDATA%\InterviewAssistant\chat_sessions.json
/// on Windows so persistence works inside the packaged .exe (cwd may be read-only).
fn chat_storage_path() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    let base = std::env::var_os("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    #[cfg(not(target_os = "windows"))]
    let base = std::env::var_os("HOME")
        .map(|h| std::path::PathBuf::from(h).join(".config"))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

    let dir = base.join("InterviewAssistant");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("chat_sessions.json")
}

/// Load all chat sessions from disk into the in-memory store. Called once at startup.
/// Tolerates missing/corrupt files gracefully — never panics.
fn load_chat_sessions_from_disk() {
    let path = chat_storage_path();

    // One-time migration from the old RaxatGlass folder to InterviewAssistant.
    // Keeps user history when they upgrade.
    if !path.exists() {
        #[cfg(target_os = "windows")]
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let legacy = std::path::PathBuf::from(appdata)
                .join("RaxatGlass")
                .join("chat_sessions.json");
            if legacy.exists() {
                let _ = std::fs::copy(&legacy, &path);
                println!("[chat] Migrated history from {:?} to {:?}", legacy, path);
            }
        }
    }

    if !path.exists() {
        // Try recovering from a leftover .tmp from a crashed write.
        let tmp = path.with_extension("json.tmp");
        if tmp.exists() {
            let _ = std::fs::rename(&tmp, &path);
        }
        if !path.exists() { return; }
    }
    let result = std::panic::catch_unwind(|| {
        let json = std::fs::read_to_string(&path).ok()?;
        serde_json::from_str::<HashMap<String, ChatSession>>(&json).ok()
    });
    match result {
        Ok(Some(map)) => {
            let count = map.len();
            *CHAT_SESSIONS.write() = map;
            println!("[chat] Loaded {} sessions from {:?}", count, path);
        }
        Ok(None) => println!("[chat] Stored sessions file present but unreadable, skipping"),
        Err(_) => println!("[chat] Panic while loading sessions, skipping"),
    }
}

/// Synchronous, atomic write of the in-memory store to disk.
/// Atomic via temp-file + rename so we never observe a half-written JSON.
fn persist_chat_sessions_blocking() {
    let snapshot: HashMap<String, ChatSession> = CHAT_SESSIONS.read().clone();
    let _ = std::panic::catch_unwind(|| {
        let path = chat_storage_path();
        let json = match serde_json::to_string(&snapshot) {
            Ok(j) => j,
            Err(e) => { println!("[chat] serialize failed: {}", e); return; }
        };
        let tmp = path.with_extension("json.tmp");
        if let Err(e) = std::fs::write(&tmp, &json) {
            println!("[chat] tmp write failed: {}", e);
            // Fall back to direct write so we don't lose data.
            let _ = std::fs::write(&path, &json);
            return;
        }
        if let Err(_) = std::fs::rename(&tmp, &path) {
            // Windows: rename can fail when destination exists. Try removing then rename;
            // as final fallback, do a direct (non-atomic) write.
            let _ = std::fs::remove_file(&path);
            if let Err(_) = std::fs::rename(&tmp, &path) {
                let _ = std::fs::write(&path, &json);
                let _ = std::fs::remove_file(&tmp);
            }
        }
    });
}

/// Lazy-initialized background writer thread. Decouples persistence from Tauri command
/// threads so we don't depend on any specific runtime (tokio / sync / blocking — all OK).
/// Coalesces bursts of writes via try_recv drain.
static CHAT_PERSIST_TX: Lazy<std::sync::mpsc::Sender<()>> = Lazy::new(|| {
    let (tx, rx) = std::sync::mpsc::channel::<()>();
    std::thread::Builder::new()
        .name("chat-persist".into())
        .spawn(move || {
            while rx.recv().is_ok() {
                // Coalesce a short burst of mutations into a single write.
                std::thread::sleep(std::time::Duration::from_millis(40));
                while rx.try_recv().is_ok() {}
                persist_chat_sessions_blocking();
            }
        })
        .expect("failed to spawn chat-persist thread");
    tx
});

/// Schedule a non-blocking persist. Safe to call from any thread / runtime.
fn persist_chat_sessions() {
    // If the receiver thread died for any reason, fall back to a direct sync write
    // so we still don't lose data.
    if CHAT_PERSIST_TX.send(()).is_err() {
        persist_chat_sessions_blocking();
    }
}

// Команды Tauri для управления чатом
#[tauri::command]
fn create_chat_session(context: String) -> Result<ChatSession, String> {
    let session = ChatSession::new(context);
    let session_id = session.id.clone();
    
    CHAT_SESSIONS.write().insert(session_id, session.clone());
    persist_chat_sessions();
    Ok(session)
}

#[tauri::command]
fn get_chat_session(session_id: String) -> Result<ChatSession, String> {
    CHAT_SESSIONS
        .read()
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Session not found".to_string())
}

#[tauri::command]
fn list_chat_sessions() -> Result<Vec<ChatSessionSummary>, String> {
    let sessions = CHAT_SESSIONS.read();
    let mut summaries: Vec<ChatSessionSummary> = sessions
        .values()
        .map(|session| session.into())
        .collect();
    
    // Сортируем по дате обновления (новые сверху)
    summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    Ok(summaries)
}

#[tauri::command]
fn delete_chat_session(session_id: String) -> Result<(), String> {
    CHAT_SESSIONS
        .write()
        .remove(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    persist_chat_sessions();
    Ok(())
}

#[tauri::command]
fn rename_chat_session(session_id: String, new_title: String) -> Result<ChatSession, String> {
    let mut sessions = CHAT_SESSIONS.write();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    
    // Обновляем контекст как способ изменения заголовка
    session.context = new_title;
    session.updated_at = Utc::now();
    let snapshot = session.clone();
    drop(sessions);
    persist_chat_sessions();
    Ok(snapshot)
}

#[tauri::command]
fn update_chat_context(session_id: String, context: String) -> Result<ChatSession, String> {
    let mut sessions = CHAT_SESSIONS.write();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    
    session.context = context;
    session.updated_at = Utc::now();
    let snapshot = session.clone();
    drop(sessions);
    persist_chat_sessions();
    Ok(snapshot)
}

#[tauri::command]
async fn send_message(session_id: String, content: String) -> Result<Message, String> {
    let mut sessions = CHAT_SESSIONS.write();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    // Добавляем сообщение пользователя (без генерации ответа — ответ стримится на фронте)
    let user_message = session.add_message("user".to_string(), content.clone());
    drop(sessions);
    persist_chat_sessions();
    Ok(user_message)
}

/// Save assistant message to a chat session (called after AI response).
#[tauri::command]
fn save_assistant_message(session_id: String, content: String) -> Result<Message, String> {
    let mut sessions = CHAT_SESSIONS.write();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    let msg = session.add_message("assistant".to_string(), content);
    drop(sessions);
    persist_chat_sessions();
    Ok(msg)
}

/// Proxy AI request through Rust to bypass webview CSP restrictions in production builds.
/// Accepts endpoint, api_key, and body JSON string, returns the full response text.
/// Automatically retries on 429 (rate limit) with exponential backoff.
#[tauri::command]
async fn ai_proxy_request(endpoint: String, api_key: String, body: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Content-Type", "application/json".parse().unwrap());
    if !api_key.is_empty() {
        headers.insert("Authorization", format!("Bearer {}", api_key).parse().map_err(|e| format!("Header error: {}", e))?);
    }
    headers.insert("HTTP-Referer", "https://diplom-chi-ten.vercel.app".parse().unwrap());
    headers.insert("X-Title", "RaxatGlass".parse().unwrap());

    // Retry loop for 429 rate limits
    let max_retries = 3;
    for attempt in 0..=max_retries {
        let response = client
            .post(&endpoint)
            .headers(headers.clone())
            .body(body.clone())
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status().as_u16();
        let text = response.text().await.map_err(|e| format!("Read body failed: {}", e))?;

        if status == 429 && attempt < max_retries {
            // Wait before retry: 2s, 4s, 8s
            let delay = 2u64 << attempt;
            println!("[ai_proxy] 429 rate limit, retrying in {}s (attempt {}/{})", delay, attempt + 1, max_retries);
            tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
            continue;
        }

        if status >= 400 {
            return Err(format!("{}: {}", status, text.chars().take(300).collect::<String>()));
        }

        return Ok(text);
    }

    Err("Max retries exceeded".to_string())
}

/// Proxy a GET request through Rust to bypass CORS for the desktop webview.
/// Used for the auth polling flow where the API rejects the `tauri://` origin.
#[tauri::command]
async fn http_proxy_get(url: String, bearer: Option<String>) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let mut req = client.get(&url);
    if let Some(token) = bearer {
        if !token.is_empty() {
            req = req.bearer_auth(token);
        }
    }

    let response = req.send().await.map_err(|e| format!("Request failed: {}", e))?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(|e| format!("Read body failed: {}", e))?;

    if status >= 400 {
        return Err(format!("{}: {}", status, text.chars().take(300).collect::<String>()));
    }
    Ok(text)
}

/// Proxy a POST request (typed JSON) through Rust to bypass CORS for the desktop webview.
#[tauri::command]
async fn http_proxy_post(
    url: String,
    bearer: Option<String>,
    body: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json");
    if let Some(token) = bearer {
        if !token.is_empty() {
            req = req.bearer_auth(token);
        }
    }
    let req = req.body(body.unwrap_or_else(|| "{}".to_string()));

    let response = req.send().await.map_err(|e| format!("Request failed: {}", e))?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(|e| format!("Read body failed: {}", e))?;

    if status >= 400 {
        return Err(format!("{}: {}", status, text.chars().take(300).collect::<String>()));
    }
    Ok(text)
}

/// True streaming AI proxy: pushes SSE chunks to the frontend through a Tauri Channel
/// as they arrive over the wire. This makes the first token appear in ~300ms instead
/// of waiting for the full response (saves 3–10s on the live assistant).
#[tauri::command]
async fn ai_proxy_stream(
    endpoint: String,
    api_key: String,
    body: String,
    on_chunk: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Content-Type", "application/json".parse().unwrap());
    if !api_key.is_empty() {
        headers.insert(
            "Authorization",
            format!("Bearer {}", api_key)
                .parse()
                .map_err(|e| format!("Header error: {}", e))?,
        );
    }
    headers.insert("HTTP-Referer", "https://diplom-chi-ten.vercel.app".parse().unwrap());
    headers.insert("X-Title", "RaxatGlass".parse().unwrap());
    headers.insert("Accept", "text/event-stream".parse().unwrap());

    let mut response = client
        .post(&endpoint)
        .headers(headers)
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    if status >= 400 {
        let text = response.text().await.unwrap_or_default();
        return Err(format!(
            "{}: {}",
            status,
            text.chars().take(300).collect::<String>()
        ));
    }

    // Stream chunks as they arrive. Frontend parses partial SSE between sends.
    // `chunk()` splits on arbitrary byte boundaries, which can land in the middle
    // of a multi-byte UTF-8 sequence (Cyrillic is 2 bytes). Decoding each chunk
    // independently with from_utf8_lossy would corrupt that char into `�`, breaking
    // the SSE JSON line so the frontend silently drops the token — the response then
    // reads as if it were cut off mid-thought. To avoid this we keep an incomplete
    // trailing byte sequence in a buffer and only forward complete UTF-8.
    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Stream error: {}", e))?
    {
        buf.extend_from_slice(&chunk);
        match std::str::from_utf8(&buf) {
            Ok(valid) => {
                if !valid.is_empty() {
                    let _ = on_chunk.send(valid.to_string());
                }
                buf.clear();
            }
            Err(e) => {
                let valid_up_to = e.valid_up_to();
                if valid_up_to > 0 {
                    // Safe: bytes [0, valid_up_to) are guaranteed valid UTF-8.
                    let valid = unsafe { std::str::from_utf8_unchecked(&buf[..valid_up_to]) };
                    let _ = on_chunk.send(valid.to_string());
                    buf.drain(..valid_up_to);
                }
                // Keep the incomplete trailing bytes in `buf` for the next chunk.
            }
        }
    }
    // Flush any leftover bytes (best-effort — stream ended on a boundary).
    if !buf.is_empty() {
        let _ = on_chunk.send(String::from_utf8_lossy(&buf).into_owned());
    }

    Ok(())
}

#[tauri::command]
fn get_chat_messages(session_id: String) -> Result<Vec<Message>, String> {
    let sessions = CHAT_SESSIONS.read();
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    
    Ok(session.messages.clone())
}

// Функции для управления окном
#[tauri::command]
async fn close_window(window: tauri::Window) {
    window.close().unwrap();
}

#[tauri::command]
async fn minimize_window(window: tauri::Window) {
    window.minimize().unwrap();
}

#[tauri::command]
async fn maximize_window(window: tauri::Window) {
    window.maximize().unwrap();
}

#[tauri::command]
async fn unmaximize_window(window: tauri::Window) {
    window.unmaximize().unwrap();
}

#[tauri::command]
async fn is_maximized(window: tauri::Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

// ── Окно «Легенда опыта» (оверлей, крепится к краю экрана) ──

#[tauri::command]
fn open_legend_window(
    window: tauri::WebviewWindow,
    edge: Option<String>,
    always_on_top: Option<bool>,
) -> Result<(), String> {
    let app = window.app_handle();
    let edge = edge.unwrap_or_else(|| "right".to_string());
    legend_window::ensure_legend_window(&app, &edge, always_on_top.unwrap_or(true))
}

#[tauri::command]
fn dock_legend_window(window: tauri::WebviewWindow, edge: String) -> Result<(), String> {
    let app = window.app_handle();
    if let Some(legend) = app.get_webview_window(legend_window::LEGEND_LABEL) {
        legend_window::dock_to_edge(&legend, &edge)
    } else {
        Err("Окно легенды не открыто".to_string())
    }
}

#[derive(Serialize)]
pub struct ObsidianNote {
    name: String,
    path: String,
    modified: u64,
}

fn collect_markdown(dir: &Path, out: &mut Vec<ObsidianNote>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            // Пропускаем служебную папку Obsidian.
            if name == ".obsidian" || name == ".trash" {
                continue;
            }
            collect_markdown(&path, out);
        } else if name.to_lowercase().ends_with(".md") {
            let modified = entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            out.push(ObsidianNote {
                name,
                path: path.to_string_lossy().to_string(),
                modified,
            });
        }
    }
}

#[tauri::command]
fn list_obsidian_notes(vault_path: String) -> Result<Vec<ObsidianNote>, String> {
    let root = Path::new(&vault_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Папка не найдена: {}", vault_path));
    }
    let mut notes = Vec::new();
    collect_markdown(root, &mut notes);
    notes.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(notes)
}

#[tauri::command]
fn read_obsidian_note(path: String) -> Result<String, String> {
    if !Path::new(&path).exists() {
        return Err(format!("Файл не найден: {}", path));
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

// Функция для ИИ-ассистента собеседований
#[tauri::command]
fn get_ai_response(context: &str, question: &str) -> Result<String, String> {
    // Пока что возвращаем заглушку - позже можно интегрировать с реальным ИИ
    let response = format!(
        "Ассистент отвечает:\n\nВаш вопрос: \"{}\"\n\nКонтекст: {}\n\nЭто заглушка ответа. В будущем здесь будет настоящий ИИ-ответ на основе вашего контекста и вопроса.",
        question,
        if context.is_empty() { "Контекст не задан" } else { context }
    );
    
    Ok(response)
}

// Структуры для настроек
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    language: String,
    auto_save: bool,
    notifications: bool,
    ai_model: String,
    api_key: String,
    max_tokens: u32,
    temperature: f32,
    system_prompt: String,
    is_authenticated: bool,
    user_display_name: String,
}

// Структура для настроек скрытности
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrivacySettings {
    hide_from_taskbar: bool,
    minimize_to_tray: bool,
    start_minimized: bool,
    require_password: bool,
    auto_hide_timeout: u32, // в минутах
    hide_when_inactive: bool,
    hide_from_screen_sharing: bool,
    standard_cursor: bool, // новая настройка для стандартного курсора
    always_on_top: bool, // настройка "Поверх всех окон"
}

impl Default for PrivacySettings {
    fn default() -> Self {
        Self {
            hide_from_taskbar: false,
            minimize_to_tray: false,
            start_minimized: false,
            require_password: false,
            auto_hide_timeout: 10,
            hide_when_inactive: false,
            hide_from_screen_sharing: false,
            standard_cursor: false, // новая настройка
            always_on_top: false, // настройка "Поверх всех окон"
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: "ru".to_string(),
            auto_save: true,
            notifications: true,
            ai_model: "gpt-3.5-turbo".to_string(),
            api_key: String::new(),
            max_tokens: 2000,
            temperature: 0.7,
            system_prompt: "Ты - помощник для проведения собеседований. Помогай кандидатам и интервьюерам.".to_string(),
            is_authenticated: false,
            user_display_name: String::new(),
        }
    }
}

// Глобальное состояние настроек
static APP_SETTINGS: Lazy<RwLock<AppSettings>> = Lazy::new(|| {
    RwLock::new(AppSettings::default())
});

// Команды для управления настройками
#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    Ok(APP_SETTINGS.read().clone())
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    *APP_SETTINGS.write() = settings;
    // Здесь можно добавить сохранение в файл
    Ok(())
}

#[tauri::command]
fn reset_settings() -> Result<AppSettings, String> {
    let default_settings = AppSettings::default();
    *APP_SETTINGS.write() = default_settings.clone();
    Ok(default_settings)
}

// Команды для авторизации
#[tauri::command]
fn open_auth_url(url: Option<String>) -> Result<(), String> {
    let target = url.unwrap_or_else(|| "https://diplom-chi-ten.vercel.app".to_string());
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: spawn cmd without a console window so no terminal
        // flashes on screen while it launches the default browser via `start`.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &target])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
fn logout_user() -> Result<(), String> {
    // Здесь будет логика выхода - очистка токенов и т.д.
    let mut settings = APP_SETTINGS.write();
    settings.is_authenticated = false;
    settings.user_display_name.clear();
    println!("User logged out");
    Ok(())
}

#[tauri::command]
fn set_auth_status(is_authenticated: bool, user_name: String) -> Result<(), String> {
    // Команда для установки статуса авторизации (вызывается извне)
    let mut settings = APP_SETTINGS.write();
    settings.is_authenticated = is_authenticated;
    settings.user_display_name = user_name;
    Ok(())
}

// Структуры для аналитики
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalyticsResponse {
    id: String,
    question: String,
    response: String,
    timestamp: DateTime<Utc>,
    session_id: String,
    is_helpful: Option<bool>,
    response_time_ms: u64,
    model_used: String,
    tokens_used: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalyticsStats {
    total_responses: usize,
    helpful_responses: usize,
    unhelpful_responses: usize,
    average_response_time: u64,
    total_tokens_used: u32,
    most_used_model: String,
}

// Глобальное состояние аналитики
static ANALYTICS_RESPONSES: Lazy<RwLock<Vec<AnalyticsResponse>>> = Lazy::new(|| {
    RwLock::new(Vec::new())
});

// Команды для аналитики
#[tauri::command]
fn add_analytics_response(
    question: String,
    response: String,
    session_id: String,
    response_time_ms: u64,
    model_used: String,
    tokens_used: u32,
) -> Result<String, String> {
    let analytics_response = AnalyticsResponse {
        id: Uuid::new_v4().to_string(),
        question,
        response,
        timestamp: Utc::now(),
        session_id,
        is_helpful: None,
        response_time_ms,
        model_used,
        tokens_used,
    };
    
    let response_id = analytics_response.id.clone();
    ANALYTICS_RESPONSES.write().push(analytics_response);
    
    Ok(response_id)
}

#[tauri::command]
fn get_analytics_responses() -> Result<Vec<AnalyticsResponse>, String> {
    Ok(ANALYTICS_RESPONSES.read().clone())
}

#[tauri::command]
fn get_analytics_stats() -> Result<AnalyticsStats, String> {
    let responses = ANALYTICS_RESPONSES.read();
    
    if responses.is_empty() {
        return Ok(AnalyticsStats {
            total_responses: 0,
            helpful_responses: 0,
            unhelpful_responses: 0,
            average_response_time: 0,
            total_tokens_used: 0,
            most_used_model: String::new(),
        });
    }
    
    let total_responses = responses.len();
    let helpful_responses = responses.iter().filter(|r| r.is_helpful == Some(true)).count();
    let unhelpful_responses = responses.iter().filter(|r| r.is_helpful == Some(false)).count();
    
    let total_response_time: u64 = responses.iter().map(|r| r.response_time_ms).sum();
    let average_response_time = total_response_time / total_responses as u64;

    let total_tokens_used: u32 = responses.iter().map(|r| r.tokens_used).sum();
    
    // Находим самую используемую модель
    let mut model_counts = HashMap::new();
    for response in responses.iter() {
        *model_counts.entry(response.model_used.clone()).or_insert(0) += 1;
    }
    let most_used_model = model_counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(model, _)| model)
        .unwrap_or_default();
    
    Ok(AnalyticsStats {
        total_responses,
        helpful_responses,
        unhelpful_responses,
        average_response_time,
        total_tokens_used,
        most_used_model,
    })
}

#[tauri::command]
fn rate_response(response_id: String, is_helpful: bool) -> Result<(), String> {
    let mut responses = ANALYTICS_RESPONSES.write();
    
    if let Some(response) = responses.iter_mut().find(|r| r.id == response_id) {
        response.is_helpful = Some(is_helpful);
        Ok(())
    } else {
        Err("Response not found".to_string())
    }
}

#[tauri::command]
fn clear_analytics() -> Result<(), String> {
    ANALYTICS_RESPONSES.write().clear();
    Ok(())
}

// Команды для управления настройками скрытности
#[tauri::command]
fn get_privacy_settings() -> Result<PrivacySettings, String> {
    // В реальном приложении здесь бы была загрузка из файла конфигурации
    let mut settings = PrivacySettings::default();
    
    // Проверяем текущее состояние стандартного курсора и режима "поверх всех окон"
    settings.standard_cursor = cursor_manager::is_standard_cursor_enabled();
    settings.always_on_top = window_manager::is_always_on_top_enabled();
    settings.hide_from_screen_sharing = screen_protection::is_protection_enabled();
    
    Ok(settings)
}

#[tauri::command]
fn save_privacy_settings(settings: PrivacySettings) -> Result<(), String> {
    // В реальном приложении здесь бы было сохранение в файл конфигурации
    println!("Сохранение настроек скрытности: {:?}", settings);
    
    // Если настройка стандартного курсора изменилась, применяем её
    let current_cursor_state = cursor_manager::is_standard_cursor_enabled();
    if current_cursor_state != settings.standard_cursor {
        // Применим настройку при следующем запуске окна
        println!("Настройка стандартного курсора изменена: {}", settings.standard_cursor);
    }
    
    Ok(())
}

#[tauri::command]
async fn hide_from_taskbar(window: tauri::WebviewWindow) -> Result<(), String> {
    window_manager::apply_skip_taskbar_to_all(window.app_handle(), true);
    hotkey_manager::set_taskbar_hidden(true);
    println!("Приложение скрыто из панели задач (все окна)");
    Ok(())
}

#[tauri::command]
async fn show_in_taskbar(window: tauri::WebviewWindow) -> Result<(), String> {
    window_manager::apply_skip_taskbar_to_all(window.app_handle(), false);
    hotkey_manager::set_taskbar_hidden(false);
    println!("Приложение показано в панели задач (все окна)");
    Ok(())
}

#[tauri::command]
async fn minimize_to_tray(window: tauri::Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())?;
    println!("Приложение свернуто в трей");
    Ok(())
}

#[tauri::command]
async fn restore_from_tray(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    println!("Приложение восстановлено из трея");
    Ok(())
}

#[tauri::command]
async fn hide_from_screen_sharing(window: tauri::WebviewWindow) -> Result<(), String> {
    screen_protection::hide_from_screen_sharing(&window).await
}

#[tauri::command]
async fn show_in_screen_sharing(window: tauri::WebviewWindow) -> Result<(), String> {
    screen_protection::show_in_screen_sharing(&window).await
}

#[tauri::command]
async fn set_protection_mode(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    // Apply to every window (main, popup, legend) so the overlay is hidden too.
    screen_protection::apply_to_all(window.app_handle(), enabled)
}

#[tauri::command]
fn is_protection_enabled() -> bool {
    screen_protection::is_protection_enabled()
}

// Структуры для настроек горячих клавиш
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HotkeyBinding {
    id: String,
    name: String,
    description: String,
    key_combination: String,
    action_type: String,
    is_enabled: bool,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HotkeySettings {
    bindings: Vec<HotkeyBinding>,
    global_enabled: bool,
    record_system_audio: bool,
    record_microphone: bool,
    audio_quality: String,
    auto_save_recordings: bool,
    recordings_folder: String,
}

impl Default for HotkeySettings {
    fn default() -> Self {
        Self {
            bindings: vec![
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Стандартный курсор".to_string(),
                    description: "Курсор всегда отображается как стрелка во всём приложении".to_string(),
                    key_combination: "Ctrl+1".to_string(),
                    action_type: "toggle_standard_cursor".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Поверх всех окон".to_string(),
                    description: "Закрепляет окно приложения поверх остальных".to_string(),
                    key_combination: "Ctrl+2".to_string(),
                    action_type: "toggle_always_on_top".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Защита от захвата экрана".to_string(),
                    description: "Скрывает приложение при записи/трансляции экрана".to_string(),
                    key_combination: "Ctrl+3".to_string(),
                    action_type: "toggle_screen_protection".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Видимость в панели задач".to_string(),
                    description: "Скрывает/показывает приложение в панели задач".to_string(),
                    key_combination: "Ctrl+4".to_string(),
                    action_type: "toggle_taskbar_visibility".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Легенда".to_string(),
                    description: "Открывает/фокусирует окно «Легенда опыта»".to_string(),
                    key_combination: "Ctrl+6".to_string(),
                    action_type: "open_legend_window".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Переключить возможность максимизации".to_string(),
                    description: "Вкл/выкл maximize (влияет на Snap)".to_string(),
                    key_combination: "Ctrl+7".to_string(),
                    action_type: "toggle_maximizable".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
            ],
            global_enabled: true,
            record_system_audio: true,
            record_microphone: false,
            audio_quality: "medium".to_string(),
            auto_save_recordings: true,
            recordings_folder: "recordings".to_string(),
        }
    }
}

// Глобальные настройки горячих клавиш
static HOTKEY_SETTINGS: Lazy<RwLock<HotkeySettings>> = Lazy::new(|| {
    RwLock::new(HotkeySettings::default())
});

static RECORDING_STATE: Lazy<RwLock<RecordingState>> = Lazy::new(|| {
    RwLock::new(RecordingState::default())
});

// Store registered hotkeys (simplified for now)
static REGISTERED_HOTKEYS: Lazy<RwLock<HashMap<String, String>>> = Lazy::new(|| {
    RwLock::new(HashMap::new())
});

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecordingState {
    is_recording: bool,
    current_file: Option<String>,
    start_time: Option<DateTime<Utc>>,
    duration_seconds: u64,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            is_recording: false,
            current_file: None,
            start_time: None,
            duration_seconds: 0,
        }
    }
}

// Команды для управления горячими клавишами
#[tauri::command]
fn get_hotkey_settings() -> Result<HotkeySettings, String> {
    Ok(HOTKEY_SETTINGS.read().clone())
}

#[tauri::command]
fn save_hotkey_settings(settings: HotkeySettings) -> Result<(), String> {
    *HOTKEY_SETTINGS.write() = settings;
    // В реальном приложении здесь бы было сохранение в файл
    println!("Настройки горячих клавиш сохранены");
    Ok(())
}

#[tauri::command]
fn add_hotkey_binding(
    name: String,
    description: String,
    key_combination: String,
    action_type: String,
) -> Result<HotkeyBinding, String> {
    let binding = HotkeyBinding {
        id: Uuid::new_v4().to_string(),
        name,
        description,
        key_combination,
        action_type,
        is_enabled: true,
        created_at: Utc::now(),
    };
    
    HOTKEY_SETTINGS.write().bindings.push(binding.clone());
    Ok(binding)
}

#[tauri::command]
fn update_hotkey_binding(binding: HotkeyBinding) -> Result<(), String> {
    let mut settings = HOTKEY_SETTINGS.write();
    
    if let Some(index) = settings.bindings.iter().position(|b| b.id == binding.id) {
        settings.bindings[index] = binding;
        Ok(())
    } else {
        Err("Binding not found".to_string())
    }
}

#[tauri::command]
fn delete_hotkey_binding(binding_id: String) -> Result<(), String> {
    let mut settings = HOTKEY_SETTINGS.write();
    
    if let Some(index) = settings.bindings.iter().position(|b| b.id == binding_id) {
        settings.bindings.remove(index);
        Ok(())
    } else {
        Err("Binding not found".to_string())
    }
}

#[tauri::command]
fn toggle_hotkey_binding(binding_id: String) -> Result<bool, String> {
    let mut settings = HOTKEY_SETTINGS.write();
    
    if let Some(binding) = settings.bindings.iter_mut().find(|b| b.id == binding_id) {
        binding.is_enabled = !binding.is_enabled;
        Ok(binding.is_enabled)
    } else {
        Err("Binding not found".to_string())
    }
}

#[tauri::command]
fn start_audio_recording() -> Result<String, String> {
    let mut state = RECORDING_STATE.write();
    
    if state.is_recording {
        return Err("Запись уже выполняется".to_string());
    }
    
    let settings = HOTKEY_SETTINGS.read();
    let recordings_folder = &settings.recordings_folder;
    
    // Создаем папку для записей если её нет
    if !Path::new(recordings_folder).exists() {
        fs::create_dir_all(recordings_folder).map_err(|e| {
            format!("Не удалось создать папку для записей: {}", e)
        })?;
    }
    
    let filename = format!("recording_{}.wav", Utc::now().format("%Y%m%d_%H%M%S"));
    let full_path = format!("{}/{}", recordings_folder, filename);
    
    state.is_recording = true;
    state.current_file = Some(filename.clone());
    state.start_time = Some(Utc::now());
    state.duration_seconds = 0;
    
    // Здесь будет логика начала записи аудио
    println!("Начата запись аудио: {} в папке {}", filename, recordings_folder);
    
    // Запускаем фоновый поток для обновления длительности
    start_duration_updater();
    
    Ok(full_path)
}

#[tauri::command]
fn stop_audio_recording() -> Result<String, String> {
    let mut state = RECORDING_STATE.write();
    
    if !state.is_recording {
        return Err("Запись не выполняется".to_string());
    }
    
    let filename = state.current_file.clone().unwrap_or_default();
    
    if let Some(start_time) = state.start_time {
        state.duration_seconds = (Utc::now() - start_time).num_seconds() as u64;
    }
    
    state.is_recording = false;
    state.start_time = None;
    
    // Здесь будет логика остановки записи аудио
    println!("Остановлена запись аудио: {}, длительность: {} сек", filename, state.duration_seconds);
    
    // Если включено автосохранение, добавляем запись в список
    let settings = HOTKEY_SETTINGS.read();
    if settings.auto_save_recordings {
        println!("Запись автоматически сохранена: {}", filename);
    }
    
    Ok(filename)
}

#[tauri::command]
fn get_recording_state() -> Result<RecordingState, String> {
    let mut state = RECORDING_STATE.write();
    
    // Обновляем длительность если идет запись
    if state.is_recording {
        if let Some(start_time) = state.start_time {
            state.duration_seconds = (Utc::now() - start_time).num_seconds() as u64;
        }
    }
    
    Ok(state.clone())
}

#[tauri::command]
fn test_hotkey_combination(key_combination: String) -> Result<bool, String> {
    // Проверяем, что комбинация клавиш валидна
    if key_combination.is_empty() {
        return Err("Key combination cannot be empty".to_string());
    }
    
    // Простая валидация формата
    let valid_modifiers = ["Ctrl", "Alt", "Shift", "Win"];
    let parts: Vec<&str> = key_combination.split('+').collect();
    
    if parts.len() < 2 {
        return Err("Key combination must contain at least one modifier and one key".to_string());
    }
    
    let key = parts.last().unwrap();
    let modifiers = &parts[..parts.len()-1];
    
    for modifier in modifiers {
        if !valid_modifiers.contains(modifier) {
            return Err(format!("Invalid modifier: {}", modifier));
        }
    }
    
    if key.len() != 1 && !["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Space", "Enter", "Tab", "Escape"].contains(key) {
        return Err(format!("Invalid key: {}", key));
    }
    
    println!("Тестирование комбинации клавиш: {}", key_combination);
    Ok(true)
}

// Вспомогательная функция для запуска обновления длительности записи
fn start_duration_updater() {
    thread::spawn(|| {
        loop {
            thread::sleep(Duration::from_secs(1));
            
            let mut state = RECORDING_STATE.write();
            if !state.is_recording {
                break;
            }
            
            if let Some(start_time) = state.start_time {
                state.duration_seconds = (Utc::now() - start_time).num_seconds() as u64;
            }
        }
    });
}

#[tauri::command]
async fn register_hotkey(
    hotkey_string: String,
    action: String,
) -> Result<String, String> {
    println!("Registering hotkey: {} for action: {}", hotkey_string, action);
    
    // Validate the hotkey string
    parse_hotkey_string(&hotkey_string)
        .map_err(|e| format!("Failed to parse hotkey: {}", e))?;
    
    // Store the hotkey combination for this action
    let mut hotkeys = REGISTERED_HOTKEYS.write();
    hotkeys.insert(action.clone(), hotkey_string.clone());
    
    Ok(format!("Hotkey {} registered for action {}", hotkey_string, action))
}

#[tauri::command]
async fn unregister_hotkey(action: String) -> Result<String, String> {
    println!("Unregistering hotkey for action: {}", action);
    
    let mut hotkeys = REGISTERED_HOTKEYS.write();
    if let Some(_hotkey) = hotkeys.remove(&action) {
        Ok(format!("Hotkey for action {} unregistered", action))
    } else {
        Err(format!("No hotkey found for action {}", action))
    }
}

fn parse_hotkey_string(hotkey_str: &str) -> Result<HotKey, String> {
    let parts: Vec<&str> = hotkey_str.split('+').collect();
    if parts.is_empty() {
        return Err("Empty hotkey string".to_string());
    }
    
    let key_str = parts.last().unwrap();
    let modifier_parts = &parts[..parts.len()-1];
    
    let mut modifiers = Modifiers::empty();
    for &modifier in modifier_parts {
        match modifier {
            "Ctrl" => modifiers |= Modifiers::CONTROL,
            "Alt" => modifiers |= Modifiers::ALT,
            "Shift" => modifiers |= Modifiers::SHIFT,
            "Win" => modifiers |= Modifiers::SUPER,
            _ => return Err(format!("Unknown modifier: {}", modifier)),
        }
    }
    
    let code = match *key_str {
        "A" => Code::KeyA,
        "B" => Code::KeyB,
        "C" => Code::KeyC,
        "D" => Code::KeyD,
        "E" => Code::KeyE,
        "F" => Code::KeyF,
        "G" => Code::KeyG,
        "H" => Code::KeyH,
        "I" => Code::KeyI,
        "J" => Code::KeyJ,
        "K" => Code::KeyK,
        "L" => Code::KeyL,
        "M" => Code::KeyM,
        "N" => Code::KeyN,
        "O" => Code::KeyO,
        "P" => Code::KeyP,
        "Q" => Code::KeyQ,
        "R" => Code::KeyR,
        "S" => Code::KeyS,
        "T" => Code::KeyT,
        "U" => Code::KeyU,
        "V" => Code::KeyV,
        "W" => Code::KeyW,
        "X" => Code::KeyX,
        "Y" => Code::KeyY,
        "Z" => Code::KeyZ,
        "F1" => Code::F1,
        "F2" => Code::F2,
        "F3" => Code::F3,
        "F4" => Code::F4,
        "F5" => Code::F5,
        "F6" => Code::F6,
        "F7" => Code::F7,
        "F8" => Code::F8,
        "F9" => Code::F9,
        "F10" => Code::F10,
        "F11" => Code::F11,
        "F12" => Code::F12,
        "Space" => Code::Space,
        "Enter" => Code::Enter,
        "Tab" => Code::Tab,
        "Escape" => Code::Escape,
        _ => return Err(format!("Unknown key: {}", key_str)),
    };
    
    Ok(HotKey::new(Some(modifiers), code))
}

// Новые команды для лучшей интеграции с фронтендом

#[tauri::command]
fn execute_hotkey_action(action_type: String) -> Result<String, String> {
    match action_type.as_str() {
        "start_audio_recording" => {
            match start_audio_recording() {
                Ok(filename) => Ok(format!("Запись начата: {}", filename)),
                Err(e) => Err(e),
            }
        },
        "stop_recording" => {
            match stop_audio_recording() {
                Ok(filename) => Ok(format!("Запись остановлена: {}", filename)),
                Err(e) => Err(e),
            }
        },
        "toggle_window_visibility" => {
            Ok("Переключение видимости окна".to_string())
        },
        "take_screenshot" => {
            Ok("Скриншот сделан".to_string())
        },
        _ => Err(format!("Неизвестное действие: {}", action_type)),
    }
}

#[tauri::command]
fn get_available_audio_devices() -> Result<Vec<String>, String> {
    // Заглушка для получения списка аудиоустройств
    Ok(vec![
        "Микрофон по умолчанию".to_string(),
        "Системный звук".to_string(),
        "USB Микрофон".to_string(),
    ])
}

#[tauri::command]
fn set_audio_device(device_name: String) -> Result<(), String> {
    println!("Установлено аудиоустройство: {}", device_name);
    Ok(())
}

#[tauri::command]
fn get_recording_history() -> Result<Vec<String>, String> {
    let settings = HOTKEY_SETTINGS.read();
    let recordings_folder = &settings.recordings_folder;
    
    if !Path::new(recordings_folder).exists() {
        return Ok(vec![]);
    }
    
    let mut recordings = vec![];
    if let Ok(entries) = fs::read_dir(recordings_folder) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".wav") || name.ends_with(".mp3") {
                        recordings.push(name.to_string());
                    }
                }
            }
        }
    }
    
    recordings.sort_by(|a, b| b.cmp(a));
    Ok(recordings)
}

#[tauri::command]
fn delete_recording(filename: String) -> Result<(), String> {
    let settings = HOTKEY_SETTINGS.read();
    let file_path = format!("{}/{}", settings.recordings_folder, filename);
    
    if Path::new(&file_path).exists() {
        fs::remove_file(&file_path).map_err(|e| {
            format!("Не удалось удалить файл: {}", e)
        })?;
        println!("Запись удалена: {}", filename);
        Ok(())
    } else {
        Err("Файл не найден".to_string())
    }
}

#[tauri::command]
fn get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

// --- System audio transcription ---
#[cfg(feature = "transcription")]
#[tauri::command]
fn transcribe_system_audio() -> Result<String, String> {
    let transcriber = audio_transcriber::SystemAudioTranscriber::new()
        .map_err(|e| format!("init whisper error: {e}"))?;
    let text = transcriber
        .capture_and_transcribe()
        .map_err(|e| format!("transcription error: {e}"))?;
    Ok(text)
}

#[tauri::command] 
fn restart_hotkey_system() -> Result<(), String> {
    println!("Restarting hotkey system");
    
    // Clear all registered hotkeys
    let mut hotkeys = REGISTERED_HOTKEYS.write();
    hotkeys.clear();
    
    println!("Hotkey system restarted");
    Ok(())
}

// Replace the previous set_standard_cursor function with this one
#[tauri::command]
async fn set_standard_cursor(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    // Обновляем состояние обработчика событий
    if let Some(state) = window.app_handle().try_state::<WindowEventHandler>() {
        *state.standard_cursor_enabled.lock().unwrap() = enabled;
    }
    
    if enabled {
        cursor_manager::enable_standard_cursor(&window)
    } else {
        cursor_manager::disable_standard_cursor(&window)
    }
}

#[tauri::command]
async fn toggle_standard_cursor(window: tauri::WebviewWindow) -> Result<bool, String> {
    let result = cursor_manager::toggle_standard_cursor(&window)?;
    
    // Обновляем состояние обработчика событий
    if let Some(state) = window.app_handle().try_state::<WindowEventHandler>() {
        *state.standard_cursor_enabled.lock().unwrap() = result;
    }
    
    Ok(result)
}

#[tauri::command]
fn is_standard_cursor_enabled() -> bool {
    cursor_manager::is_standard_cursor_enabled()
}

#[tauri::command]
async fn handle_window_message(message_type: String) -> Result<(), String> {
    cursor_manager::handle_window_message(&message_type)
}

#[tauri::command]
async fn set_always_on_top(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    if let Some(state) = window.app_handle().try_state::<WindowEventHandler>() {
        *state.always_on_top_enabled.lock().unwrap() = enabled;
    }
    // Применяем ко всем окнам (main, popup, legend).
    window_manager::apply_always_on_top_to_all(window.app_handle(), enabled);
    Ok(())
}

#[tauri::command]
async fn toggle_always_on_top(window: tauri::WebviewWindow) -> Result<bool, String> {
    let new_state = !window_manager::is_always_on_top_enabled();
    window_manager::apply_always_on_top_to_all(window.app_handle(), new_state);
    if let Some(state) = window.app_handle().try_state::<WindowEventHandler>() {
        *state.always_on_top_enabled.lock().unwrap() = new_state;
    }
    Ok(new_state)
}

#[tauri::command]
fn is_always_on_top_enabled() -> bool {
    window_manager::is_always_on_top_enabled()
}

// Команды для нового менеджера горячих клавиш Privacy
#[tauri::command]
async fn initialize_privacy_hotkeys(window: tauri::WebviewWindow) -> Result<(), String> {
    hotkey_manager::initialize_hotkey_manager(&window)
}

#[tauri::command]
async fn register_privacy_hotkey(
    action_id: String,
    name: String,
    description: String,
    action_type: String,
    key_combination: String,
) -> Result<(), String> {
    let action = hotkey_manager::HotkeyAction {
        id: action_id,
        name,
        description,
        action_type,
        is_enabled: true,
    };
    
    hotkey_manager::register_hotkey(action, key_combination)
}

#[tauri::command]
fn unregister_privacy_hotkey(action_id: String) -> Result<(), String> {
    hotkey_manager::unregister_hotkey(&action_id)
}

#[tauri::command]
fn get_privacy_hotkeys() -> Result<Vec<(String, hotkey_manager::HotkeyAction)>, String> {
    Ok(hotkey_manager::get_registered_hotkeys())
}

#[tauri::command]
fn execute_privacy_hotkey_action(action_id: String) -> Result<(), String> {
    hotkey_manager::execute_hotkey_action(&action_id)
}

#[tauri::command]
fn toggle_privacy_hotkey(action_id: String) -> Result<bool, String> {
    hotkey_manager::toggle_hotkey(&action_id)
}

#[tauri::command]
fn validate_privacy_hotkey(key_combination: String) -> Result<(), String> {
    hotkey_manager::validate_hotkey_combination(&key_combination)
}

#[tauri::command]
fn is_privacy_hotkey_available(key_combination: String) -> Result<bool, String> {
    hotkey_manager::is_hotkey_available(&key_combination)
}

#[tauri::command]
async fn shutdown_privacy_hotkeys() -> Result<(), String> {
    hotkey_manager::shutdown_hotkey_manager()
}

#[tauri::command]
fn get_privacy_indicators() -> Result<Vec<String>, String> {
    let mut active: Vec<String> = Vec::new();
    if cursor_manager::is_standard_cursor_enabled() { active.push("toggle_standard_cursor".into()); }
    if window_manager::is_always_on_top_enabled() { active.push("toggle_always_on_top".into()); }
    if screen_protection::is_protection_enabled() { active.push("toggle_screen_protection".into()); }
    if hotkey_manager::is_taskbar_hidden() { active.push("toggle_taskbar_visibility".into()); }
    Ok(active)
}

/// Opt the process out of Windows power throttling (EcoQoS) and raise its
/// priority class. A `windows_subsystem = "windows"` GUI app gets throttled
/// onto efficiency cores at reduced clocks when it runs in the background
/// (e.g. while Zoom/Teams is focused) — which makes CPU-bound Whisper
/// inference several times slower than in `tauri dev` (a console process).
/// Disabling EXECUTION_SPEED throttling keeps inference at full clocks.
#[cfg(target_os = "windows")]
fn optimize_process_for_cpu() {
  use windows::Win32::System::Threading::{
    GetCurrentProcess, SetPriorityClass, SetProcessInformation, ProcessPowerThrottling,
    HIGH_PRIORITY_CLASS, PROCESS_POWER_THROTTLING_CURRENT_VERSION,
    PROCESS_POWER_THROTTLING_EXECUTION_SPEED, PROCESS_POWER_THROTTLING_STATE,
  };
  unsafe {
    let state = PROCESS_POWER_THROTTLING_STATE {
      Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
      ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
      // StateMask = 0 → throttling DISABLED: always run at full speed.
      StateMask: 0,
    };
    let _ = SetProcessInformation(
      GetCurrentProcess(),
      ProcessPowerThrottling,
      &state as *const _ as *const core::ffi::c_void,
      std::mem::size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
    );
    let _ = SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
  }
}

#[cfg(not(target_os = "windows"))]
fn optimize_process_for_cpu() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  optimize_process_for_cpu();

  let event_handler = WindowEventHandler::new();
  let event_handler_clone1 = event_handler.clone();
  let event_handler_clone2 = event_handler.clone();

  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
          use tauri::Emitter;
          use tauri_plugin_global_shortcut::{ShortcutState, Modifiers, Code};
          let is_ctrl = shortcut.mods.contains(Modifiers::CONTROL);
          let is_alt = shortcut.mods.contains(Modifiers::ALT);
          let is_space = shortcut.key == Code::Space;
          let is_s = shortcut.key == Code::KeyS;

          if is_ctrl && is_alt && is_space {
            let event_name = match event.state() {
              ShortcutState::Pressed => "ptt_start",
              ShortcutState::Released => "ptt_stop",
            };
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.emit(event_name, ());
            }
          }

          if is_ctrl && is_alt && is_s {
            if event.state() == ShortcutState::Pressed {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("screenshot_analyze", ());
              }
            }
          }
        })
        .build()
    )
    .manage(event_handler) // Регистрируем обработчик как состояние
    .invoke_handler(tauri::generate_handler![
      greet, 
      write_file, 
      read_file, 
      create_chat_session,
      get_chat_session,
      list_chat_sessions,
      delete_chat_session,
      rename_chat_session,
      update_chat_context,
      send_message,
      ai_proxy_request,
      ai_proxy_stream,
      http_proxy_get,
      http_proxy_post,
      save_assistant_message,
      get_chat_messages,
      get_settings,
      save_settings,
      reset_settings,
      open_auth_url,
      logout_user,
      set_auth_status,
      add_analytics_response,
      get_analytics_responses,
      get_analytics_stats,
      rate_response,
      clear_analytics,
      get_privacy_settings,
      save_privacy_settings,
      hide_from_taskbar,
      show_in_taskbar,
      minimize_to_tray,
      restore_from_tray,
      hide_from_screen_sharing,
      show_in_screen_sharing,
      set_protection_mode,
      is_protection_enabled,
      close_window, 
      minimize_window, 
      maximize_window, 
      unmaximize_window, 
      is_maximized,
      open_legend_window,
      dock_legend_window,
      list_obsidian_notes,
      read_obsidian_note,
      get_ai_response,
      get_hotkey_settings,
      save_hotkey_settings,
      add_hotkey_binding,
      update_hotkey_binding,
      delete_hotkey_binding,
      toggle_hotkey_binding,
      start_audio_recording,
      stop_audio_recording,
      get_recording_state,
      register_hotkey,
      unregister_hotkey,
      execute_hotkey_action,
      get_available_audio_devices,
      set_audio_device,
      get_recording_history,
      delete_recording,
      get_app_version,
      restart_hotkey_system,
      set_standard_cursor,
      toggle_standard_cursor,
      is_standard_cursor_enabled,
      handle_window_message,
      set_always_on_top,
      toggle_always_on_top,
      is_always_on_top_enabled,
      initialize_privacy_hotkeys,
      register_privacy_hotkey,
      unregister_privacy_hotkey,
      get_privacy_hotkeys,
      toggle_privacy_hotkey,
      validate_privacy_hotkey,
      is_privacy_hotkey_available,
      shutdown_privacy_hotkeys,
      execute_privacy_hotkey_action,
      get_privacy_indicators,
      capture_screenshot,
      whisper_commands::whisper_initialize,
      whisper_commands::whisper_transcribe,
      whisper_commands::whisper_get_installed_models,
      whisper_commands::whisper_is_model_available,
      whisper_commands::whisper_download_model,
      audio_recorder::recorder_start,
      audio_recorder::recorder_stop_and_transcribe
    ])
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // Initialize hotkey system
      println!("Hotkey system initialized");

      // Load persisted chat sessions from disk so the user keeps history across app restarts.
      load_chat_sessions_from_disk();
      // Eagerly initialize the background persistence writer thread.
      let _ = &*CHAT_PERSIST_TX;

      // Register global PTT shortcut Ctrl+Alt+Space
      use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
      use std::str::FromStr;
      match Shortcut::from_str("Ctrl+Alt+Space") {
        Ok(ptt_shortcut) => {
          if let Err(e) = app.handle().global_shortcut().register(ptt_shortcut) {
            println!("Warning: could not register PTT shortcut: {}", e);
          } else {
            println!("PTT shortcut Ctrl+Alt+Space registered globally");
          }
        }
        Err(e) => println!("Warning: could not parse PTT shortcut: {}", e),
      }

      match Shortcut::from_str("Ctrl+Alt+S") {
        Ok(sc) => {
          if let Err(e) = app.handle().global_shortcut().register(sc) {
            println!("Warning: could not register screenshot shortcut: {}", e);
          } else {
            println!("Screenshot shortcut Ctrl+Alt+S registered globally");
          }
        }
        Err(e) => println!("Warning: could not parse screenshot shortcut: {}", e),
      }
      
      // Apply standard cursor setting if needed
      let window = app.get_webview_window("main").expect("main window not found");
      
      // Get privacy settings and apply standard cursor if enabled
      let privacy_settings = get_privacy_settings().unwrap_or_default();
      if privacy_settings.standard_cursor {
        println!("Applying standard cursor on startup");
        let _ = cursor_manager::enable_standard_cursor(&window);
        
        // Обновляем состояние в обработчике событий
        *event_handler_clone1.standard_cursor_enabled.lock().unwrap() = true;
      }
      
      // Set up resize listener for standard cursor
      let _ = cursor_manager::setup_resize_listener(&window);
      
      // Initialize privacy hotkeys manager
      if let Err(e) = hotkey_manager::initialize_hotkey_manager(&window) {
          println!("Предупреждение: не удалось инициализировать менеджер горячих клавиш Privacy: {}", e);
      }
      
      println!("Приложение интервью-ассистента запущено");

      // Pre-warm Whisper model in a background thread so the first PTT press
      // is instant instead of waiting 1–3s for model load.
      #[cfg(feature = "transcription")]
      {
        std::thread::spawn(|| {
          let models_dir = std::env::current_dir().unwrap_or_default().join("models");
          let tiny = models_dir.join("ggml-tiny.bin");
          let base = models_dir.join("ggml-base.bin");
          let small = models_dir.join("ggml-small.bin");
          let path = if tiny.exists() { tiny }
            else if base.exists() { base }
            else if small.exists() { small }
            else { return; };
          println!("[prewarm] Loading Whisper from {:?}...", path);
          match audio_transcriber::SystemAudioTranscriber::new_with_path(&path) {
            Ok(t) => {
              audio_recorder::set_prewarmed_transcriber(std::sync::Arc::new(t));
              println!("[prewarm] Whisper ready");
            }
            Err(e) => println!("[prewarm] Whisper load failed: {}", e),
          }
        });
      }

      Ok(())
    })
    // Добавляем обработчик событий приложения
    .on_window_event(move |window, event| {
      // Окно легенды объявлено в конфиге и пряталось при показе. Если позволить
      // закрытию уничтожить его, повторное открытие уйдёт в рантайм-сборку
      // прозрачного окна → баг с белым экраном. Поэтому закрытие = скрытие.
      if window.label() == legend_window::LEGEND_LABEL {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
          api.prevent_close();
          let _ = window.hide();
          return;
        }
      }
      event_handler_clone2.on_window_event(event.clone());
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
