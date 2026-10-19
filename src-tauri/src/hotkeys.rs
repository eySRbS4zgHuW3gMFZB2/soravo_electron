//! Global input hook layer.
//!
//! Uses a low-level system-wide keyboard/mouse hook so we can support bindings
//! that Tauri's built-in global-shortcut plugin cannot:
//!
//! * bare keys such as `CapsLock` (no modifier required)
//! * mouse buttons (any button, alone or with modifiers)
//! * hold-to-talk (push-to-talk) driven by key-down / key-up instead of a toggle

use rdev::{Button, EventType, Key};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};

/// What a binding triggers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Trigger {
    Key(Key),
    Mouse(Button),
}

/// A parsed binding: one trigger (key or mouse button) plus a modifier set.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Binding {
    pub trigger: Trigger,
    /// CommandOrControl / Ctrl
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool,
    /// Bare triggers (no modifier at all) must match on their own. When the user
    /// binds e.g. `CapsLock`, we require that no modifier is held so that
    /// `Ctrl+CapsLock` does not also fire it.
    pub requires_bare: bool,
}

impl Binding {
    fn mods_match(&self, ctrl: bool, alt: bool, shift: bool, meta: bool) -> bool {
        if self.requires_bare {
            // Exact modifier set: nothing extra may be held.
            self.ctrl == ctrl && self.alt == alt && self.shift == shift && self.meta == meta
        } else {
            // Every modifier this binding asks for must be held.
            (!self.ctrl || ctrl)
                && (!self.alt || alt)
                && (!self.shift || shift)
                && (!self.meta || meta)
        }
    }

    pub fn matches(
        &self,
        trigger: Trigger,
        ctrl: bool,
        alt: bool,
        shift: bool,
        meta: bool,
    ) -> bool {
        self.trigger == trigger && self.mods_match(ctrl, alt, shift, meta)
    }
}

/// Letters, in the order rdev declares them.
const LETTERS: [Key; 26] = [
    Key::KeyA, Key::KeyB, Key::KeyC, Key::KeyD, Key::KeyE, Key::KeyF, Key::KeyG, Key::KeyH,
    Key::KeyI, Key::KeyJ, Key::KeyK, Key::KeyL, Key::KeyM, Key::KeyN, Key::KeyO, Key::KeyP,
    Key::KeyQ, Key::KeyR, Key::KeyS, Key::KeyT, Key::KeyU, Key::KeyV, Key::KeyW, Key::KeyX,
    Key::KeyY, Key::KeyZ,
];

/// Number row, in order.
const DIGITS: [Key; 10] = [
    Key::Num0, Key::Num1, Key::Num2, Key::Num3, Key::Num4,
    Key::Num5, Key::Num6, Key::Num7, Key::Num8, Key::Num9,
];

/// Numpad digits, in order.
const KP_DIGITS: [Key; 10] = [
    Key::Kp0, Key::Kp1, Key::Kp2, Key::Kp3, Key::Kp4,
    Key::Kp5, Key::Kp6, Key::Kp7, Key::Kp8, Key::Kp9,
];

/// Function keys, F1..F12 in order (rdev models no higher F-keys).
const FUNCTION_KEYS: [Key; 12] = [
    Key::F1, Key::F2, Key::F3, Key::F4, Key::F5, Key::F6,
    Key::F7, Key::F8, Key::F9, Key::F10, Key::F11, Key::F12,
];

