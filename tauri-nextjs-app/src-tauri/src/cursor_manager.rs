use std::ptr::null_mut;
use tauri::WebviewWindow;
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::thread;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "windows")]
use winapi::{

    um::winuser::{
        SetClassLongPtrW, GCLP_HCURSOR, LoadCursorW, IDC_ARROW,
        SetWindowPos, SWP_FRAMECHANGED, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER,
        SetCursor, GetCursorPos, WindowFromPoint, GetWindowThreadProcessId,
        SetWindowLongPtrW, GWLP_WNDPROC, CallWindowProcW,
        WM_SETCURSOR, WM_NCHITTEST, HTCLIENT, HTTOP, HTTOPLEFT, HTTOPRIGHT,
        WM_NCMOUSEMOVE, HTCAPTION, GetWindowLongW, SetWindowLongW, GWL_STYLE
    },

    shared::windef::{HWND, POINT},
    shared::minwindef::{WPARAM, LPARAM, LRESULT, DWORD},
};

static STANDARD_CURSOR_ENABLED: Lazy<RwLock<bool>> = Lazy::new(|| {
    RwLock::new(false)
});

static ARROW_CURSOR: Lazy<RwLock<isize>> = Lazy::new(|| {
    RwLock::new(0)
});

static MONITOR_THREAD_RUNNING: Lazy<AtomicBool> = Lazy::new(|| {
    AtomicBool::new(false)
});

static APP_HWND: Lazy<RwLock<isize>> = Lazy::new(|| {
    RwLock::new(0)
});

static APP_PROCESS_ID: Lazy<RwLock<DWORD>> = Lazy::new(|| {
    RwLock::new(0)
});

static ORIGINAL_WNDPROC: Lazy<RwLock<isize>> = Lazy::new(|| {
    RwLock::new(0)
});

#[cfg(target_os = "windows")]
fn set_all_cursors_to_arrow() {
    unsafe {
        let arrow_cursor = LoadCursorW(null_mut(), IDC_ARROW);
        if arrow_cursor.is_null() {
            println!("Не удалось загрузить курсор стрелки");
            return;
        }

        *ARROW_CURSOR.write() = arrow_cursor as isize;
        println!("Курсор стрелки загружен: {:p}", arrow_cursor);
    }
}

#[cfg(target_os = "windows")]
fn restore_system_cursors() {
    // Ничего не делаем, так как мы не меняли системные курсоры
}

