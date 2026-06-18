use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use tauri::{AppHandle, WebviewWindow, Manager, Emitter};
use tauri_plugin_global_shortcut::{
    GlobalShortcutExt, Shortcut, Modifiers as GSModifiers, Code as GSCode,
    ShortcutEvent as GSShortcutEvent, ShortcutState as GSShortcutState
};
use serde::{Serialize, Deserialize};
use std::time::{Instant, Duration};
use std::sync::mpsc::{channel, Sender, Receiver};

use crate::{cursor_manager, window_manager, screen_protection, popup, window_behavior};
#[cfg(feature = "transcription")]
use crate::audio_transcriber;

// Нормализация строковой комбинации (Ctrl+Shift+X -> Ctrl+X)
fn normalize_combo_str(combo: &str) -> String {
    combo.replace("Ctrl+Shift+", "Ctrl+")
}

// Структуры для управления горячими клавишами
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyAction {
    pub id: String,
    pub name: String,
    pub description: String,
    pub action_type: String,
    pub is_enabled: bool,
}

// Простое глобальное состояние для горячих клавиш
static REGISTERED_HOTKEYS: Lazy<RwLock<HashMap<String, (String, HotkeyAction)>>> = Lazy::new(|| {
    RwLock::new(HashMap::new())
});

// Последние срабатывания (оставлено для возможной телеметрии/диагностики, не используется для троттлинга)
static LAST_TRIGGERED_AT: Lazy<RwLock<HashMap<String, Instant>>> = Lazy::new(|| {
    RwLock::new(HashMap::new())
});

// Флаги выполнения действий, чтобы исключить параллельные вызовы одного и того же действия
static ACTION_IN_PROGRESS: Lazy<RwLock<HashMap<String, bool>>> = Lazy::new(|| {
    RwLock::new(HashMap::new())
});

// Очередь для последовательной обработки действий
static ACTION_TX: Lazy<RwLock<Option<Sender<String>>>> = Lazy::new(|| {
    RwLock::new(None)
});
static ACTION_WORKER_STARTED: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));

// Состояние видимости в панели задач
static TASKBAR_HIDDEN: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));

pub fn is_taskbar_hidden() -> bool {
    TASKBAR_HIDDEN.load(Ordering::SeqCst)
}

pub fn set_taskbar_hidden(hidden: bool) {
    TASKBAR_HIDDEN.store(hidden, Ordering::SeqCst);
}

static HOTKEY_THREAD_RUNNING: Lazy<AtomicBool> = Lazy::new(|| {
    AtomicBool::new(false)
});

static WINDOW_HANDLE: Lazy<RwLock<Option<WebviewWindow>>> = Lazy::new(|| {
    RwLock::new(None)
});

// Инициализация менеджера горячих клавиш
pub fn initialize_hotkey_manager(window: &WebviewWindow) -> Result<(), String> {
    *WINDOW_HANDLE.write() = Some(window.clone());
    
    // дефолтные горячие клавиши для Privacy функций
    register_default_privacy_hotkeys()?;
    
    // Запуск воркера последовательной обработки действий
    if !ACTION_WORKER_STARTED.load(Ordering::SeqCst) {
        let (tx, rx): (Sender<String>, Receiver<String>) = channel();
        *ACTION_TX.write() = Some(tx);
        ACTION_WORKER_STARTED.store(true, Ordering::SeqCst);

        std::thread::spawn(move || {
            while let Ok(action_type) = rx.recv() {
                if let Ok(handle) = app_handle() {
                    let action_type_for_main = action_type.clone();
                    let _ = handle.run_on_main_thread(move || {
                        let _ = execute_privacy_action(&action_type_for_main);
                        let mut in_progress = ACTION_IN_PROGRESS.write();
                        in_progress.insert(action_type_for_main, false);
                    });
                } else {
                    let _ = execute_privacy_action(&action_type);
                    let mut in_progress = ACTION_IN_PROGRESS.write();
                    in_progress.insert(action_type, false);
                }
            }
        });
    }
    
    Ok(())
}