fn parse_key(name: &str) -> Option<Key> {
    let k = match name {
        "Space" | "space" => Key::Space,
        "Return" | "Enter" => Key::Return,
        "Tab" => Key::Tab,
        "Backspace" => Key::Backspace,
        "CapsLock" => Key::CapsLock,
        "PrintScreen" => Key::PrintScreen,
        "ScrollLock" => Key::ScrollLock,
        "Pause" => Key::Pause,
        "NumLock" => Key::NumLock,
        "Insert" => Key::Insert,
        "Delete" => Key::Delete,
        "Home" => Key::Home,
        "End" => Key::End,
        "PageUp" => Key::PageUp,
        "PageDown" => Key::PageDown,
        "Up" | "ArrowUp" | "UpArrow" => Key::UpArrow,
        "Down" | "ArrowDown" | "DownArrow" => Key::DownArrow,
        "Left" | "ArrowLeft" | "LeftArrow" => Key::LeftArrow,
        "Right" | "ArrowRight" | "RightArrow" => Key::RightArrow,
        "Escape" | "Esc" => Key::Escape,
        "BackQuote" | "Backtick" | "`" => Key::BackQuote,
        "Minus" | "-" => Key::Minus,
        "Equal" | "Equals" | "=" => Key::Equal,
        "Plus" => Key::Equal, // '+' is typed as Equal with Shift.
        "BracketLeft" | "[" => Key::LeftBracket,
        "BracketRight" | "]" => Key::RightBracket,
        "Backslash" | "\\" => Key::BackSlash,
        "Semicolon" | ";" => Key::SemiColon,
        "Quote" | "'" => Key::Quote,
        "Comma" | "," => Key::Comma,
        "Period" | "." => Key::Dot,
        "Slash" | "/" => Key::Slash,
        "num0" | "Numpad0" => KP_DIGITS[0],
        "num1" | "Numpad1" => KP_DIGITS[1],
        "num2" | "Numpad2" => KP_DIGITS[2],
        "num3" | "Numpad3" => KP_DIGITS[3],
        "num4" | "Numpad4" => KP_DIGITS[4],
        "num5" | "Numpad5" => KP_DIGITS[5],
        "num6" | "Numpad6" => KP_DIGITS[6],
        "num7" | "Numpad7" => KP_DIGITS[7],
        "num8" | "Numpad8" => KP_DIGITS[8],
        "num9" | "Numpad9" => KP_DIGITS[9],
        "numadd" | "NumpadAdd" => Key::KpPlus,
        "numsub" | "NumpadSubtract" => Key::KpMinus,
        "nummult" | "NumpadMultiply" => Key::KpMultiply,
        "numdiv" | "NumpadDivide" => Key::KpDivide,
        "numdec" | "NumpadDecimal" => Key::KpDelete,
        other => {
            // Letters A-Z.
            let mut chars = other.chars();
            if let (Some(c), None) = (chars.next(), chars.next()) {
                if c.is_ascii_alphabetic() {
                    return LETTERS[(c.to_ascii_lowercase() as u8 - b'a') as usize].into();
                }
                // Number row.
                if c.is_ascii_digit() {
                    return Some(DIGITS[(c as u8 - b'0') as usize]);
                }
            }
            // Function keys F1..F12.
            if let Some(n) = other.strip_prefix('F').and_then(|n| n.parse::<usize>().ok()) {
                if (1..=12).contains(&n) {
                    return Some(FUNCTION_KEYS[n - 1]);
                }
            }
            return None;
        }
    };
    Some(k)
}

/// Mouse button names accepted in bindings.
///
/// Windows reports the two extra buttons as `Button::Unknown(1)` (back) and
/// `Button::Unknown(2)` (forward) rather than dedicated variants.
fn parse_button(name: &str) -> Option<Button> {
    match name {
        "Mouse1" | "MouseLeft" | "LeftMouseButton" | "MouseLeftButton" => Some(Button::Left),
        "Mouse2" | "MouseRight" | "RightMouseButton" | "MouseRightButton" => Some(Button::Right),
        "Mouse3" | "MouseMiddle" | "MiddleMouseButton" | "MouseMiddleButton" => Some(Button::Middle),
        "Mouse4" | "MouseBack" | "XButton1" => Some(Button::Unknown(1)),
        "Mouse5" | "MouseForward" | "XButton2" => Some(Button::Unknown(2)),
        _ => None,
    }
}

/// True when a name refers to a mouse button rather than a key.
pub fn is_mouse_name(name: &str) -> bool {
    parse_button(name).is_some()
}

