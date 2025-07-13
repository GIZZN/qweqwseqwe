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
use std::sync::{Mutex, Arc};

mod cursor_manager;

// Добавим обработчик событий для окна
#[derive(Clone)]
struct WindowEventHandler {
    standard_cursor_enabled: Arc<Mutex<bool>>,
}

impl WindowEventHandler {
    fn new() -> Self {
        Self {
            standard_cursor_enabled: Arc::new(Mutex::new(false)),
        }
    }
}

// Реализуем обработчик событий окна для Tauri
impl WindowEventHandler {
    fn on_window_event(&self, event: tauri::WindowEvent) {
        match event {
            tauri::WindowEvent::Resized(..) => {
                if *self.standard_cursor_enabled.lock().unwrap() {
                    // При изменении размера окна устанавливаем курсор стрелки
                    cursor_manager::force_arrow_cursor_manually();
                    
                    // Делаем небольшую задержку и устанавливаем курсор еще раз,
                    // чтобы обеспечить его отображение даже после обработки системных событий
                    std::thread::spawn(|| {
                        // Несколько попыток с разными интервалами
                        for i in 0..1 {
                            std::thread::sleep(std::time::Duration::from_millis(i * 25));
                            cursor_manager::force_arrow_cursor_manually();
                        }
                    });
                }
            }
            tauri::WindowEvent::Moved(..) => {
                if *self.standard_cursor_enabled.lock().unwrap() {
                    // При перемещении окна устанавливаем курсор стрелки
                    cursor_manager::force_arrow_cursor_manually();
                    
                    // Также делаем отложенную установку
                    std::thread::spawn(|| {
                        std::thread::sleep(std::time::Duration::from_millis(50));
                        cursor_manager::force_arrow_cursor_manually();
                    });
                }
            }
            tauri::WindowEvent::CloseRequested { .. } => {
                // При закрытии окна отключаем стандартный курсор
                *self.standard_cursor_enabled.lock().unwrap() = false;
            }
            _ => {}
        }
    }
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet() {
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

// Команды Tauri для управления чатом
#[tauri::command]
fn create_chat_session(context: String) -> Result<ChatSession, String> {
    let session = ChatSession::new(context);
    let session_id = session.id.clone();
    
    CHAT_SESSIONS.write().insert(session_id, session.clone());
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
    
    Ok(session.clone())
}

#[tauri::command]
fn update_chat_context(session_id: String, context: String) -> Result<ChatSession, String> {
    let mut sessions = CHAT_SESSIONS.write();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    
    session.context = context;
    session.updated_at = Utc::now();
    
    Ok(session.clone())
}

#[tauri::command]
async fn send_message(session_id: String, content: String) -> Result<Message, String> {
    let mut sessions = CHAT_SESSIONS.write();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    // Добавляем сообщение пользователя
    let user_message = session.add_message("user".to_string(), content.clone());

    // Здесь будет вызов ИИ модели
    // Пока используем заглушку
    let ai_response = format!(
        "Ответ на основе контекста:\n\nКонтекст собеседования: {}\n\nВаш вопрос: {}\n\nЭто временный ответ. Здесь будет интегрирована ИИ модель.",
        session.context,
        content
    );
    
    // Добавляем ответ ассистента
    session.add_message("assistant".to_string(), ai_response);

    Ok(user_message)
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
fn open_auth_url() -> Result<(), String> {
    // Здесь будет открытие браузера с URL для авторизации
    // Пока заглушка
    println!("Opening auth URL in browser...");
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
    
    // Проверяем текущее состояние стандартного курсора
    settings.standard_cursor = cursor_manager::is_standard_cursor_enabled();
    
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
async fn hide_from_taskbar(window: tauri::Window) -> Result<(), String> {
    window.set_skip_taskbar(true).map_err(|e| e.to_string())?;
    println!("Приложение скрыто из панели задач");
    Ok(())
}

#[tauri::command]
async fn show_in_taskbar(window: tauri::Window) -> Result<(), String> {
    window.set_skip_taskbar(false).map_err(|e| e.to_string())?;
    println!("Приложение показано в панели задач");
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
async fn hide_from_screen_sharing(window: tauri::Window) -> Result<(), String> {
    // Используем несколько методов для скрытия от захвата экрана
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{
            GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, 
            WS_EX_NOREDIRECTIONBITMAP, SetWindowDisplayAffinity
        };
        use winapi::shared::windef::HWND;
        
        // Определяем константы самостоятельно
        const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;
        
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            unsafe {
                // Метод 1: Устанавливаем WDA_EXCLUDEFROMCAPTURE для исключения из захвата
                SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
                
                // Метод 2: Устанавливаем WS_EX_NOREDIRECTIONBITMAP
                let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_NOREDIRECTIONBITMAP as isize);
            }
        }
    }
    
    println!("Приложение скрыто от демонстрации экрана (используется WDA_EXCLUDEFROMCAPTURE)");
    Ok(())
}

#[tauri::command]
async fn show_in_screen_sharing(window: tauri::Window) -> Result<(), String> {
    // Убираем все флаги скрытия от захвата экрана
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{
            GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, 
            WS_EX_NOREDIRECTIONBITMAP, SetWindowDisplayAffinity
        };
        use winapi::shared::windef::HWND;
        
        // Определяем константы самостоятельно
        const WDA_NONE: u32 = 0x00000000;
        
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            unsafe {
                // Метод 1: Убираем WDA_EXCLUDEFROMCAPTURE
                SetWindowDisplayAffinity(hwnd, WDA_NONE);
                
                // Метод 2: Убираем WS_EX_NOREDIRECTIONBITMAP
                let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style & !(WS_EX_NOREDIRECTIONBITMAP as isize));
            }
        }
    }
    
    println!("Приложение показано в демонстрации экрана");
    Ok(())
}