#[cfg(target_os = "windows")]
unsafe fn is_app_window(hwnd: HWND) -> bool {
    // Проверяем, является ли окно нашим приложением
    let app_hwnd = *APP_HWND.read() as HWND;
    if app_hwnd == hwnd {
        return true;
    }
    
    // Проверяем, принадлежит ли окно нашему процессу
    let app_pid = *APP_PROCESS_ID.read();
    if app_pid != 0 {
        let mut window_pid: DWORD = 0;
        GetWindowThreadProcessId(hwnd, &mut window_pid);
        if window_pid == app_pid {
            return true;
        }
    }
    
    false
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn custom_wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    let original_wndproc = *ORIGINAL_WNDPROC.read();
    
    // Приоритизируем обработку сообщений для верхней грани
    match msg {
        WM_NCHITTEST => {
            // Если включен стандартный курсор, перехватываем определение области верхней грани
            if *STANDARD_CURSOR_ENABLED.read() {
                // Получаем результат стандартной обработки
                let result = CallWindowProcW(
                    std::mem::transmute(original_wndproc), 
                    hwnd, 
                    msg, 
                    wparam, 
                    lparam
                );
                
                // Если это верхняя грань или её углы, возвращаем HTCAPTION
                // Это заставит систему использовать курсор как для заголовка окна (стрелка)
                let hit_result = result as i32;
                if hit_result == HTTOP as i32 || hit_result == HTTOPLEFT as i32 || hit_result == HTTOPRIGHT as i32 {
                    // Устанавливаем курсор стрелки
                    let arrow_cursor = LoadCursorW(null_mut(), IDC_ARROW);
                    if !arrow_cursor.is_null() {
                        SetCursor(arrow_cursor);
                    }
                    
                    // Возвращаем HTCAPTION вместо оригинального результата
                    return HTCAPTION as LRESULT;
                }
                
                return result;
            }
            
            // Если стандартный курсор отключен, используем стандартную обработку
            return CallWindowProcW(
                std::mem::transmute(original_wndproc),
                hwnd, 
                msg, 
                wparam, 
                lparam
            );
        },
        WM_SETCURSOR => {
            if *STANDARD_CURSOR_ENABLED.read() {
                // Получаем результат стандартной обработки для определения области
                let hit_test = (lparam & 0xFFFF) as i32;
                
                // Если курсор находится на верхней рамке или в углах верхней рамки
                // Немедленно устанавливаем курсор стрелки без дополнительных проверок
                if hit_test == HTTOP as i32 || hit_test == HTTOPLEFT as i32 || hit_test == HTTOPRIGHT as i32 || hit_test == HTCAPTION as i32 {
                    // Принудительно устанавливаем курсор стрелки
                    force_arrow_cursor();
                    
                    // Немедленно устанавливаем еще раз для гарантии
                    let arrow_cursor = LoadCursorW(null_mut(), IDC_ARROW);
                    if !arrow_cursor.is_null() {
                        SetCursor(arrow_cursor);
                    }
                    
                    // Возвращаем 1, чтобы указать, что сообщение обработано
                    return 1;
                }
                
                // Для других областей окна также устанавливаем стрелку
                if hit_test != HTCLIENT as i32 {
                    force_arrow_cursor();
                    return 1;
                }
            }
        },
        WM_NCMOUSEMOVE => {
            // При движении мыши в non-client area проверяем, где именно находится курсор
            let hit_test = wparam as i32;
            
            // Если курсор на верхней рамке или в её углах и включен стандартный курсор
            if (hit_test == HTTOP as i32 || hit_test == HTTOPLEFT as i32 || hit_test == HTTOPRIGHT as i32 || hit_test == HTCAPTION as i32) && 
               *STANDARD_CURSOR_ENABLED.read() {
                force_arrow_cursor();
                
                // Немедленно устанавливаем еще раз для гарантии
                let arrow_cursor = LoadCursorW(null_mut(), IDC_ARROW);
                if !arrow_cursor.is_null() {
                    SetCursor(arrow_cursor);
                }
            }
        },
        _ => {}
    }
    
    // Вызываем оригинальную оконную процедуру
    return CallWindowProcW(
        std::mem::transmute(original_wndproc),
        hwnd, 
        msg, 
        wparam, 
        lparam
    );
}

#[cfg(target_os = "windows")]
fn install_window_proc(hwnd: HWND) {
    unsafe {
        // Сохраняем хэндл окна приложения
        *APP_HWND.write() = hwnd as isize;
        
        // Сохраняем идентификатор процесса
        let mut process_id: DWORD = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        *APP_PROCESS_ID.write() = process_id;
        
        println!("Установка перехвата оконной процедуры для окна: {:p}, процесс: {}", hwnd, process_id);
        
        // Заменяем оконную процедуру
        let original_wndproc = SetWindowLongPtrW(
            hwnd,
            GWLP_WNDPROC,
            custom_wndproc as isize
        );
        
        if original_wndproc != 0 {
            *ORIGINAL_WNDPROC.write() = original_wndproc;
            println!("Оконная процедура успешно заменена, оригинальная процедура: {:p}", original_wndproc as *const ());
        } else {
            println!("Не удалось заменить оконную процедуру: {}", std::io::Error::last_os_error());
        }
    }
}

#[cfg(target_os = "windows")]
fn uninstall_window_proc() {
    unsafe {
        let hwnd = *APP_HWND.read() as HWND;
        let original_wndproc = *ORIGINAL_WNDPROC.read();
        
        if !hwnd.is_null() && original_wndproc != 0 {
            let result = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, original_wndproc);
            if result != 0 {
                println!("Восстановлена оригинальная оконная процедура");
            } else {
                println!("Не удалось восстановить оригинальную оконную процедуру: {}", std::io::Error::last_os_error());
            }
        }
        
        // Очищаем сохраненные хэндлы
        *APP_HWND.write() = 0;
        *APP_PROCESS_ID.write() = 0;
        *ORIGINAL_WNDPROC.write() = 0;
    }
}