/// Parse an accelerator-style binding string.
///
/// Accepted grammar:
///   `CommandOrControl+Alt+Space`, `Ctrl+Shift+K`, `CapsLock`, `F5`, `A`, `7`,
///   `Mouse4`, `Ctrl+Mouse1`
///
/// Returns `None` for anything we cannot bind, which the settings UI uses to
/// reject a capture before it is persisted.
pub fn parse_binding(accel: &str) -> Option<Binding> {
    let accel = accel.trim();
    if accel.is_empty() {
        return None;
    }

    // Tolerate the Electron-style trailing modifier form "Space+".
    let parts: Vec<&str> = accel
        .split('+')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();
    if parts.is_empty() {
        return None;
    }
    let main = *parts.last()?;

    let mut ctrl = false;
    let mut alt = false;
    let mut shift = false;
    let mut meta = false;
    for m in &parts[..parts.len() - 1] {
        match *m {
            "CommandOrControl" | "Command" | "Control" | "Ctrl" | "CmdOrCtrl" => ctrl = true,
            "Alt" | "Option" => alt = true,
            "Shift" => shift = true,
            "Super" | "Meta" | "Win" => meta = true,
            _ => return None,
        }
    }

    // '+' cannot survive the split above, so a trailing separator means the
    // user wanted the Plus key, which rdev models as Equal.
    let trigger = if is_mouse_name(main) {
        Trigger::Mouse(parse_button(main)?)
    } else {
        let name = if main.is_empty() { "Equal" } else { main };
        Trigger::Key(normalize(parse_key(name)?))
    };

    let requires_bare = !(ctrl || alt || shift || meta);

    Some(Binding {
        trigger,
        ctrl,
        alt,
        shift,
        meta,
        requires_bare,
    })
}

/// Runtime configuration for the hook thread. Replaced whenever settings change,
/// so the long-lived listener picks up new bindings without a restart.
#[derive(Clone, Default)]
pub struct HookConfig {
    pub dictation: Option<Binding>,
    pub paste_last: Option<Binding>,
    pub copy_last: Option<Binding>,
    /// When true, recording follows key-down/key-up (push-to-talk). When false the
    /// dictation binding behaves as a press-to-toggle shortcut.
    pub hold_to_talk: bool,
}

/// Callbacks the hook thread invokes. Plain `Fn` so they can be called from the
/// blocking listener thread without pulling in an async runtime.
#[derive(Clone)]
pub struct HookHandles {
    /// Push-to-talk: begin recording.
    pub dictate_start: Arc<dyn Fn() + Send + Sync>,
    /// Push-to-talk: finish recording and transcribe.
    pub dictate_stop: Arc<dyn Fn() + Send + Sync>,
    /// Toggle mode: start if idle, stop if recording.
    pub dictate_toggle: Arc<dyn Fn() + Send + Sync>,
    pub paste_last: Arc<dyn Fn() + Send + Sync>,
    pub copy_last: Arc<dyn Fn() + Send + Sync>,
}

#[derive(Default, Clone, Copy)]
struct Modifiers {
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
}

/// rdev's key table omits `VK_CAPITAL`, so a CapsLock press arrives as
/// `Key::Unknown(20)` and would never match a binding parsed as `CapsLock`.
/// Canonicalise it on both sides of the comparison instead.
///
/// Other lock keys (NumLock, ScrollLock, Pause, PrintScreen) *are* mapped by
/// rdev and need no special handling.
fn normalize(key: Key) -> Key {
    #[cfg(target_os = "windows")]
    if let Key::Unknown(0x14) = key {
        return Key::CapsLock;
    }
    key
}

fn is_modifier(key: Key) -> bool {
    matches!(
        key,
        Key::ControlLeft
            | Key::ControlRight
            | Key::Alt
            | Key::AltGr
            | Key::ShiftLeft
            | Key::ShiftRight
            | Key::MetaLeft
            | Key::MetaRight
            | Key::Function
    )
}

