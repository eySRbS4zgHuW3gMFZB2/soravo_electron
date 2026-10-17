use serde::{Deserialize, Serialize};
use chrono::Datelike;
use chrono::Timelike;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecState {
    Idle,
    Recording,
    Transcribing,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEntry {
    pub id: i64,
    pub text: String,
    pub created_at: String,
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsData {
    pub dictations: usize,
    pub words: usize,
    pub audio_minutes: f64,
    pub avg_wpm: i64,
    pub top_wpm: i64,
    pub day_streak: usize,
    pub longest_streak: usize,
    pub corrections_fillers: i64,
    pub corrections_vocab: i64,
    pub per_day: Vec<PerDayEntry>,
    pub per_hour: Vec<i64>,
    pub per_weekday: Vec<i64>,
    pub top_words: Vec<WordCount>,
    pub top_phrases: Vec<PhraseCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerDayEntry {
    pub date: String,
    pub words: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordCount {
    pub word: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhraseCount {
    pub phrase: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoravoSettings {
    pub hotkey: String,
    pub paste_hotkey: String,
    pub copy_hotkey: String,
    pub model: String,
    pub language: String,
    pub microphone_id: String,
    pub sounds: bool,
    pub smart_cleanup: bool,
    pub vocabulary: std::collections::HashMap<String, String>,
    pub launch_at_login: bool,
    pub theme: String,
    pub retention: String,
}

impl Default for SoravoSettings {
    fn default() -> Self {
        Self {
            hotkey: "CommandOrControl+Alt+Space".to_string(),
            paste_hotkey: "CommandOrControl+Alt+V".to_string(),
            copy_hotkey: "CommandOrControl+Alt+C".to_string(),
            model: "base.en".to_string(),
            language: "en".to_string(),
            microphone_id: "".to_string(),
            sounds: true,
            smart_cleanup: true,
            vocabulary: std::collections::HashMap::new(),
            launch_at_login: false,
            theme: "light".to_string(),
            retention: "all".to_string(),
        }
    }
}

pub struct AppState {
    pub state: Mutex<RecState>,
    pub db: Mutex<Option<rusqlite::Connection>>,
    pub last_toggle_at: Mutex<i64>,
    pub hide_timer: Mutex<Option<tokio::task::JoinHandle<()>>>,
    pub audio_timer: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            state: Mutex::new(RecState::Idle),
            db: Mutex::new(None),
            last_toggle_at: Mutex::new(0),
            hide_timer: Mutex::new(None),
            audio_timer: Mutex::new(None),
        }
    }
}

// Database helpers
fn open_db(app: &tauri::AppHandle) -> Result<rusqlite::Connection, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let db_path = data_dir.join("soravo.sqlite");
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS transcriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            duration_ms INTEGER NULL,
            fillers_removed INTEGER NOT NULL DEFAULT 0,
            vocab_applied INTEGER NOT NULL DEFAULT 0
        );",
    )
    .map_err(|e| e.to_string())?;

    // Migrations
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(transcriptions)")
        .map_err(|e| e.to_string())?
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if !columns.contains(&"fillers_removed".to_string()) {
        conn.execute(
            "ALTER TABLE transcriptions ADD COLUMN fillers_removed INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| e.to_string())?;
    }
    if !columns.contains(&"vocab_applied".to_string()) {
        conn.execute(
            "ALTER TABLE transcriptions ADD COLUMN vocab_applied INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(conn)
}

fn get_db(app: &tauri::AppHandle, state: &State<AppState>) -> Result<rusqlite::Connection, String> {
    let mut db_lock = state.db.lock().map_err(|e| e.to_string())?;
    if db_lock.is_none() {
        let conn = open_db(app)?;
        *db_lock = Some(conn);
    }
    // We need to return a connection. Since rusqlite::Connection isn't Clone,
    // we'll use a different approach: store the path and reopen each time.
    // Actually, let's just reopen each time for simplicity.
    drop(db_lock);
    open_db(app)
}

// Settings helpers using tauri-plugin-store
fn load_settings(app: &tauri::AppHandle) -> SoravoSettings {
    use tauri_plugin_store::StoreExt;
    let store = app.store("soravo-settings.json");
    if let Ok(s) = store {
        let mut settings = SoravoSettings::default();
        if let Some(v) = s.get("hotkey") { if let Some(s) = v.as_str() { settings.hotkey = s.to_string(); } }
        if let Some(v) = s.get("pasteHotkey") { if let Some(s) = v.as_str() { settings.paste_hotkey = s.to_string(); } }
        if let Some(v) = s.get("copyHotkey") { if let Some(s) = v.as_str() { settings.copy_hotkey = s.to_string(); } }
        if let Some(v) = s.get("model") { if let Some(s) = v.as_str() { settings.model = s.to_string(); } }
        if let Some(v) = s.get("language") { if let Some(s) = v.as_str() { settings.language = s.to_string(); } }
        if let Some(v) = s.get("microphoneId") { if let Some(s) = v.as_str() { settings.microphone_id = s.to_string(); } }
        if let Some(v) = s.get("sounds") { if let Some(b) = v.as_bool() { settings.sounds = b; } }
        if let Some(v) = s.get("smartCleanup") { if let Some(b) = v.as_bool() { settings.smart_cleanup = b; } }
        if let Some(v) = s.get("vocabulary") { if let Some(o) = v.as_object() { for (k, val) in o { if let Some(s) = val.as_str() { settings.vocabulary.insert(k.clone(), s.to_string()); } } } }
        if let Some(v) = s.get("launchAtLogin") { if let Some(b) = v.as_bool() { settings.launch_at_login = b; } }
        if let Some(v) = s.get("theme") { if let Some(s) = v.as_str() { settings.theme = s.to_string(); } }
        if let Some(v) = s.get("retention") { if let Some(s) = v.as_str() { settings.retention = s.to_string(); } }
        settings
    } else {
        SoravoSettings::default()
    }
}

fn save_settings(app: &tauri::AppHandle, settings: &SoravoSettings) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("soravo-settings.json").map_err(|e| e.to_string())?;
    store.set("hotkey", serde_json::json!(settings.hotkey));
    store.set("pasteHotkey", serde_json::json!(settings.paste_hotkey));
    store.set("copyHotkey", serde_json::json!(settings.copy_hotkey));
    store.set("model", serde_json::json!(settings.model));
    store.set("language", serde_json::json!(settings.language));
    store.set("microphoneId", serde_json::json!(settings.microphone_id));
    store.set("sounds", serde_json::json!(settings.sounds));
    store.set("smartCleanup", serde_json::json!(settings.smart_cleanup));
    store.set("vocabulary", serde_json::json!(settings.vocabulary));
    store.set("launchAtLogin", serde_json::json!(settings.launch_at_login));
    store.set("theme", serde_json::json!(settings.theme));
    store.set("retention", serde_json::json!(settings.retention));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

// Cleanup functions
fn cleanup_text(text: &str, language: &str) -> (String, i64) {
    let mut result = text.to_string();
    let mut fillers_removed: i64 = 0;

    // Remove filler words
    let fillers = ["um", "uh", "er", "ah", "hmm", "like", "you know", "i mean"];
    for filler in &fillers {
        let re = regex::Regex::new(&format!(r"(?i)\b{}\b", regex::escape(filler))).unwrap();
        let count = re.find_iter(&result).count() as i64;
        fillers_removed += count;
        result = re.replace_all(&result, "").to_string();
    }

    // Fix spacing
    result = result.replace("  ", " ").trim().to_string();

    // Capitalize first letter
    if !result.is_empty() {
        let mut chars: Vec<char> = result.chars().collect();
        if let Some(first) = chars.first_mut() {
            *first = first.to_uppercase().next().unwrap_or(*first);
        }
        result = chars.into_iter().collect();
    }

    // Add period if missing
    if !result.is_empty() && !result.ends_with('.') && !result.ends_with('!') && !result.ends_with('?') {
        result.push('.');
    }

    (result, fillers_removed)
}

fn apply_vocabulary(text: &str, vocab: &std::collections::HashMap<String, String>) -> (String, i64) {
    let mut result = text.to_string();
    let mut applied: i64 = 0;
    for (spoken, written) in vocab {
        if result.to_lowercase().contains(&spoken.to_lowercase()) {
            let re = regex::Regex::new(&format!(r"(?i)\b{}\b", regex::escape(spoken))).unwrap();
            let count = re.find_iter(&result).count() as i64;
            applied += count;
            result = re.replace_all(&result, written.as_str()).to_string();
        }
    }
    (result, applied)
}

// CrispASR transcription
fn transcribe_wav(
    wav_path: &str,
    model: &str,
    language: &str,
    resource_dir: &std::path::Path,
) -> Result<String, String> {
    let crispasr_binary = if cfg!(target_os = "windows") {
        "crispasr.exe"
    } else {
        "crispasr"
    };

    // In dev mode, current_dir is src-tauri/, so project root is parent
    let current_dir = std::env::current_dir().unwrap_or_default();
    let project_root = current_dir.parent().unwrap_or(&current_dir).to_path_buf();

    let model_file = format!("ggml-{}.bin", model);

    let whisper_candidates = [
        current_dir.join("third-party/bin").join(crispasr_binary),
        project_root.join("third-party/bin").join(crispasr_binary),
        std::path::Path::new("third-party/bin").join(crispasr_binary),
    ];

    let model_candidates = [
        current_dir.join("third-party/models").join(&model_file),
        project_root.join("third-party/models").join(&model_file),
        std::path::Path::new("third-party/models").join(&model_file),
    ];

    let mut whisper_path = whisper_candidates[0].clone();
    for p in &whisper_candidates {
        if p.exists() {
            whisper_path = p.clone();
            break;
        }
    }

    let mut model_path_str = model_candidates[0].to_string_lossy().to_string();
    for p in &model_candidates {
        if p.exists() {
            model_path_str = p.to_string_lossy().to_string();
            break;
        }
    }

    eprintln!("[soravo] current_dir: {}", current_dir.display());
    eprintln!("[soravo] project_root: {}", project_root.display());
    eprintln!("[soravo] crispasr path: {}", whisper_path.display());
    eprintln!("[soravo] model path: {}", model_path_str);
    eprintln!("[soravo] wav path: {}", wav_path);
    eprintln!("[soravo] crispasr exists: {}", whisper_path.exists());
    eprintln!("[soravo] model exists: {}", std::path::Path::new(&model_path_str).exists());

    let output = std::process::Command::new(&whisper_path)
        .arg("-m")
        .arg(&model_path_str)
        .arg("-f")
        .arg(wav_path)
        .arg("-l")
        .arg(language)
        .arg("-nt")
        .arg("-np")
        .output()
        .map_err(|e| format!("Failed to run CrispASR: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "CrispASR failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let text = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(text.trim().to_string())
}

// Text injection via clipboard + SendKeys (Windows)
#[cfg(target_os = "windows")]
fn inject_text(text: &str) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    // This is handled in the command function instead
    Ok(())
}

// Tauri commands
#[tauri::command]
async fn get_state(state: State<'_, AppState>) -> Result<RecState, String> {
    Ok(*state.state.lock().map_err(|e| e.to_string())?)
}

#[tauri::command]
async fn toggle(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let mut last_toggle = state.last_toggle_at.lock().map_err(|e| e.to_string())?;
    if now - *last_toggle < 800 {
        return Ok(());
    }
    *last_toggle = now;
    drop(last_toggle);

    let current_state = *state.state.lock().map_err(|e| e.to_string())?;
    match current_state {
        RecState::Idle | RecState::Error => {
            // Start recording
            *state.state.lock().unwrap() = RecState::Recording;
            app.emit("soravo:state", RecState::Recording).ok();
            // Show pill window
            if let Some(win) = app.get_webview_window("pill") {
                win.show().ok();
            }
            app.emit("soravo:record-command", "start").ok();
        }
        RecState::Recording => {
            *state.state.lock().unwrap() = RecState::Transcribing;
            app.emit("soravo:state", RecState::Transcribing).ok();
            app.emit("soravo:record-command", "stop").ok();
            // Set audio timeout
            let app_clone = app.clone();
            let handle = tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(15)).await;
                app_clone.emit("soravo:error", "No audio arrived from the recorder").ok();
                // Set state to error then idle
            });
            *state.audio_timer.lock().unwrap() = Some(handle);
        }
        RecState::Transcribing => {
            // Ignore
        }
    }
    Ok(())
}

#[tauri::command]
async fn cancel(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Clear audio timer
    if let Some(handle) = state.audio_timer.lock().unwrap().take() {
        handle.abort();
    }
    app.emit("soravo:record-command", "cancel").ok();
    *state.state.lock().unwrap() = RecState::Idle;
    app.emit("soravo:state", RecState::Idle).ok();
    // Schedule hide
    let app_clone = app.clone();
    let handle = tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(2500)).await;
        if let Some(win) = app_clone.get_webview_window("pill") {
            win.hide().ok();
        }
    });
    *state.hide_timer.lock().unwrap() = Some(handle);
    Ok(())
}