#[cfg(target_os = "windows")]
fn set_window_properties(hwnd: HWND) {
    unsafe {
        // Устанавливаем класс курсора для окна
        let h_cursor = LoadCursorW(null_mut(), IDC_ARROW);
        SetClassLongPtrW(hwnd, GCLP_HCURSOR, h_cursor as isize);
        
        // Обновляем окно, чтобы изменения вступили в силу
        SetWindowPos(
            hwnd,
            null_mut(),
            0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED
        );
        
        println!("Установлены свойства окна для стандартного курсора");
    }
}

#[cfg(target_os = "windows")]
fn force_arrow_cursor() {
    unsafe {    
        // Загружаем курсор стрелки напрямую
        let default_arrow = LoadCursorW(null_mut(), IDC_ARROW);
        if !default_arrow.is_null() {
            // Устанавливаем курсор стрелки
            SetCursor(default_arrow);
            
            // Сохраняем курсор для будущего использования
            *ARROW_CURSOR.write() = default_arrow as isize;
            
            // Дополнительно вызываем SetClassLongPtrW для установки курсора класса окна
            let hwnd = *APP_HWND.read() as HWND;
            if !hwnd.is_null() {
                SetClassLongPtrW(hwnd, GCLP_HCURSOR, default_arrow as isize);
                
                // Обновляем окно для применения изменений
                SetWindowPos(
                    hwnd,
                    null_mut(),
                    0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED
                );
            }
        } else {
            // Если не удалось загрузить новый курсор, попробуем использовать сохраненный
            let arrow_cursor = *ARROW_CURSOR.read() as *mut _;
            if arrow_cursor != null_mut() {
                SetCursor(arrow_cursor);
            }
        }
    }
}

// Публичная функция для вызова из других модулей
#[cfg(target_os = "windows")]
pub fn force_arrow_cursor_manually() {
    force_arrow_cursor();
}

// Пустая реализация для не-Windows платформ
#[cfg(not(target_os = "windows"))]
pub fn force_arrow_cursor_manually() {
    // Ничего не делаем на не-Windows платформах
}

#[cfg(target_os = "windows")]
fn setup_top_border_handling(hwnd: HWND) {
    unsafe {
        // Устанавливаем специальные стили окна для обработки верхней рамки
        
        // Получаем текущие стили окна
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        
        // Сохраняем текущие стили окна, но модифицируем обработку через наш перехватчик
        SetWindowLongW(hwnd, GWL_STYLE, style);
        
        // Обновляем окно для применения изменений
        SetWindowPos(
            hwnd,
            null_mut(),
            0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED
        );
        
        println!("Настроена специальная обработка верхней рамки окна");
    }
}

pub fn enable_standard_cursor(window: &WebviewWindow) -> Result<(), String> {
    let mut enabled = STANDARD_CURSOR_ENABLED.write();
    
    if *enabled {
        return Ok(());
    }
    
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            let hwnd = hwnd.0 as HWND;
            set_all_cursors_to_arrow();
            
            // Устанавливаем свойства окна
            set_window_properties(hwnd);
            
            // Настраиваем специальную обработку верхней рамки
            setup_top_border_handling(hwnd);
            
            // Устанавливаем перехват оконной процедуры
            install_window_proc(hwnd);
            
            // Запускаем поток мониторинга курсора
            start_cursor_monitor();
            
            // Принудительно устанавливаем курсор стрелки
            force_arrow_cursor();
            
            // Дополнительно запускаем отложенную установку курсора
            // для случаев, когда система может переопределить наш курсор
            std::thread::spawn(move || {
                for i in 0..000000001 {
                    std::thread::sleep(std::time::Duration::from_millis(i * 1000));
                    force_arrow_cursor_manually();
                }
            });
        }
    }
    
    *enabled = true;
    println!("Standard cursor mode enabled for app window");
    Ok(())
}