/// Start the global input hook on a dedicated thread.
///
/// `rdev::listen` blocks forever, so it must not run on the UI thread. The hook
/// only observes input and never consumes it, so normal typing and clicking keep
/// working in every other application.
pub fn spawn_hook(config: Arc<RwLock<HookConfig>>, handles: HookHandles, textarea_focused: Arc<AtomicBool>) -> Result<(), String> {
    std::thread::Builder::new()
        .name("soravo-input-hook".into())
        .spawn(move || {
            // Modifier state has to persist across events: by the time the
            // trigger key or mouse button arrives, the modifier press was a
            // separate, earlier event. `rdev::listen` takes an FnMut closure,
            // so this is captured and updated in place.
            let mut mods = Modifiers::default();
            // The trigger currently held down for push-to-talk, if any.
            let mut held: Option<Trigger> = None;

            let result = rdev::listen(move |event| {
                // Skip dictation handling when textarea is focused (frontend
                // handles recording locally).
                if textarea_focused.load(Ordering::Relaxed) {
                    // Still track modifiers
                    match event.event_type {
                        EventType::KeyPress(key) => {
                            if is_modifier(key) {
                                set_modifier(&mut mods, key, true);
                            }
                        }
                        EventType::KeyRelease(key) => {
                            if is_modifier(key) {
                                set_modifier(&mut mods, key, false);
                            }
                        }
                        _ => {}
                    }
                    return;
                }
                // Cheap and rare: snapshot the bindings for this event.
                let cfg = match config.read() {
                    Ok(cfg) => cfg.clone(),
                    Err(_) => return,
                };

                // (trigger, is_press)
                let mut hit: Option<(Trigger, bool)> = None;

                match event.event_type {
                    EventType::KeyPress(key) => {
                        if is_modifier(key) {
                            set_modifier(&mut mods, key, true);
                        } else {
                            hit = Some((Trigger::Key(normalize(key)), true));
                        }
                    }
                    EventType::KeyRelease(key) => {
                        if is_modifier(key) {
                            set_modifier(&mut mods, key, false);
                        } else {
                            hit = Some((Trigger::Key(normalize(key)), false));
                        }
                    }
                    // Both edges matter: push-to-talk needs the release to end
                    // the recording, and the release edge is what stops it.
                    EventType::ButtonPress(button) => hit = Some((Trigger::Mouse(button), true)),
                    EventType::ButtonRelease(button) => {
                        hit = Some((Trigger::Mouse(button), false))
                    }
                    EventType::MouseMove { .. } | EventType::Wheel { .. } => return,
                }

                let Some((trigger, pressed)) = hit else { return };

                let matched = |binding: &Option<Binding>| -> bool {
                    binding.as_ref().is_some_and(|b| {
                        b.matches(trigger, mods.ctrl, mods.alt, mods.shift, mods.meta)
                    })
                };

                // Dictation trigger.
                //
                // In push-to-talk we remember which trigger started the
                // recording and stop on that trigger's release, ignoring the
                // modifier state by then. Otherwise letting go of Ctrl before
                // the trigger key would leave the recording running forever.
                if cfg.hold_to_talk {
                    if pressed {
                        if matched(&cfg.dictation) {
                            held = Some(trigger);
                            (handles.dictate_start)();
                            return;
                        }
                    } else if held == Some(trigger) {
                        held = None;
                        (handles.dictate_stop)();
                        return;
                    }
                } else if pressed && matched(&cfg.dictation) {
                    // Toggle mode: every press flips the recorder, so tapping a
                    // second time stops it. Release is irrelevant here.
                    (handles.dictate_toggle)();
                    return;
                }

                if !pressed {
                    return;
                }

                if matched(&cfg.paste_last) {
                    (handles.paste_last)();
                    return;
                }
                if matched(&cfg.copy_last) {
                    (handles.copy_last)();
                }
            });

            if let Err(err) = result {
                log::error!("[soravo] global input hook failed: {err:?}");
            }
        })
        .map(|_| ())
        .map_err(|e| format!("failed to spawn input hook thread: {e}"))
}

fn set_modifier(mods: &mut Modifiers, key: Key, pressed: bool) {
    match key {
        Key::ControlLeft | Key::ControlRight => mods.ctrl = pressed,
        Key::Alt | Key::AltGr => mods.alt = pressed,
        Key::ShiftLeft | Key::ShiftRight => mods.shift = pressed,
        Key::MetaLeft | Key::MetaRight | Key::Function => mods.meta = pressed,
        _ => {}
    }
}

/// Validate a binding string without starting a hook. Used by the settings UI to
/// reject an unsupported capture before it is persisted.
#[tauri::command]
pub fn validate_binding(accel: String) -> bool {
    parse_binding(&accel).is_some()
}