fn app_handle() -> Result<AppHandle, String> {
    let window = WINDOW_HANDLE.read();
    let window = window.as_ref().ok_or("Окно не найдено")?.clone();
    Ok(window.app_handle().clone())
}

// Регистрация дефолтных горячих клавиш для функций Privacy
fn register_default_privacy_hotkeys() -> Result<(), String> {
    let privacy_actions = vec![
        HotkeyAction {
            id: "toggle_standard_cursor".to_string(),
            name: "Переключить стандартный курсор".to_string(),
            description: "Включает/отключает режим стандартного курсора".to_string(),
            action_type: "toggle_standard_cursor".to_string(),
            is_enabled: true,
        },
        HotkeyAction {
            id: "toggle_always_on_top".to_string(),
            name: "Переключить режим 'Поверх всех окон'".to_string(),
            description: "Включает/отключает режим поверх всех окон".to_string(),
            action_type: "toggle_always_on_top".to_string(),
            is_enabled: true,
        },
        HotkeyAction {
            id: "toggle_screen_protection".to_string(),
            name: "Переключить защиту от захвата экрана".to_string(),
            description: "Включает/отключает защиту от демонстрации экрана".to_string(),
            action_type: "toggle_screen_protection".to_string(),
            is_enabled: true,
        },
        HotkeyAction {
            id: "toggle_taskbar_visibility".to_string(),
            name: "Переключить видимость в панели задач".to_string(),
            description: "Скрывает/показывает приложение в панели задач".to_string(),
            action_type: "toggle_taskbar_visibility".to_string(),
            is_enabled: true,
        },
        HotkeyAction {
            id: "transcribe_system_audio".to_string(),
            name: "Транскрибировать системный звук".to_string(),
            description: "Короткая запись системного звука и вставка текста в чат".to_string(),
            action_type: "transcribe_system_audio".to_string(),
            is_enabled: true,
        },
        HotkeyAction {
            id: "open_popup_window".to_string(),
            name: "Открыть всплывающее окно".to_string(),
            description: "Открывает/фокусирует отдельное окно приложения (popup)".to_string(),
            action_type: "open_popup_window".to_string(),
            is_enabled: true,
        },
        HotkeyAction {
            id: "toggle_maximizable".to_string(),
            name: "Переключить возможность максимизации".to_string(),
            description: "Вкл/выкл maximize (влияет на Snap)".to_string(),
            action_type: "toggle_maximizable".to_string(),
            is_enabled: true,
        },
    ];

    // Дефолтные комбинации клавиш (только Ctrl + Key)
    let default_combinations = vec![
        ("toggle_standard_cursor", "Ctrl+1"),
        ("toggle_always_on_top", "Ctrl+2"),
        ("toggle_screen_protection", "Ctrl+3"),
        ("toggle_taskbar_visibility", "Ctrl+4"),
        ("transcribe_system_audio", "Ctrl+5"),
        ("open_popup_window", "Ctrl+6"),
        ("toggle_maximizable", "Ctrl+7"),
    ];

    for (action_id, key_combo) in default_combinations {
        if let Some(action) = privacy_actions.iter().find(|a| a.id == action_id) {
            register_hotkey_internal(action.clone(), key_combo.to_string())?;
        }
    }
    Ok(())
}

// Выполнение действия по ID (вызывается из фронтенда)
pub fn execute_hotkey_action(action_id: &str) -> Result<(), String> {
    let registered = REGISTERED_HOTKEYS.read();
    
    if let Some((_, action)) = registered.get(action_id) {
        if action.is_enabled {
            println!("Выполнение действия горячей клавиши: {} ({})", action.name, action.action_type);
            execute_privacy_action(&action.action_type)?;
        } else {
            return Err("Горячая клавиша отключена".to_string());
        }
    } else {
        return Err(format!("Действие с ID {} не найдено", action_id));
    }
    
    Ok(())
}