pub fn disable_standard_cursor(_window: &WebviewWindow) -> Result<(), String> {
    let mut enabled = STANDARD_CURSOR_ENABLED.write();
    
    if !*enabled {
        return Ok(());
    }
    
    // Остановка мониторингового потока
    MONITOR_THREAD_RUNNING.store(false, Ordering::SeqCst);
    
    // Даем потоку время на завершение
    thread::sleep(Duration::from_millis(50));
    
    #[cfg(target_os = "windows")]
    {
        uninstall_window_proc();
        
        // Сбрасываем хранимый курсор
        *ARROW_CURSOR.write() = 0;
    }
    
    *enabled = false;
    println!("Standard cursor mode disabled");
    Ok(())
}

pub fn toggle_standard_cursor(window: &WebviewWindow) -> Result<bool, String> {
    let enabled = *STANDARD_CURSOR_ENABLED.read();
    
    if enabled {
        disable_standard_cursor(window)?;
        Ok(false)
    } else {
        enable_standard_cursor(window)?;
        Ok(true)
    }
}

pub fn is_standard_cursor_enabled() -> bool {
    *STANDARD_CURSOR_ENABLED.read()
}

pub fn setup_resize_listener(_window: &WebviewWindow) -> Result<(), String> {
    println!("Resize monitoring setup for app window");
    Ok(())
}

#[cfg(target_os = "windows")]
fn prevent_resize_cursor_on_top_border() {
    unsafe {
        // Создаем отдельный поток для постоянного мониторинга курсора на верхней рамке
        std::thread::spawn(|| {
            // Загружаем стандартный курсор стрелки
            let arrow_cursor = LoadCursorW(null_mut(), IDC_ARROW);
            
            // Бесконечный цикл для мониторинга
            while MONITOR_THREAD_RUNNING.load(Ordering::SeqCst) && *STANDARD_CURSOR_ENABLED.read() {
                // Получаем текущую позицию курсора
                let mut cursor_pos: POINT = std::mem::zeroed();
                if GetCursorPos(&mut cursor_pos) != 0 {
                    // Получаем окно под курсором
                    let hwnd = WindowFromPoint(cursor_pos);
                    
                    // Проверяем, является ли это окно нашим приложением
                    if !hwnd.is_null() && is_app_window(hwnd) {
                        // Получаем размеры окна
                        let mut rect = std::mem::zeroed();
                        if winapi::um::winuser::GetWindowRect(hwnd, &mut rect) != 0 {
                            // Проверяем, находится ли курсор в верхней части окна (5 пикселей от верхнего края)
                            let top_border_height = 5;
                            if cursor_pos.y >= rect.top && cursor_pos.y <= rect.top + top_border_height {
                                // Если курсор находится на верхней рамке, принудительно устанавливаем стрелку
                                if !arrow_cursor.is_null() {
                                    SetCursor(arrow_cursor);
                                }
                            }
                        }
                    }
                }
                
                // Спим минимальное время
                std::thread::sleep(std::time::Duration::from_millis(1));
            }
        });
    }
}

