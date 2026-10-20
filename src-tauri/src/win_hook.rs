// The Windows input hook.
//
// rdev 0.5.3's Windows `listen` installs the low-level hook and then blocks on
// `GetMessageA(null, null, 0, 0)` - a null MSG pointer and no loop. A
// low-level hook is bound to the thread that installed it and is delivered
// through that thread's message queue, so a thread without a real message
// pump loses the hook: the hotkey quietly stops working, with no error
// anywhere. It is not a configuration problem and it cannot be seen from the
// app.
//
// So the hook is installed here, with a proper message pump, and rdev is used
// for what it is good at: the `Key` and `Button` types the rest of the module
// speaks in.
use rdev::{Button, Event, EventType, Key};
use std::ptr::null_mut;
use std::sync::Mutex;
use std::time::SystemTime;
use winapi::shared::minwindef::{DWORD, LPARAM, LRESULT, UINT, WPARAM};
use winapi::um::libloaderapi::GetModuleHandleW;
use winapi::um::winuser::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage, HC_ACTION,
    KBDLLHOOKSTRUCT, MSG, MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_RBUTTONDOWN, WM_RBUTTONUP,
    WM_SYSKEYDOWN, WM_SYSKEYUP, WM_XBUTTONDOWN, WM_XBUTTONUP,
};

type HookCallback = Box<dyn FnMut(Event) + Send>;

/// The callback the hook procedures call. A low-level hook procedure cannot
/// capture anything, so the closure lives here.
static CALLBACK: Mutex<Option<HookCallback>> = Mutex::new(None);

/// The virtual key codes, from the Win32 list. The letters and the number row
/// have no names in winapi, so they are spelled out here, as rdev does.
fn key_from_vk(code: u32) -> Key {
    match code {
        164 => Key::Alt,
        165 => Key::AltGr,
        0x08 => Key::Backspace,
        20 => Key::CapsLock,
        162 => Key::ControlLeft,
        163 => Key::ControlRight,
        46 => Key::Delete,
        40 => Key::DownArrow,
        35 => Key::End,
        27 => Key::Escape,
        112 => Key::F1,
        113 => Key::F2,
        114 => Key::F3,
        115 => Key::F4,
        116 => Key::F5,
        117 => Key::F6,
        118 => Key::F7,
        119 => Key::F8,
        120 => Key::F9,
        121 => Key::F10,
        122 => Key::F11,
        123 => Key::F12,
        36 => Key::Home,
        37 => Key::LeftArrow,
        91 => Key::MetaLeft,
        34 => Key::PageDown,
        33 => Key::PageUp,
        0x0D => Key::Return,
        39 => Key::RightArrow,
        160 => Key::ShiftLeft,
        161 => Key::ShiftRight,
        32 => Key::Space,
        0x09 => Key::Tab,
        38 => Key::UpArrow,
        44 => Key::PrintScreen,
        145 => Key::ScrollLock,
        19 => Key::Pause,
        144 => Key::NumLock,
        192 => Key::BackQuote,
        48 => Key::Num0,
        49 => Key::Num1,
        50 => Key::Num2,
        51 => Key::Num3,
        52 => Key::Num4,
        53 => Key::Num5,
        54 => Key::Num6,
        55 => Key::Num7,
        56 => Key::Num8,
        57 => Key::Num9,
        189 => Key::Minus,
        187 => Key::Equal,
        65 => Key::KeyA,
        66 => Key::KeyB,
        67 => Key::KeyC,
        68 => Key::KeyD,
        69 => Key::KeyE,
        70 => Key::KeyF,
        71 => Key::KeyG,
        72 => Key::KeyH,
        73 => Key::KeyI,
        74 => Key::KeyJ,
        75 => Key::KeyK,
        76 => Key::KeyL,
        77 => Key::KeyM,
        78 => Key::KeyN,
        79 => Key::KeyO,
        80 => Key::KeyP,
        81 => Key::KeyQ,
        82 => Key::KeyR,
        83 => Key::KeyS,
        84 => Key::KeyT,
        85 => Key::KeyU,
        86 => Key::KeyV,
        87 => Key::KeyW,
        88 => Key::KeyX,
        89 => Key::KeyY,
        90 => Key::KeyZ,
        219 => Key::LeftBracket,
        221 => Key::RightBracket,
        186 => Key::SemiColon,
        222 => Key::Quote,
        220 => Key::BackSlash,
        188 => Key::Comma,
        190 => Key::Dot,
        191 => Key::Slash,
        45 => Key::Insert,
        _ => Key::Unknown(code),
    }
}