// Выполнение действий Privacy через горячие клавиши
fn execute_privacy_action(action_type: &str) -> Result<(), String> {
    let window = {
        let guard = WINDOW_HANDLE.read();
        guard.as_ref().ok_or("Окно не найдено")?.clone()
    };
    // Получаем дополнительные окна приложения (например, popup) для синхронного применения
    let popup_window = window.app_handle().get_webview_window(crate::popup::POPUP_LABEL);

    match action_type {
        "toggle_standard_cursor" => {
            let current_state = cursor_manager::is_standard_cursor_enabled();
            let new_state = !current_state;
            if new_state { cursor_manager::enable_standard_cursor(&window)?; } else { cursor_manager::disable_standard_cursor(&window)?; }
            if let Some(popup) = popup_window.as_ref() {
                if new_state { cursor_manager::enable_standard_cursor(popup)?; } else { cursor_manager::disable_standard_cursor(popup)?; }
            }
            println!("Стандартный курсор {}", if !current_state { "включен" } else { "отключен" });
        },
        
        "open_popup_window" => {
            if let Ok(handle) = app_handle() {
                let app: tauri::AppHandle = handle.clone();
                let _ = handle.run_on_main_thread(move || {
                    let _ = popup::ensure_popup(&app);
                });
            }
        },
        
        "toggle_always_on_top" => {
            let current_state = window_manager::is_always_on_top_enabled();
            let new_state = !current_state;
            // Применяем ко всем окнам сразу (main, popup, legend).
            window_manager::apply_always_on_top_to_all(window.app_handle(), new_state);
            println!("Режим 'Поверх всех окон' {}", if !current_state { "включен" } else { "отключен" });
        },
        
        "toggle_screen_protection" => {
            let current_state = screen_protection::is_protection_enabled();
            let new_state = !current_state;
            // Применяем ко всем окнам сразу (main, popup, legend).
            screen_protection::apply_to_all(window.app_handle(), new_state)?;
            println!("Защита от захвата экрана {}", if !current_state { "включена" } else { "отключена" });
        },
        
        "toggle_taskbar_visibility" => {
            let new_state = !TASKBAR_HIDDEN.load(Ordering::SeqCst);
            // Применяем ко всем окнам сразу (main, popup, legend).
            window_manager::apply_skip_taskbar_to_all(window.app_handle(), new_state);
            TASKBAR_HIDDEN.store(new_state, Ordering::SeqCst);
            if new_state {
                println!("Приложение скрыто из панели задач");
            } else {
                println!("Приложение показано в панели задач");
            }
        },
        
        "toggle_maximizable" => {
            let new_state = window_behavior::toggle_maximizable(&window)?;
            if let Some(popup) = popup_window.as_ref() {
                let _ = window_behavior::set_maximizable(popup, new_state);
            }
            println!("Maximizable {}", if new_state { "включен" } else { "выключен" });
        },
        
        "quick_hide_app" => {
            window.hide().map_err(|e| e.to_string())?;
            println!("Приложение скрыто");
        },
        
        "transcribe_system_audio" => {
            #[cfg(feature = "transcription")]
            {
                let app_handle = app_handle().unwrap();
                std::thread::spawn(move || {
                    let result = audio_transcriber::SystemAudioTranscriber::new()
                        .and_then(|t| t.capture_and_transcribe());
                    match result {
                        Ok(text) => { let _ = app_handle.emit("transcription_ready", text); },
                        Err(e) => { let _ = app_handle.emit("transcription_ready", format!("Ошибка транскрипции: {}", e)); }
                    }
                });
            }
            #[cfg(not(feature = "transcription"))]
            {
                println!("Feature 'transcription' выключена — транскрипция недоступна");
            }
        },
        
        _ => {
            return Err(format!("Неизвестное действие: {}", action_type));
        }
    }

    Ok(())
}

// Регистрация новой горячей клавиши
pub fn register_hotkey(action: HotkeyAction, key_combination: String) -> Result<(), String> {
    register_hotkey_internal(action, key_combination)
}