/// Human-readable reference of accepted triggers, shown in the settings UI.
#[tauri::command]
pub fn binding_help() -> HashMap<String, Vec<String>> {
    let mut map = HashMap::new();
    map.insert(
        "keys".to_string(),
        vec![
            "A - Z".into(),
            "0 - 9".into(),
            "Space".into(),
            "Return".into(),
            "Tab".into(),
            "Backspace".into(),
            "Escape".into(),
            "CapsLock".into(),
            "PrintScreen".into(),
            "ScrollLock".into(),
            "Pause".into(),
            "NumLock".into(),
            "Insert".into(),
            "Delete".into(),
            "Home".into(),
            "End".into(),
            "PageUp".into(),
            "PageDown".into(),
            "Up / Down / Left / Right".into(),
            "F1 - F12".into(),
            "Numpad 0 - 9 and operators".into(),
            "Punctuation: ` - = [ ] \\ ; ' , . /".into(),
        ],
    );
    map.insert(
        "mouse".to_string(),
        vec![
            "Mouse1 (left)".into(),
            "Mouse2 (right)".into(),
            "Mouse3 (middle)".into(),
            "Mouse4 (back / X1)".into(),
            "Mouse5 (forward / X2)".into(),
        ],
    );
    map.insert(
        "modifiers".to_string(),
        vec![
            "CommandOrControl / Ctrl".into(),
            "Alt".into(),
            "Shift".into(),
            "Super / Win".into(),
        ],
    );
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_modifier_plus_key() {
        let b = parse_binding("CommandOrControl+Alt+Space").unwrap();
        assert!(b.ctrl && b.alt && !b.shift && !b.meta);
        assert_eq!(b.trigger, Trigger::Key(Key::Space));
        assert!(!b.requires_bare);
    }

    #[test]
    fn parses_bare_capslock() {
        let b = parse_binding("CapsLock").unwrap();
        assert_eq!(b.trigger, Trigger::Key(Key::CapsLock));
        assert!(b.requires_bare);
    }

    /// rdev reports an unmapped VK_CAPITAL press as Unknown(0x14). Unless the
    /// parsed binding and the incoming event are both canonicalised they never
    /// compare equal and CapsLock would silently do nothing.
    #[test]
    fn capslock_event_matches_parsed_binding() {
        let binding = parse_binding("CapsLock").unwrap();
        let from_event = normalize(Key::Unknown(0x14));
        assert_eq!(from_event, Key::CapsLock);
        assert!(binding.matches(Trigger::Key(from_event), false, false, false, false));
    }

    #[test]
    fn parses_letter_and_digit() {
        assert_eq!(parse_binding("K").unwrap().trigger, Trigger::Key(Key::KeyK));
        assert_eq!(parse_binding("k").unwrap().trigger, Trigger::Key(Key::KeyK));
        assert_eq!(parse_binding("7").unwrap().trigger, Trigger::Key(Key::Num7));
        assert_eq!(parse_binding("F11").unwrap().trigger, Trigger::Key(Key::F11));
    }

    #[test]
    fn parses_mouse_button() {
        let b = parse_binding("Ctrl+Mouse4").unwrap();
        assert!(b.ctrl);
        assert_eq!(b.trigger, Trigger::Mouse(Button::Unknown(1)));
    }

    #[test]
    fn parses_bare_mouse_button() {
        let b = parse_binding("Mouse2").unwrap();
        assert!(b.requires_bare);
        assert_eq!(b.trigger, Trigger::Mouse(Button::Right));
    }

    #[test]
    fn bare_capslock_does_not_fire_with_modifier() {
        let b = parse_binding("CapsLock").unwrap();
        assert!(b.matches(Trigger::Key(Key::CapsLock), false, false, false, false));
        assert!(!b.matches(Trigger::Key(Key::CapsLock), true, false, false, false));
    }

    #[test]
    fn bare_mouse_does_not_fire_with_modifier() {
        let b = parse_binding("Mouse1").unwrap();
        assert!(b.matches(Trigger::Mouse(Button::Left), false, false, false, false));
        assert!(!b.matches(Trigger::Mouse(Button::Left), false, false, true, false));
    }

    #[test]
    fn combo_requires_all_modifiers() {
        let b = parse_binding("Ctrl+Alt+Shift+K").unwrap();
        assert!(b.matches(Trigger::Key(Key::KeyK), true, true, true, false));
        assert!(!b.matches(Trigger::Key(Key::KeyK), true, true, false, false));
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_binding("").is_none());
        assert!(parse_binding("NotAKey").is_none());
        assert!(parse_binding("F13").is_none());
    }
}