#[cfg(target_os = "windows")]
fn start_cursor_monitor() {
    if MONITOR_THREAD_RUNNING.load(Ordering::SeqCst) {
        return;
    }
    
    MONITOR_THREAD_RUNNING.store(true, Ordering::SeqCst);
    
    // Запускаем специальный поток для предотвращения курсора ресайза на верхней рамке
    prevent_resize_cursor_on_top_border();
    
    // Создаем отдельный поток для мониторинга курсора
    thread::spawn(move || {
        println!("Поток мониторинга курсора запущен");
        
        // Загружаем стандартный курсор стрелки для сравнения
        let standard_arrow = unsafe { LoadCursorW(null_mut(), IDC_ARROW) };
        
        let mut last_check_time = std::time::Instant::now();
        
        while MONITOR_THREAD_RUNNING.load(Ordering::SeqCst) && *STANDARD_CURSOR_ENABLED.read() {
            // Проверяем позицию курсора
            unsafe {
                let mut cursor_pos: POINT = std::mem::zeroed();
                if GetCursorPos(&mut cursor_pos) != 0 {
                    let hwnd = WindowFromPoint(cursor_pos);
                    if !hwnd.is_null() && is_app_window(hwnd) {
                        // Определяем, находится ли курсор на верхней рамке окна
                        let app_hwnd = *APP_HWND.read() as HWND;
                        if !app_hwnd.is_null() {
                            // Преобразуем координаты экрана в координаты окна
                            let lparam = ((cursor_pos.y as i32) << 16) | (cursor_pos.x as i32 & 0xFFFF);
                            
                            // Вызываем SendMessage для получения результата хит-теста
                            let hit_test = winapi::um::winuser::SendMessageW(
                                app_hwnd,
                                WM_NCHITTEST,
                                0,
                                lparam as LPARAM
                            );

                            // Если курсор находится на верхней рамке, в её углах или в заголовке
                            if hit_test == HTTOP as LRESULT || 
                               hit_test == HTTOPLEFT as LRESULT || 
                               hit_test == HTTOPRIGHT as LRESULT || 
                               hit_test == HTCAPTION as LRESULT {
                                // Проверяем, не прошло ли достаточно времени с последней проверки
                                let now = std::time::Instant::now();
                                if now.duration_since(last_check_time) > Duration::from_millis(1) { // Еще больше уменьшаем интервал
                                    // Принудительно устанавливаем курсор стрелки
                                    if !standard_arrow.is_null() {
                                        SetCursor(standard_arrow); // Используем сохраненный курсор для скорости
                                    } else {
                                        force_arrow_cursor();
                                    }
                                    last_check_time = now;
                                }
                            }
                        }
                    }
                }
            }

            // Спим минимальное время для максимальной отзывчивости
            thread::sleep(Duration::from_millis(1));
        }

        println!("Поток мониторинга курсора остановлен");
    });
}

// Функция для обработки сообщений Windows, которая будет вызываться из JavaScript
pub fn handle_window_message(message_type: &str) -> Result<(), String> {
    if *STANDARD_CURSOR_ENABLED.read() {
        match message_type {
            "mousemove" | "mouseover" | "mouseenter" => {
                #[cfg(target_os = "windows")]
                {
                   force_arrow_cursor();
                }
            },
            "resize" | "resizestart" | "resizeend" => {
                #[cfg(target_os = "windows")]
                {
                    // При событиях изменения размера принудительно устанавливаем курсор стрелки
                    force_arrow_cursor();
                    
                    // Дополнительно запускаем отложенную установку курсора
                    std::thread::spawn(|| {
                        std::thread::sleep(std::time::Duration::from_millis(1));
                        force_arrow_cursor_manually();
                        
                        std::thread::sleep(std::time::Duration::from_millis(5));
                        force_arrow_cursor_manually();
                        
                        std::thread::sleep(std::time::Duration::from_millis(10));
                        force_arrow_cursor_manually();
                    });
                }
            },
            "titlebar_mouseenter" | "titlebar_mousemove" => {
                #[cfg(target_os = "windows")]
                {
                    // Принудительно устанавливаем курсор стрелки при событиях в области заголовка
                    force_arrow_cursor();
                }
            },
            "top_border" => {
                #[cfg(target_os = "windows")]
                unsafe {
                    // Специальная обработка для верхней рамки - мгновенная установка курсора
                    let arrow_cursor = LoadCursorW(null_mut(), IDC_ARROW);
                    if !arrow_cursor.is_null() {
                        SetCursor(arrow_cursor);
                    }
                    
                    // Также вызываем обычную функцию
                    force_arrow_cursor();
                    
                    // Запускаем серию быстрых обновлений курсора
                    std::thread::spawn(|| {
                        for i in 0..000000001 {
                            std::thread::sleep(std::time::Duration::from_millis(i));
                            force_arrow_cursor_manually();
                        }
                    });
                }
            },

            _=> {
                println!("Обработано сообщение: {}", message_type);
            }
        }
    }
    Ok(())
} 