#[tauri::command]
async fn set_protection_mode(window: tauri::Window, enabled: bool) -> Result<(), String> {
    // Комплексная защита от захвата экрана
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{
            GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, 
            WS_EX_NOREDIRECTIONBITMAP, SetWindowDisplayAffinity,
            ShowWindow, SW_HIDE, SW_SHOW
        };
        use winapi::shared::windef::HWND;
        
        // Определяем константы самостоятельно
        const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;
        const WDA_NONE: u32 = 0x00000000;
        
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            unsafe {
                if enabled {
                    // Включаем защиту
                    SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
                    
                    let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, 
                        ex_style | WS_EX_NOREDIRECTIONBITMAP as isize);
                    
                    // Перерисовываем окно
                    ShowWindow(hwnd, SW_HIDE);
                    ShowWindow(hwnd, SW_SHOW);
                    
                    println!("Защита от захвата экрана ВКЛЮЧЕНА");
                } else {
                    // Отключаем защиту
                    SetWindowDisplayAffinity(hwnd, WDA_NONE);
                    
                    let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, 
                        ex_style & !(WS_EX_NOREDIRECTIONBITMAP as isize));
                    
                    println!("Защита от захвата экрана ОТКЛЮЧЕНА");
                }
            }
        }
    }
    
    Ok(())
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
                    name: "Начать запись аудио".to_string(),
                    description: "Начинает запись звука с устройства".to_string(),
                    key_combination: "Ctrl+Shift+R".to_string(),
                    action_type: "start_audio_recording".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Остановить запись".to_string(),
                    description: "Останавливает текущую запись".to_string(),
                    key_combination: "Ctrl+Shift+S".to_string(),
                    action_type: "stop_recording".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Быстрое скрытие".to_string(),
                    description: "Быстро скрывает приложение".to_string(),
                    key_combination: "Ctrl+Shift+H".to_string(),
                    action_type: "toggle_window_visibility".to_string(),
                    is_enabled: true,
                    created_at: Utc::now(),
                },
                HotkeyBinding {
                    id: Uuid::new_v4().to_string(),
                    name: "Скриншот экрана".to_string(),
                    description: "Делает снимок экрана".to_string(),
                    key_combination: "Ctrl+Shift+P".to_string(),
                    action_type: "take_screenshot".to_string(),
                    is_enabled: false,
                    created_at: Utc::now(),
                }
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

// Global hotkey settings
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let event_handler = WindowEventHandler::new();
  let event_handler_clone1 = event_handler.clone();
  let event_handler_clone2 = event_handler.clone();

  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
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
      close_window, 
      minimize_window, 
      maximize_window, 
      unmaximize_window, 
      is_maximized,
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
      test_hotkey_combination,
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
      handle_window_message
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
      
      println!("Приложение интервью-ассистента запущено");
      Ok(())
    })
    // Добавляем обработчик событий приложения
    .on_window_event(move |_window, event| {
      event_handler_clone2.on_window_event(event.clone());
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