/// The mouse button Windows reported, in the shape the rest of the module
/// expects: the two extra buttons arrive as `Unknown(1)` and `Unknown(2)`.
fn button_from_code(code: u32) -> Button {
    match code {
        1 => Button::Left,
        2 => Button::Right,
        3 => Button::Middle,
        other => Button::Unknown(other as u8),
    }
}

fn dispatch(event: Event) {
    let mut slot = match CALLBACK.lock() {
        Ok(slot) => slot,
        Err(_) => return,
    };
    if let Some(callback) = slot.as_mut() {
        callback(event);
    }
}

unsafe extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        let kb = *(lparam as *const KBDLLHOOKSTRUCT);
        let key = key_from_vk(kb.vkCode as u32);
        let event_type = match wparam as u32 {
            WM_KEYDOWN | WM_SYSKEYDOWN => Some(EventType::KeyPress(key)),
            WM_KEYUP | WM_SYSKEYUP => Some(EventType::KeyRelease(key)),
            _ => None,
        };
        if let Some(event_type) = event_type {
            dispatch(Event {
                event_type,
                time: SystemTime::now(),
                name: None,
            });
        }
    }
    CallNextHookEx(null_mut(), code, wparam, lparam)
}

unsafe extern "system" fn mouse_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        let mouse = *(lparam as *const MSLLHOOKSTRUCT);
        // The button code is in the high word of mouseData.
        let button_code = (mouse.mouseData >> 16) as u32;
        let event_type = match wparam as u32 {
            WM_LBUTTONDOWN => Some(EventType::ButtonPress(Button::Left)),
            WM_LBUTTONUP => Some(EventType::ButtonRelease(Button::Left)),
            WM_RBUTTONDOWN => Some(EventType::ButtonPress(Button::Right)),
            WM_RBUTTONUP => Some(EventType::ButtonRelease(Button::Right)),
            WM_MBUTTONDOWN => Some(EventType::ButtonPress(Button::Middle)),
            WM_MBUTTONUP => Some(EventType::ButtonRelease(Button::Middle)),
            WM_XBUTTONDOWN => Some(EventType::ButtonPress(button_from_code(button_code))),
            WM_XBUTTONUP => Some(EventType::ButtonRelease(button_from_code(button_code))),
            _ => None,
        };
        if let Some(event_type) = event_type {
            dispatch(Event {
                event_type,
                time: SystemTime::now(),
                name: None,
            });
        }
    }
    CallNextHookEx(null_mut(), code, wparam, lparam)
}

/// Install the hook and pump messages until the thread ends.
///
/// The hook has to live on the thread that runs the message loop: Windows
/// calls a low-level hook procedure on the thread that installed it, by way
/// of that thread's message queue.
pub fn spawn(callback: HookCallback) -> Result<(), String> {
    *CALLBACK.lock().map_err(|e| e.to_string())? = Some(callback);

    std::thread::Builder::new()
        .name("soravo-input-hook".into())
        .spawn(move || unsafe {
            let module = GetModuleHandleW(null_mut());
            let keyboard = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), module, 0);
            if keyboard.is_null() {
                eprintln!("[soravo] the keyboard hook could not be installed");
                return;
            }
            let mouse = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook), module, 0);
            if mouse.is_null() {
                eprintln!("[soravo] the mouse hook could not be installed");
            }

            // The pump. A real MSG this time, and a loop: the hook is
            // delivered through this queue.
            let mut msg: MSG = std::mem::zeroed();
            loop {
                let result = GetMessageW(&mut msg, null_mut(), 0, 0);
                if result as i32 <= 0 {
                    break;
                }
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        })
        .map_err(|e| format!("failed to spawn the input hook thread: {e}"))?;
    Ok(())
}

/// Unused on other platforms, but the type keeps the signature honest.
#[allow(dead_code)]
type Unused = (DWORD, UINT, WPARAM);