fn register_hotkey_internal(action: HotkeyAction, key_combination: String) -> Result<(), String> {
    // Валидируем комбинацию клавиш (поддержка старого формата Ctrl+Shift+Key)
    validate_hotkey_combination(&key_combination)?;

    // Регистрируем через плагин
    let shortcut = parse_shortcut(&key_combination)?;
    let handle = app_handle()?;

    // Если для этого action уже есть регистрация — сперва снимем её
    {
        let reg = REGISTERED_HOTKEYS.read();
        if let Some((old_combo, _)) = reg.get(&action.id) {
            let old_shortcut = parse_shortcut(old_combo)?;
            let _ = handle.global_shortcut().unregister(old_shortcut);
        }
    }

    let action_type = action.action_type.clone();
    handle
        .global_shortcut()
        .on_shortcut(shortcut.clone(), move |_app, _sc, ev: GSShortcutEvent| {
            // Реагируем только на момент нажатия (Pressed), а не на удержание/повтор
            if ev.state() != GSShortcutState::Pressed {
                return;
            }
            // Уведомляем UI (не блокирует)
            if let Some(win) = WINDOW_HANDLE.read().as_ref() {
                let _ = win.app_handle().emit("privacy_hotkey_triggered", action_type.clone());
            }

            // Если действие уже выполняется — не ставим дубликат
            {
                let mut in_progress = ACTION_IN_PROGRESS.write();
                if let Some(true) = in_progress.get(&action_type).copied() {
                    return;
                }
                in_progress.insert(action_type.clone(), true);
            }

            // Для защиты экрана выполняем немедленно (приоритет), чтобы не ждать очередь
            if action_type == "toggle_screen_protection" {
                if let Ok(handle) = app_handle() {
                    let action_for_main = action_type.clone();
                    let _ = handle.run_on_main_thread(move || {
                        let _ = execute_privacy_action(&action_for_main);
                        let mut in_progress = ACTION_IN_PROGRESS.write();
                        in_progress.insert(action_for_main, false);
                    });
                } else {
                    let action_for_exec = action_type.clone();
                    std::thread::spawn(move || {
                        let _ = execute_privacy_action(&action_for_exec);
                        let mut in_progress = ACTION_IN_PROGRESS.write();
                        in_progress.insert(action_for_exec, false);
                    });
                }
            } else {
                // Отправляем действие в очередь для последовательной обработки
                if let Some(tx) = ACTION_TX.read().as_ref().cloned() {
                    let _ = tx.send(action_type.clone());
                } else {
                    // На всякий случай fallback — выполняем напрямую в отдельном потоке
                    let action_for_exec = action_type.clone();
                    std::thread::spawn(move || {
                        let _ = execute_privacy_action(&action_for_exec);
                        let mut in_progress = ACTION_IN_PROGRESS.write();
                        in_progress.insert(action_for_exec, false);
                    });
                }
            }
        })
        .map_err(|e| format!("Не удалось зарегистрировать горячую клавишу: {}", e))?;

    // Сохраняем нормализованную строку в реестре
    let mut registered = REGISTERED_HOTKEYS.write();
    registered.insert(action.id.clone(), (normalize_combo_str(&key_combination), action.clone()));
    
    // println!("Горячая клавиша зарегистрирована: {} для действия '{}'", normalize_combo_str(&key_combination), action.name);
    Ok(())
}

// Отмена регистрации горячей клавиши
pub fn unregister_hotkey(action_id: &str) -> Result<(), String> {
    let handle = app_handle()?;
    let mut registered = REGISTERED_HOTKEYS.write();
    
    if let Some((combo, action)) = registered.remove(action_id) {
        let shortcut = parse_shortcut(&combo)?;
        let _ = handle.global_shortcut().unregister(shortcut);
        println!("Горячая клавиша отменена для действия: {}", action.name);
        Ok(())
    } else {
        Err(format!("Действие с ID {} не найдено", action_id))
    }
}

// Получение списка зарегистрированных горячих клавиш
pub fn get_registered_hotkeys() -> Vec<(String, HotkeyAction)> {
    let registered = REGISTERED_HOTKEYS.read();
    registered.iter()
        .map(|(_, (key_combo, action))| (key_combo.clone(), action.clone()))
        .collect()
}

// Включение/отключение горячей клавиши
pub fn toggle_hotkey(action_id: &str) -> Result<bool, String> {
    let mut registered = REGISTERED_HOTKEYS.write();
    
    if let Some((_, action)) = registered.get_mut(action_id) {
        action.is_enabled = !action.is_enabled;
        println!("Горячая клавиша '{}' {}", action.name, if action.is_enabled { "включена" } else { "отключена" });
        Ok(action.is_enabled)
    } else {
        Err(format!("Действие с ID {} не найдено", action_id))
    }
}