#[tauri::command]
async fn submit_audio(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    wav: Vec<u8>,
    duration_ms: i64,
) -> Result<(), String> {
    // Clear audio timer
    if let Some(handle) = state.audio_timer.lock().unwrap().take() {
        handle.abort();
    }

    if wav.is_empty() {
        app.emit("soravo:error", "Recording produced no audio").ok();
        *state.state.lock().unwrap() = RecState::Error;
        app.emit("soravo:state", RecState::Error).ok();
        return Ok(());
    }

    // Write temp WAV file
    let temp_dir = std::env::temp_dir();
    let wav_path = temp_dir.join(format!("soravo-{}.wav", uuid::Uuid::new_v4()));
    std::fs::write(&wav_path, &wav).map_err(|e| e.to_string())?;

    let settings = load_settings(&app);
    let model = settings.model.clone();
    let language = settings.language.clone();
    let language_for_cleanup = language.clone();
    let smart_cleanup = settings.smart_cleanup;
    let vocabulary = settings.vocabulary.clone();

    let wav_path_str = wav_path.to_string_lossy().to_string();

    // Get resource directory before moving app into the closure
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;

    // Transcribe
    let result = tokio::task::spawn_blocking(move || {
        transcribe_wav(&wav_path_str, &model, &language, &resource_dir)
    })
    .await
    .map_err(|e| e.to_string())?;

    // Clean up temp file
    let _ = std::fs::remove_file(&wav_path);

    match result {
        Ok(raw) => {
            let raw = raw.trim().to_string();
            if raw.is_empty() {
                app.emit("soravo:error", "Transcription came back empty").ok();
                *state.state.lock().unwrap() = RecState::Error;
                app.emit("soravo:state", RecState::Error).ok();
                return Ok(());
            }

            let (text, fillers_removed) = if smart_cleanup {
                cleanup_text(&raw, &language_for_cleanup)
            } else {
                (raw.clone(), 0)
            };

            let (text, vocab_applied) = if smart_cleanup {
                apply_vocabulary(&text, &vocabulary)
            } else {
                (text, 0)
            };

            let text = text.trim().to_string();
            if text.is_empty() {
                app.emit("soravo:error", "Transcription came back empty").ok();
                *state.state.lock().unwrap() = RecState::Error;
                app.emit("soravo:state", RecState::Error).ok();
                return Ok(());
            }

            // Save to database
            let conn = open_db(&app)?;
            conn.execute(
                "INSERT INTO transcriptions (text, duration_ms, fillers_removed, vocab_applied) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![text, duration_ms, fillers_removed, vocab_applied],
            )
            .map_err(|e| e.to_string())?;

            // Emit data changed
            app.emit("soravo:data-changed", ()).ok();

            // Inject text
            #[cfg(target_os = "windows")]
            {
                // Use clipboard + SendKeys
                use tauri_plugin_clipboard_manager::ClipboardExt;
                let old_clipboard = app.clipboard().read_text().unwrap_or_default();
                app.clipboard().write_text(text.clone()).ok();
                // Send Ctrl+V via PowerShell
                let _ = std::process::Command::new("powershell")
                    .args([
                        "-Command",
                        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
                    ])
                    .output();
                // Restore clipboard after delay
                let text_clone = text.clone();
                let app_clone = app.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
                    app_clone.clipboard().write_text(old_clipboard).ok();
                });
            }

            app.emit("soravo:transcript", &text).ok();

            // Schedule hide
            let app_clone = app.clone();
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(2500)).await;
                if let Some(win) = app_clone.get_webview_window("pill") {
                    win.hide().ok();
                }
            });

            *state.state.lock().unwrap() = RecState::Idle;
            app.emit("soravo:state", RecState::Idle).ok();
        }
        Err(e) => {
            app.emit("soravo:error", &e).ok();
            *state.state.lock().unwrap() = RecState::Error;
            app.emit("soravo:state", RecState::Error).ok();
            // Schedule hide + idle
            let app_clone = app.clone();
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(4)).await;
                if let Some(win) = app_clone.get_webview_window("pill") {
                    win.hide().ok();
                }
                app_clone.emit("soravo:state", RecState::Idle).ok();
            });
        }
    }

    Ok(())
}