// Остановка менеджера горячих клавиш
pub fn shutdown_hotkey_manager() -> Result<(), String> {
    HOTKEY_THREAD_RUNNING.store(false, Ordering::SeqCst);
    
    // Очищаем все зарегистрированные горячие клавиши
    let handle = app_handle()?;
    let mut registered = REGISTERED_HOTKEYS.write();
    for (combo, _) in registered.values() {
        if let Ok(shortcut) = parse_shortcut(combo) {
            let _ = handle.global_shortcut().unregister(shortcut);
        }
    }
    registered.clear();
    
    println!("Менеджер горячих клавиш остановлен");
    Ok(())
}

// Разбор строки комбинации в Shortcut плагина (поддерживает Ctrl+Key и Ctrl+Shift+Key)
fn parse_shortcut(hotkey_str: &str) -> Result<Shortcut, String> {
    let norm = normalize_combo_str(hotkey_str);
    let parts: Vec<&str> = norm.split('+').collect();
    if parts.len() != 2 {
        return Err("Комбинация должна быть в формате Ctrl+Клавиша".to_string());
    }
    let modifier = parts[0];
    let key_str = parts[1];

    if modifier != "Ctrl" {
        return Err("Разрешён только модификатор Ctrl".to_string());
    }

    let modifiers = GSModifiers::CONTROL;

    let code = match key_str {
        // Буквы
        "A" => GSCode::KeyA, "B" => GSCode::KeyB, "C" => GSCode::KeyC, "D" => GSCode::KeyD,
        "E" => GSCode::KeyE, "F" => GSCode::KeyF, "G" => GSCode::KeyG, "H" => GSCode::KeyH,
        "I" => GSCode::KeyI, "J" => GSCode::KeyJ, "K" => GSCode::KeyK, "L" => GSCode::KeyL,
        "M" => GSCode::KeyM, "N" => GSCode::KeyN, "O" => GSCode::KeyO, "P" => GSCode::KeyP,
        "Q" => GSCode::KeyQ, "R" => GSCode::KeyR, "S" => GSCode::KeyS, "T" => GSCode::KeyT,
        "U" => GSCode::KeyU, "V" => GSCode::KeyV, "W" => GSCode::KeyW, "X" => GSCode::KeyX,
        "Y" => GSCode::KeyY, "Z" => GSCode::KeyZ,
        // Цифры
        "0" => GSCode::Digit0, "1" => GSCode::Digit1, "2" => GSCode::Digit2, "3" => GSCode::Digit3,
        "4" => GSCode::Digit4, "5" => GSCode::Digit5, "6" => GSCode::Digit6, "7" => GSCode::Digit7,
        "8" => GSCode::Digit8, "9" => GSCode::Digit9,
        // Допускаем часть спец-клавиш
        "Space" => GSCode::Space, "Enter" => GSCode::Enter, "Tab" => GSCode::Tab, "Escape" => GSCode::Escape,
        _ => return Err(format!("Неизвестная клавиша: {}", key_str)),
    };

    Ok(Shortcut::new(Some(modifiers), code))
}

// Проверка, доступна ли комбинация клавиш (по нормализованной строке)
pub fn is_hotkey_available(key_combination: &str) -> Result<bool, String> {
    validate_hotkey_combination(key_combination)?;
    let target = normalize_combo_str(key_combination);
    let registered = REGISTERED_HOTKEYS.read();
    for (_, (registered_key_combo, _)) in registered.iter() {
        if *registered_key_combo == target {
            return Ok(false);
        }
    }
    Ok(true)
}

// Валидация комбинации клавиш (допускает старый Ctrl+Shift+Key, нормализует)
pub fn validate_hotkey_combination(key_combination: &str) -> Result<(), String> {
    if key_combination.is_empty() {
        return Err("Комбинация клавиш не может быть пустой".to_string());
    }
    // Пробуем распарсить после нормализации
    let _ = parse_shortcut(key_combination)?;
    Ok(())
} 