#[tauri::command]
async fn set_height(app: tauri::AppHandle, px: i32) -> Result<(), String> {
    let height = px.clamp(84, 520);
    if let Some(win) = app.get_webview_window("pill") {
        let size = win.outer_size().map_err(|e| e.to_string())?;
        let monitor = win.current_monitor().map_err(|e| e.to_string())?;
        if let Some(m) = monitor {
            let work_area = m.work_area();
            win
                .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: size.width,
                    height: height as u32,
                }))
                .ok();
            win
                .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: work_area.position.x + (work_area.size.width as i32 - size.width as i32) / 2,
                    y: work_area.position.y + work_area.size.height as i32 - height - 28,
                }))
                .ok();
        }
    }
    Ok(())
}

#[tauri::command]
async fn get_history(app: tauri::AppHandle, limit: Option<i64>) -> Result<Vec<TranscriptEntry>, String> {
    let limit = limit.unwrap_or(50).clamp(1, 200);
    let conn = open_db(&app)?;
    let mut stmt = conn
        .prepare("SELECT id, text, created_at AS createdAt, duration_ms AS durationMs FROM transcriptions ORDER BY id DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([limit], |row| {
            Ok(TranscriptEntry {
                id: row.get(0)?,
                text: row.get(1)?,
                created_at: row.get(2)?,
                duration_ms: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
async fn clear_history(app: tauri::AppHandle) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute("DELETE FROM transcriptions", []).map_err(|e| e.to_string())?;
    app.emit("soravo:data-changed", ()).ok();
    Ok(())
}

#[tauri::command]
async fn delete_history(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute("DELETE FROM transcriptions WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    app.emit("soravo:data-changed", ()).ok();
    Ok(())
}

#[tauri::command]
async fn get_insights(app: tauri::AppHandle) -> Result<InsightsData, String> {
    let conn = open_db(&app)?;
    let mut stmt = conn
        .prepare("SELECT text, created_at, duration_ms, fillers_removed, vocab_applied FROM transcriptions ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, String, Option<i64>, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Compute insights (simplified version of the TS logic)
    let mut per_day: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut per_hour = vec![0i64; 24];
    let mut per_weekday = vec![0i64; 7];
    let mut word_counts: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut phrase_counts: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut words: i64 = 0;
    let mut rate_words: i64 = 0;
    let mut rate_ms: i64 = 0;
    let mut top_wpm: i64 = 0;
    let mut audio_ms: i64 = 0;
    let mut corrections_fillers: i64 = 0;
    let mut corrections_vocab: i64 = 0;

    let stopwords: std::collections::HashSet<&str> = "a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,be,been,it,its,this,that,these,those,i,you,he,she,we,they,me,him,her,us,them,my,your,his,our,their,not,no,so,do,does,did,can,will,just,like,get,got,one,all,have,has,had,am,nor,up,out,about,into,over,after,before,between,through,than,too,very,should,now,also,well,yeah,yes,ok,okay,um,uh,er,ah,hmm"
        .split(',')
        .collect();

    for (text, created_at, duration_ms, fillers, vocab) in &rows {
        let count = text.split_whitespace().count() as i64;
        words += count;
        corrections_fillers += fillers;
        corrections_vocab += vocab;
        if let Some(dur) = duration_ms {
            if *dur > 0 {
                rate_words += count;
                rate_ms += dur;
                audio_ms += dur;
            }
            if *dur >= 5000 {
                top_wpm = top_wpm.max((count as f64 / *dur as f64 * 60000.0) as i64);
            }
        }

        // Parse date
        if let Ok(when) = chrono::DateTime::parse_from_rfc3339(created_at) {
            let local = when.with_timezone(&chrono::Local);
            let day = local.format("%Y-%m-%d").to_string();
            *per_day.entry(day).or_insert(0) += count;
            per_hour[local.hour() as usize] += count;
            per_weekday[(local.weekday().num_days_from_monday()) as usize] += count;
        }

        // Tokenize
        let toks: Vec<String> = text
            .to_lowercase()
            .split(|c: char| !c.is_alphanumeric() && c != '\'')
            .filter(|w| w.len() >= 2 && !stopwords.contains(*w))
            .map(|s| s.to_string())
            .collect();

        for w in &toks {
            *word_counts.entry(w.clone()).or_insert(0) += 1;
        }
        for n in 3..=5usize {
            for i in 0..toks.len().saturating_sub(n - 1) {
                let phrase = toks[i..i + n].join(" ");
                *phrase_counts.entry(phrase).or_insert(0) += 1;
            }
        }
    }

    let mut top_words: Vec<WordCount> = word_counts
        .into_iter()
        .map(|(word, count)| WordCount { word, count })
        .collect();
    top_words.sort_by(|a, b| b.count.cmp(&a.count));
    top_words.truncate(15);

    let mut top_phrases: Vec<PhraseCount> = phrase_counts
        .into_iter()
        .filter(|(_, count)| *count >= 2)
        .map(|(phrase, count)| PhraseCount { phrase, count })
        .collect();
    top_phrases.sort_by(|a, b| b.count.cmp(&a.count));
    top_phrases.truncate(10);

    // Streaks
    let mut days: Vec<String> = per_day.keys().cloned().collect();
    days.sort();
    let day_set: std::collections::HashSet<&String> = days.iter().collect();
    let mut streak = 0usize;
    let mut cursor = chrono::Local::now().date_naive();
    if !day_set.contains(&cursor.format("%Y-%m-%d").to_string()) {
        cursor = cursor.pred_opt().unwrap_or(cursor);
    }
    while day_set.contains(&cursor.format("%Y-%m-%d").to_string()) {
        streak += 1;
        cursor = cursor.pred_opt().unwrap_or(cursor);
        if streak > 10000 {
            break;
        }
    }

    let mut longest = 0usize;
    let mut run = 0usize;
    let mut prev: Option<chrono::NaiveDate> = None;
    for key in &days {
        let parts: Vec<&str> = key.split('-').collect();
        if parts.len() == 3 {
            if let (Ok(y), Ok(m), Ok(d)) = (
                parts[0].parse::<i32>(),
                parts[1].parse::<u32>(),
                parts[2].parse::<u32>(),
            ) {
                if let Some(current) = chrono::NaiveDate::from_ymd_opt(y, m, d) {
                    if let Some(p) = prev {
                        if (current - p).num_days() == 1 {
                            run += 1;
                        } else {
                            run = 1;
                        }
                    } else {
                        run = 1;
                    }
                    longest = longest.max(run);
                    prev = Some(current);
                }
            }
        }
    }

    let per_day_vec: Vec<PerDayEntry> = per_day
        .into_iter()
        .map(|(date, w)| PerDayEntry { date, words: w })
        .collect();
    let mut per_day_sorted = per_day_vec;
    per_day_sorted.sort_by(|a, b| a.date.cmp(&b.date));
    if per_day_sorted.len() > 400 {
        per_day_sorted = per_day_sorted[per_day_sorted.len() - 400..].to_vec();
    }

    Ok(InsightsData {
        dictations: rows.len(),
        words: words as usize,
        audio_minutes: (audio_ms as f64 / 60000.0 * 10.0).round() / 10.0,
        avg_wpm: if rate_ms > 0 {
            (rate_words as f64 / rate_ms as f64 * 60000.0) as i64
        } else {
            0
        },
        top_wpm,
        day_streak: streak,
        longest_streak: longest,
        corrections_fillers,
        corrections_vocab,
        per_day: per_day_sorted,
        per_hour,
        per_weekday,
        top_words,
        top_phrases,
    })
}

#[tauri::command]
async fn get_runtime_status(app: tauri::AppHandle, model: String) -> Result<serde_json::Value, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let whisper_path = resource_dir.join("third-party").join("bin").join("crispasr.exe");
    let model_path = resource_dir
        .join("third-party")
        .join("models")
        .join(format!("ggml-{}.bin", model));
    Ok(serde_json::json!({
        "binary": whisper_path.exists(),
        "model": model,
        "modelPresent": model_path.exists()
    }))
}

#[tauri::command]
async fn get_settings(app: tauri::AppHandle) -> Result<SoravoSettings, String> {
    Ok(load_settings(&app))
}

#[tauri::command]
async fn set_settings(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    patch: serde_json::Value,
) -> Result<SoravoSettings, String> {
    let mut settings = load_settings(&app);

    if let Some(v) = patch.get("hotkey").and_then(|v| v.as_str()) {
        settings.hotkey = v.to_string();
    }
    if let Some(v) = patch.get("pasteHotkey").and_then(|v| v.as_str()) {
        settings.paste_hotkey = v.to_string();
    }
    if let Some(v) = patch.get("copyHotkey").and_then(|v| v.as_str()) {
        settings.copy_hotkey = v.to_string();
    }
    if let Some(v) = patch.get("model").and_then(|v| v.as_str()) {
        settings.model = v.to_string();
    }
    if let Some(v) = patch.get("language").and_then(|v| v.as_str()) {
        settings.language = v.to_string();
    }
    if let Some(v) = patch.get("microphoneId").and_then(|v| v.as_str()) {
        settings.microphone_id = v.to_string();
    }
    if let Some(v) = patch.get("sounds").and_then(|v| v.as_bool()) {
        settings.sounds = v;
    }
    if let Some(v) = patch.get("smartCleanup").and_then(|v| v.as_bool()) {
        settings.smart_cleanup = v;
    }
    if let Some(v) = patch.get("vocabulary") {
        if let Some(obj) = v.as_object() {
            settings.vocabulary.clear();
            for (k, val) in obj {
                if let Some(s) = val.as_str() {
                    settings.vocabulary.insert(k.clone(), s.to_string());
                }
            }
        }
    }
    if let Some(v) = patch.get("launchAtLogin").and_then(|v| v.as_bool()) {
        settings.launch_at_login = v;
    }
    if let Some(v) = patch.get("theme").and_then(|v| v.as_str()) {
        if v == "light" || v == "dark" {
            settings.theme = v.to_string();
        }
    }
    if let Some(v) = patch.get("retention").and_then(|v| v.as_str()) {
        if v == "all" || v == "30days" || v == "session" {
            settings.retention = v.to_string();
            // Prune history
            let conn = open_db(&app)?;
            match v {
                "session" => {
                    conn.execute("DELETE FROM transcriptions", []).ok();
                }
                "30days" => {
                    conn.execute(
                        "DELETE FROM transcriptions WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')",
                        [],
                    )
                    .ok();
                }
                _ => {}
            }
        }
    }

    save_settings(&app, &settings)?;
    app.emit("soravo:data-changed", ()).ok();

    // Re-register hotkeys would go here, but Tauri global shortcut
    // re-registration requires more setup. For now, just save.

    Ok(settings)
}

#[tauri::command]
async fn win_min(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("hub") {
        win.minimize().ok();
    }
    Ok(())
}

#[tauri::command]
async fn win_max(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("hub") {
        if win.is_maximized().unwrap_or(false) {
            win.unmaximize().ok();
        } else {
            win.maximize().ok();
        }
    }
    Ok(())
}

#[tauri::command]
async fn win_close(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("hub") {
        win.hide().ok();
    }
    Ok(())
}

#[tauri::command]
async fn show_hub(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("hub") {
        if win.is_minimized().unwrap_or(false) {
            win.unminimize().ok();
        }
        win.show().ok();
        win.set_focus().ok();
    }
    Ok(())
}

#[tauri::command]
async fn quit(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState::default())
        .setup(|app| {
            // Open database
            let state = app.state::<AppState>();
            if let Ok(conn) = open_db(app.handle()) {
                *state.db.lock().unwrap() = Some(conn);
            }

            // Register global shortcuts
            let settings = load_settings(app.handle());
            let app_handle = app.handle().clone();

            // Dictate hotkey
            let app_clone = app_handle.clone();
            app
                .global_shortcut()
                .on_shortcut(settings.hotkey.as_str(), move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = app_clone.emit("soravo:toggle-hotkey", ());
                    }
                })
                .ok();

            // Pill stays hidden on startup - only shows during dictation

            // Show hub on startup - navigate to #/hub hash so it renders HubApp
            if let Some(win) = app.get_webview_window("hub") {
                let _ = win.eval("window.location.hash = '#/hub'");
                win.show().ok();
                win.set_focus().ok();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            toggle,
            cancel,
            submit_audio,
            set_height,
            get_history,
            clear_history,
            delete_history,
            get_insights,
            get_runtime_status,
            get_settings,
            set_settings,
            win_min,
            win_max,
            win_close,
            show_hub,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
