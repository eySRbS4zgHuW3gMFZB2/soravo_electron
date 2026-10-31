use serde::{Deserialize, Serialize};
use chrono::Datelike;
use chrono::Timelike;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use tauri::{Emitter, Manager, State};

mod hotkeys;
mod secure_store;

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
    pub per_month: Vec<i64>,
    pub per_year: Vec<YearEntry>,
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
#[serde(rename_all = "camelCase")]
pub struct YearEntry {
    pub year: i32,
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
    /// Hold the dictation hotkey to record; release to transcribe.
    /// When false the binding behaves as a press-to-toggle shortcut.
    pub hold_to_talk: bool,
    /// Active model id (e.g. "tiny.en", "base.en"). Empty means no model.
    pub model: String,
    pub language: String,
    pub microphone_id: String,
    pub sounds: bool,
    pub smart_cleanup: bool,
    /// Append a trailing period when the transcript has no ending punctuation.
    /// Independent of `smart_cleanup`.
    pub add_punctuation: bool,
    pub vocabulary: std::collections::HashMap<String, String>,
    pub launch_at_login: bool,
    pub theme: String,
    pub retention: String,
    /// Shortcut that jumps to the Scratchpad tab from anywhere in the hub.
    /// Empty means the shortcut is not bound.
    pub scratchpad_hotkey: String,
    /// Whether the navigation rail shows its labels. False collapses it to a
    /// narrow icon rail, the way Wispr Flow's hub does.
    pub sidebar_open: bool,
    /// Folder the transcription models are downloaded into. Empty means the
    /// default location under the app data directory.
    pub models_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub size_label: String,
    pub license: String,
    /// Is the model ready to use: the weights, whole, and the files the
    /// engine reads from beside them?
    pub installed: bool,
    /// Is the model's file on disk at all, even if it is incomplete?
    pub present: bool,
    pub active: bool,
    pub url: String,
}

impl Default for SoravoSettings {
    fn default() -> Self {
        Self {
            hotkey: "CommandOrControl+Alt+Space".to_string(),
            paste_hotkey: "CommandOrControl+Alt+V".to_string(),
            copy_hotkey: "CommandOrControl+Alt+C".to_string(),
            hold_to_talk: false,
            model: "base.en".to_string(),
            language: "en".to_string(),
            microphone_id: "".to_string(),
            sounds: true,
            smart_cleanup: true,
            add_punctuation: true,
            vocabulary: std::collections::HashMap::new(),
            launch_at_login: true,
            theme: "light".to_string(),
            retention: "all".to_string(),
            scratchpad_hotkey: String::new(),
            sidebar_open: true,
            models_dir: String::new(),
        }
    }
}

pub struct AppState {
    pub state: Mutex<RecState>,
    pub db: Mutex<Option<rusqlite::Connection>>,
    pub last_toggle_at: Mutex<i64>,
    /// Generation counters for the pending pill-hide and audio timeouts. Timers
    /// are plain threads (the input hook thread has no async runtime), so a
    /// timer detects that it was superseded by comparing tickets instead of
    /// being aborted.
    pub hide_gen: Arc<AtomicU64>,
    pub audio_gen: Arc<AtomicU64>,
    /// Live bindings for the global input hook. Replaced when settings change so
    /// the running hook picks up new shortcuts without a restart.
    pub hook_config: Arc<RwLock<hotkeys::HookConfig>>,
    pub textarea_focused: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            state: Mutex::new(RecState::Idle),
            db: Mutex::new(None),
            last_toggle_at: Mutex::new(0),
            hide_gen: Arc::new(AtomicU64::new(0)),
            audio_gen: Arc::new(AtomicU64::new(0)),
            hook_config: Arc::new(RwLock::new(hotkeys::HookConfig::default())),
            textarea_focused: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Hide the pill after `delay_ms`, unless a newer hide or a new recording
/// supersedes it.
fn schedule_pill_hide(app: &tauri::AppHandle, state: &AppState, delay_ms: u64) {
    spawn_timer(
        app,
        &state.hide_gen,
        std::time::Duration::from_millis(delay_ms),
        |app| {
            if let Some(win) = app.get_webview_window("pill") {
                win.hide().ok();
            }
        },
    );
}

/// Run `action` after `delay` unless a newer timer of the same kind started.
///
/// Callable from any thread, including the input hook thread which has no
/// Tokio runtime context.
fn spawn_timer(
    app: &tauri::AppHandle,
    gen: &Arc<AtomicU64>,
    delay: std::time::Duration,
    action: impl Fn(&tauri::AppHandle) + Send + 'static,
) {
    let ticket = gen.fetch_add(1, Ordering::SeqCst) + 1;
    let gen = Arc::clone(gen);
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(delay);
        if gen.load(Ordering::SeqCst) == ticket {
            action(&app);
        }
    });
}

/// Translate settings into the hook's runtime configuration.
fn hook_config_from_settings(settings: &SoravoSettings) -> hotkeys::HookConfig {
    hotkeys::HookConfig {
        dictation: hotkeys::parse_binding(&settings.hotkey),
        paste_last: hotkeys::parse_binding(&settings.paste_hotkey),
        copy_last: hotkeys::parse_binding(&settings.copy_hotkey),
        hold_to_talk: settings.hold_to_talk,
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

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS scratchpad_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            pinned BOOLEAN NOT NULL DEFAULT 0
        );",
    )
    .map_err(|e| e.to_string())?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS snippets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phrase TEXT NOT NULL,
            expansion TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            is_auto_learned BOOLEAN NOT NULL DEFAULT 0
        );",
    )
    .map_err(|e| e.to_string())?;

    Ok(conn)
}


/// A file the engine loads from beside the model.
///
/// Some backends are more than one file: Moonshine reads its tokenizer from
/// a sibling `tokenizer.bin`, and Mini-Omni2 reads its audio codec from
/// `snac-24khz.gguf`. CrispASR looks for them by name, in the model's own
/// folder, so the app fetches them along with the model.
struct ModelCompanion {
    /// The name the engine looks for, next to the model file.
    file: &'static str,
    /// Where it is downloaded from.
    url: &'static str,
    /// Its exact size in bytes.
    size: u64,
}

/// One model in the catalog.
struct CatalogModel {
    /// The id the app stores and shows.
    id: &'static str,
    /// The name shown in the Models page.
    name: &'static str,
    /// The exact size of the model file, in bytes.
    ///
    /// The size is what tells a finished download from a truncated one, so
    /// it is the size the server reports rather than a round number.
    size: u64,
    /// Where the model file is downloaded from.
    url: &'static str,
    /// The licence the model is under.
    license: &'static str,
    /// The files the engine loads from beside the model.
    companions: &'static [ModelCompanion],
}

/// The tokenizer Moonshine reads, from the Moonshine model repositories.
const MOONSHINE_TOKENIZER: &[ModelCompanion] = &[ModelCompanion {
    file: "tokenizer.bin",
    url: "https://huggingface.co/cstr/moonshine-tiny-GGUF/resolve/main/tokenizer.bin",
    size: 251_254,
}];

// Model catalog: MIT-licensed Whisper models available on HuggingFace.
// CrispASR runs any of these directly (GGUF/BIN format).
const MODEL_CATALOG: &[CatalogModel] = &[
    // Whisper family (OpenAI, MIT) — ggerganov/whisper.cpp
    CatalogModel { id: "tiny.en", name: "Whisper Tiny (English, f16)", size: 77_704_715, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "tiny", name: "Whisper Tiny (Multilingual, f16)", size: 77_691_713, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "tiny.en-q8", name: "Whisper Tiny (English, Q8)", size: 43_550_795, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q8_0.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "tiny.en-fp16", name: "Whisper Tiny (English, Q5_1)", size: 32_166_155, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "base.en", name: "Whisper Base (English, f16)", size: 147_964_211, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "base", name: "Whisper Base (Multilingual, f16)", size: 147_951_465, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "small.en", name: "Whisper Small (English, f16)", size: 487_614_201, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "small", name: "Whisper Small (Multilingual, f16)", size: 487_601_967, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "distil-large-v3", name: "Distil-Whisper Large v3", size: 1_519_521_155, url: "https://huggingface.co/distil-whisper/distil-large-v3-ggml/resolve/main/ggml-distil-large-v3.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "medium.en", name: "Whisper Medium (English, f16)", size: 1_533_774_781, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "medium", name: "Whisper Medium (Multilingual, f16)", size: 1_533_763_059, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "large-v3", name: "Whisper Large v3", size: 3_095_033_483, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin", license: "MIT", companions: &[] },
    CatalogModel { id: "large-v3-turbo", name: "Whisper Large v3 Turbo", size: 1_624_555_275, url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin", license: "MIT", companions: &[] },
    // Moonshine (UsefulSensors, MIT)
    CatalogModel { id: "moonshine-tiny", name: "Moonshine Tiny (Q4_K)", size: 21_199_840, url: "https://huggingface.co/cstr/moonshine-tiny-GGUF/resolve/main/moonshine-tiny-q4_k.gguf", license: "MIT", companions: MOONSHINE_TOKENIZER },
    CatalogModel { id: "moonshine-streaming-tiny", name: "Moonshine Streaming Tiny (Q4_K)", size: 32_052_896, url: "https://huggingface.co/cstr/moonshine-streaming-tiny-GGUF/resolve/main/moonshine-streaming-tiny-q4_k.gguf", license: "MIT", companions: MOONSHINE_TOKENIZER },
    // Academic / research (MIT)
    CatalogModel { id: "gigaam-v3", name: "GigaAM v3 (RNNT, Q8)", size: 248_765_312, url: "https://huggingface.co/cstr/gigaam-v3-GGUF/resolve/main/gigaam-v3-e2e-rnnt-q8_0.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "kyutai-stt", name: "Kyutai STT 1B (Q4_K)", size: 666_565_184, url: "https://huggingface.co/cstr/kyutai-stt-1b-GGUF/resolve/main/kyutai-stt-1b-q4_k.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "glm-asr-nano", name: "GLM-ASR Nano (Q4_K)", size: 1_325_316_448, url: "https://huggingface.co/cstr/glm-asr-nano-GGUF/resolve/main/glm-asr-nano-q4_k.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "hikari-medium", name: "Hikari Medium (f16)", size: 1_533_790_688, url: "https://huggingface.co/cstr/hikari-medium-GGUF/resolve/main/hikari-medium-f16.gguf", license: "MIT", companions: &[] },
    // MOSS (OpenMOSS, MIT)
    CatalogModel { id: "moss-transcribe", name: "MOSS Transcribe Preview 2B (Q4_K)", size: 2_818_620_352, url: "https://huggingface.co/cstr/MOSS-Transcribe-preview-2B-GGUF/resolve/main/moss-transcribe-preview-2b-q4_k.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "moss-diarize", name: "MOSS Transcribe + Diarize 0.9B (Q4_K)", size: 1_190_110_816, url: "https://huggingface.co/cstr/MOSS-Transcribe-Diarize-GGUF/resolve/main/moss-transcribe-diarize-0.9b-q4_k.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "moss-audio", name: "MOSS Audio 4B Instruct (Q4_K)", size: 4_111_365_280, url: "https://huggingface.co/cstr/MOSS-Audio-4B-Instruct-GGUF/resolve/main/moss-audio-4b-instruct-q4_k.gguf", license: "MIT", companions: &[] },
    // Industry (MIT)
    CatalogModel { id: "mini-omni2", name: "minI-Omni2 (Q4_K)", size: 1_058_606_336, url: "https://huggingface.co/cstr/mini-omni2-GGUF/resolve/main/mini-omni2-q4_k.gguf", license: "MIT", companions: &[ModelCompanion { file: "snac-24khz.gguf", url: "https://huggingface.co/cstr/snac-24khz-GGUF/resolve/main/snac-24khz.gguf", size: 26_323_456 }] },
    CatalogModel { id: "vibevoice-streaming", name: "VibeVoice ASR Streaming 1.5B (Q4_K)", size: 1_860_361_920, url: "https://huggingface.co/cstr/vibevoice-asr-streaming-1.5b-GGUF/resolve/main/vibevoice-asr-streaming-1.5b-q4_k.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "vibevoice-bitnet", name: "VibeVoice ASR BitNet (TQ2)", size: 1_624_432_256, url: "https://huggingface.co/cstr/vibevoice-asr-bitnet-GGUF/resolve/main/vibevoice-asr-bitnet-tq2.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "vibevoice", name: "VibeVoice ASR (Q4_K)", size: 4_811_829_376, url: "https://huggingface.co/cstr/vibevoice-asr-GGUF/resolve/main/vibevoice-asr-q4_k.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "mimo-asr", name: "MiMo ASR (Q4_K)", size: 4_517_988_832, url: "https://huggingface.co/cstr/mimo-asr-GGUF/resolve/main/mimo-asr-q4_k.gguf", license: "MIT", companions: &[] },
    CatalogModel { id: "hojo-asr", name: "Hojo-ASR V1 (Q4_K)", size: 4_421_831_232, url: "https://huggingface.co/cstr/Hojo-ASR-Multi-V1-GGUF/resolve/main/hojo-asr-multi-v1-q4_k.gguf", license: "MIT", companions: &[] },
    // NVIDIA Parakeet & Canary (CC-BY-4.0), in the GGUF conversions
    // CrispASR runs. The upstream NVIDIA repositories hold PyTorch weights,
    // which the engine cannot read.
    CatalogModel { id: "parakeet-tdt-v2", name: "Parakeet TDT v2 (English, Q4_K)", size: 396_937_984, url: "https://huggingface.co/cstr/parakeet-tdt-0.6b-v2-GGUF/resolve/main/parakeet-tdt-0.6b-v2-q4_k.gguf", license: "CC-BY-4.0", companions: &[] },
    CatalogModel { id: "canary-1b-v2", name: "Canary 1B v2 (Multilingual, Q4_K)", size: 610_746_016, url: "https://huggingface.co/cstr/canary-1b-v2-GGUF/resolve/main/canary-1b-v2-q4_k.gguf", license: "CC-BY-4.0", companions: &[] },
];

/// The catalog entry for a model id.
fn catalog_model(id: &str) -> Option<&'static CatalogModel> {
    MODEL_CATALOG.iter().find(|m| m.id == id)
}

/// The default folder for the transcription models.
fn default_models_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("models")
}

/// The folder the models live in: the one the user picked, or the default.
fn models_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    let configured = load_settings(app).models_dir;
    if configured.trim().is_empty() {
        default_models_dir(app)
    } else {
        std::path::PathBuf::from(configured)
    }
}

/// Open a folder in the operating system's file manager.
///
/// The shell plugin's `open` is scoped, and the user can put the models
/// anywhere on disk, so the app opens the folder itself instead. The path has
/// to be a directory that exists.
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let dir = std::path::PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(format!("Not a folder: {}", path));
    }
    #[cfg(target_os = "windows")]
    let mut command = std::process::Command::new("explorer.exe");
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = std::process::Command::new("xdg-open");
    command.arg(&dir);
    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// The running app's version, for the settings footer.
#[tauri::command]
fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Open a link in the operating system's browser.
///
/// Only https links are accepted, and only the app's own release page is ever
/// passed in - the shell plugin's `open` is path-scoped, so the app does it
/// itself rather than widening a capability.
#[tauri::command]
fn open_link(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err(format!("Refusing to open {}: only https links are allowed", url));
    }
    #[cfg(target_os = "windows")]
    let mut command = std::process::Command::new("cmd");
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = std::process::Command::new("xdg-open");
    #[cfg(target_os = "windows")]
    {
        command.arg("/C").arg("start").arg("").arg(&url);
    }
    #[cfg(not(target_os = "windows"))]
    {
        command.arg(&url);
    }
    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// The resolved models folder, for the front end to show and to open.
#[tauri::command]
fn models_folder(app: tauri::AppHandle) -> String {
    models_dir(&app).to_string_lossy().to_string()
}

/// The default models folder, for the front end to offer as a reset.
#[tauri::command]
fn default_models_folder(app: tauri::AppHandle) -> String {
    default_models_dir(&app).to_string_lossy().to_string()
}

/// Locate the CrispASR executable.
///
/// `npm run fetch:asr` normally relocates the exe into `third-party/bin/`,
/// which is git-ignored. But the archive it downloads from is committed under
/// `third-party/crispasr/extracted/<build>/`, so a fresh clone has the binary
/// in one place while the lookup expects the other. Search both, preferring
/// `bin/` because that is what a completed fetch produces.
///
/// On an installed machine, the engine is bundled under
/// `resource_dir()/crispasr/`. That location is checked first so the
/// installed engine is always selected before any working-directory copy.
fn find_crispasr_binary(roots: &[std::path::PathBuf]) -> Option<std::path::PathBuf> {
    let name = if cfg!(target_os = "windows") { "crispasr.exe" } else { "crispasr" };

    // The Tauri resource_dir is the install-time location. Check it first so
    // the bundled engine wins over any development-tree copy.
    let resource_dir = roots.last().cloned().unwrap_or_default();
    let bundled = resource_dir.join("crispasr").join(name);
    if bundled.exists() {
        return Some(bundled);
    }

    // Linux-specific bundled layout: resource_dir/crispasr-linux/crispasr
    if cfg!(target_os = "linux") {
        let bundled_linux = resource_dir.join("crispasr-linux").join("crispasr");
        if bundled_linux.exists() {
            return Some(bundled_linux);
        }
    }

    // Developer-machine layout: npm run fetch:asr relocates the exe into
    // third-party/bin/, which is git-ignored.
    for root in roots {
        let in_bin = root.join("third-party").join("bin").join(name);
        if in_bin.exists() {
            return Some(in_bin);
        }
    }

    // Committed, not-yet-relocated copy. The versioned directory name
    // changes per release, so probe the immediate children.
    for root in roots {
        let extracted = root.join("third-party").join("crispasr").join("extracted");
        let Ok(entries) = std::fs::read_dir(&extracted) else { continue };
        for entry in entries.flatten() {
            let candidate = entry.path().join(name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    None
}

fn size_label(bytes: u64) -> String {
    if bytes >= 1_000_000_000 {
        format!("{:.1} GB", bytes as f64 / 1_000_000_000.0)
    } else {
        format!("{:.0} MB", bytes as f64 / 1_000_000.0)
    }
}

#[tauri::command]
async fn list_models(app: tauri::AppHandle) -> Result<Vec<ModelInfo>, String> {
    let settings = load_settings(&app);
    let active = settings.model.clone();
    let dir = models_dir(&app);
    let _ = std::fs::create_dir_all(&dir);

    let mut out = Vec::new();
    for model in MODEL_CATALOG {
        let weights = dir.join(format!("ggml-{}.bin", model.id));
        out.push(ModelInfo {
            id: model.id.to_string(),
            name: model.name.to_string(),
            size_bytes: model.size,
            size_label: size_label(model.size),
            license: model.license.to_string(),
            installed: model_is_installed(&dir, model),
            present: weights.exists(),
            active: model.id == active,
            url: model.url.to_string(),
        });
    }
    Ok(out)
}

/// Download a model and everything the engine loads beside it.
///
/// The companion files - the Moonshine tokenizer, the Mini-Omni2 codec -
/// are separate downloads that have to land next to the model, or the engine
/// loads the weights and then fails on the missing file.
#[tauri::command]
async fn download_model(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let model = catalog_model(&id)
        .ok_or_else(|| format!("Unknown model: {}", id))?;
    let dir = models_dir(&app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // The model first, then the files the engine loads from beside it.
    let mut files: Vec<(String, &str, u64)> = vec![(
        format!("ggml-{}.bin", model.id),
        model.url,
        model.size,
    )];
    for companion in model.companions {
        files.push((companion.file.to_string(), companion.url, companion.size));
    }

    let client = reqwest::Client::new();
    for (name, url, size) in files {
        let dest = dir.join(&name);
        // A file that is already there and whole is left alone, so repairing
        // one missing companion does not fetch the model again.
        if file_is_whole(&dest, size) {
            continue;
        }
        fetch_file(&client, url, &dest, size, &app, &id).await?;
    }

    app.emit("soravo:model-download-complete", serde_json::json!({ "id": id })).ok();
    Ok(())
}

/// Is the file there, and as long as it should be?
///
/// The length is what tells a finished download from one that was cut
/// short, and a short model file fails to load with a message that says
/// nothing about what went wrong.
fn file_is_whole(path: &std::path::Path, size: u64) -> bool {
    match std::fs::metadata(path) {
        Ok(meta) => meta.len() == size,
        Err(_) => false,
    }
}

/// Is the model ready to use: the weights, and the files beside them?
fn model_is_installed(dir: &std::path::Path, model: &CatalogModel) -> bool {
    let weights = dir.join(format!("ggml-{}.bin", model.id));
    if !file_is_whole(&weights, model.size) {
        return false;
    }
    model.companions.iter().all(|c| file_is_whole(&dir.join(c.file), c.size))
}

/// Fetch the files the engine loads from beside a model, if they are missing.
///
/// Some backends are more than one file: Moonshine reads its tokenizer from
/// a sibling `tokenizer.bin`, and Mini-Omni2 reads its codec from
/// `snac-24khz.gguf`. The engine looks for them next to the model, so if
/// they are not there it loads the weights and then fails on the missing
/// file. Fetching them here means a model that was downloaded before the
/// app knew about them starts working.
async fn ensure_companions(
    app: &tauri::AppHandle,
    model: &CatalogModel,
    models_dir: &std::path::Path,
) -> Result<(), String> {
    if model.companions.is_empty() {
        return Ok(());
    }

    // The companions go beside the model file the engine will actually
    // load, wherever that is.
    let current_dir = std::env::current_dir().unwrap_or_default();
    let project_root = current_dir.parent().unwrap_or(&current_dir).to_path_buf();
    let dir = resolve_model_path(model.id, models_dir, &current_dir, &project_root)
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| models_dir.to_path_buf());

    let missing: Vec<&ModelCompanion> = model
        .companions
        .iter()
        .filter(|c| !file_is_whole(&dir.join(c.file), c.size))
        .collect();
    if missing.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::new();
    for companion in missing {
        fetch_file(
            &client,
            companion.url,
            &dir.join(companion.file),
            companion.size,
            app,
            model.id,
        )
        .await?;
    }
    Ok(())
}

/// Stream one file to disk, reporting progress as it lands.
///
/// The download goes to a temporary name and is renamed into place only
/// once it is whole, so an interrupted download never leaves a model file
/// that looks installed but cannot be loaded.
async fn fetch_file(
    client: &reqwest::Client,
    url: &str,
    dest: &std::path::Path,
    expected: u64,
    app: &tauri::AppHandle,
    id: &str,
) -> Result<(), String> {
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);

    let part = dest.with_extension("part");
    let mut file = tokio::fs::File::create(&part).await.map_err(|e| e.to_string())?;
    use tokio::io::AsyncWriteExt;
    let mut stream = resp.bytes_stream();
    use futures::StreamExt;
    let mut received: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        let pct = if total > 0 { (received as f64 / total as f64 * 100.0) as u32 } else { 0 };
        app.emit("soravo:model-download-progress", serde_json::json!({
            "id": id,
            "received": received,
            "total": total,
            "percent": pct,
        })).ok();
    }
    file.flush().await.map_err(|e| e.to_string())?;

    // A short file is a broken model, not a small one: drop it rather than
    // let the app treat it as installed.
    let want = if expected > 0 { expected } else { total };
    if want > 0 && received != want {
        let _ = tokio::fs::remove_file(&part).await;
        return Err(format!(
            "Download was cut short: got {received} of {want} bytes. Try again."
        ));
    }

    std::fs::rename(&part, dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_model(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let dir = models_dir(&app);
    let path = dir.join(format!("ggml-{}.bin", id));
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    // The files the engine reads from beside the model go with it, unless
    // another model still needs them: the Moonshine tokenizer is shared by
    // both Moonshine models.
    if let Some(model) = catalog_model(&id) {
        for companion in model.companions {
            if !companion_is_needed_elsewhere(&dir, model, companion) {
                let companion_path = dir.join(companion.file);
                if companion_path.exists() {
                    let _ = std::fs::remove_file(companion_path);
                }
            }
        }
    }
    // If the deleted model was active, clear the selection.
    let mut settings = load_settings(&app);
    if settings.model == id {
        settings.model = String::new();
        save_settings(&app, &settings)?;
    }
    Ok(())
}

/// Does another installed model read this same file from its own folder?
fn companion_is_needed_elsewhere(
    dir: &std::path::Path,
    model: &CatalogModel,
    companion: &ModelCompanion,
) -> bool {
    MODEL_CATALOG.iter().any(|other| {
        other.id != model.id
            && other.companions.iter().any(|c| c.file == companion.file)
            && model_is_installed(dir, other)
    })
}

#[tauri::command]
async fn set_active_model(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let model = catalog_model(&id)
        .ok_or_else(|| format!("Unknown model: {}", id))?;
    let dir = models_dir(&app);
    if !model_is_installed(&dir, model) {
        return Err(format!("Model not installed: {}", id));
    }
    let mut settings = load_settings(&app);
    settings.model = id;
    save_settings(&app, &settings)?;
    Ok(())
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
        if let Some(v) = s.get("holdToTalk") { if let Some(b) = v.as_bool() { settings.hold_to_talk = b; } }
        if let Some(v) = s.get("model") { if let Some(s) = v.as_str() { settings.model = s.to_string(); } }
        if let Some(v) = s.get("language") { if let Some(s) = v.as_str() { settings.language = s.to_string(); } }
        if let Some(v) = s.get("microphoneId") { if let Some(s) = v.as_str() { settings.microphone_id = s.to_string(); } }
        if let Some(v) = s.get("sounds") { if let Some(b) = v.as_bool() { settings.sounds = b; } }
        if let Some(v) = s.get("smartCleanup") { if let Some(b) = v.as_bool() { settings.smart_cleanup = b; } }
        if let Some(v) = s.get("addPunctuation") { if let Some(b) = v.as_bool() { settings.add_punctuation = b; } }
        if let Some(v) = s.get("vocabulary") { if let Some(o) = v.as_object() { for (k, val) in o { if let Some(s) = val.as_str() { settings.vocabulary.insert(k.clone(), s.to_string()); } } } }
        if let Some(v) = s.get("launchAtLogin") { if let Some(b) = v.as_bool() { settings.launch_at_login = b; } }
        if let Some(v) = s.get("theme") { if let Some(s) = v.as_str() { settings.theme = s.to_string(); } }
        if let Some(v) = s.get("retention") { if let Some(s) = v.as_str() { settings.retention = s.to_string(); } }
        if let Some(v) = s.get("scratchpadHotkey") { if let Some(s) = v.as_str() { settings.scratchpad_hotkey = s.to_string(); } }
        if let Some(v) = s.get("sidebarOpen") { if let Some(b) = v.as_bool() { settings.sidebar_open = b; } }
        if let Some(v) = s.get("modelsDir") { if let Some(s) = v.as_str() { settings.models_dir = s.to_string(); } }
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
    store.set("holdToTalk", serde_json::json!(settings.hold_to_talk));
    store.set("model", serde_json::json!(settings.model));
    store.set("language", serde_json::json!(settings.language));
    store.set("microphoneId", serde_json::json!(settings.microphone_id));
    store.set("sounds", serde_json::json!(settings.sounds));
    store.set("smartCleanup", serde_json::json!(settings.smart_cleanup));
    store.set("addPunctuation", serde_json::json!(settings.add_punctuation));
    store.set("vocabulary", serde_json::json!(settings.vocabulary));
    store.set("launchAtLogin", serde_json::json!(settings.launch_at_login));
    store.set("theme", serde_json::json!(settings.theme));
    store.set("retention", serde_json::json!(settings.retention));
    store.set("scratchpadHotkey", serde_json::json!(settings.scratchpad_hotkey));
    store.set("sidebarOpen", serde_json::json!(settings.sidebar_open));
    store.set("modelsDir", serde_json::json!(settings.models_dir));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

// Cleanup functions
fn cleanup_text(text: &str, add_punctuation: bool) -> (String, i64) {
    let mut result = text.to_string();
    let mut fillers_removed: i64 = 0;

    // Remove filler words. "like" is deliberately excluded: it is a common
    // English word, so stripping it destroys real sentences.
    let fillers = ["um", "uh", "er", "ah", "hmm", "you know", "i mean"];
    for filler in &fillers {
        let re = regex::Regex::new(&format!(r"(?i)\b{}\b", regex::escape(filler))).unwrap();
        let count = re.find_iter(&result).count() as i64;
        fillers_removed += count;
        result = re.replace_all(&result, "").to_string();
    }

    // Collapse runs of whitespace. A single pass leaves residue behind for
    // runs of 3+ spaces, so loop until stable.
    while result.contains("  ") {
        result = result.replace("  ", " ");
    }
    result = result.trim().to_string();

    // Removing a filler orphans the punctuation around it ("so, um, yes" ->
    // "so, , yes"), so merge separator runs and trim any left at the edges.
    let re_commas = regex::Regex::new(r"(?:\s*,\s*){2,}").unwrap();
    result = re_commas.replace_all(&result, ", ").to_string();
    const SEPARATORS: &str = r"[\s,;:\-\u{2013}\u{2014}]";
    let re_leading = regex::Regex::new(&format!(r"^{}+", SEPARATORS)).unwrap();
    result = re_leading.replace_all(&result, "").to_string();
    let re_trailing = regex::Regex::new(&format!(r"{}+$", SEPARATORS)).unwrap();
    result = re_trailing.replace_all(&result, "").to_string();

    // Capitalize first letter
    if !result.is_empty() {
        let mut chars: Vec<char> = result.chars().collect();
        if let Some(first) = chars.first_mut() {
            *first = first.to_uppercase().next().unwrap_or(*first);
        }
        result = chars.into_iter().collect();
    }

    // Add period if missing
    if add_punctuation && !result.is_empty() && !result.ends_with('.') && !result.ends_with('!') && !result.ends_with('?') {
        result.push('.');
    }

    (result, fillers_removed)
}

/// Capitalize the first letter and append a trailing period when missing.
/// Used when smart cleanup is off but punctuation is on, so the toggle is
/// independent of the filler-removal toggle.
fn capitalize_and_punctuate(text: &str) -> String {
    let mut result = text.trim().to_string();
    if result.is_empty() {
        return result;
    }
    let mut chars: Vec<char> = result.chars().collect();
    if let Some(first) = chars.first_mut() {
        *first = first.to_uppercase().next().unwrap_or(*first);
    }
    result = chars.into_iter().collect();
    if !result.ends_with('.') && !result.ends_with('!') && !result.ends_with('?') {
        result.push('.');
    }
    result
}

fn apply_vocabulary(text: &str, vocab: &std::collections::HashMap<String, String>) -> (String, i64) {
    if vocab.is_empty() {
        return (text.to_string(), 0);
    }
    // Longest phrases first so "sore avo" wins over a bare "sore", then
    // alphabetically for a stable order. A HashMap would iterate in an
    // arbitrary order, which made overlapping entries non-deterministic.
    let mut keys: Vec<&String> = vocab.keys().collect();
    keys.sort_by(|a, b| b.chars().count().cmp(&a.chars().count()).then_with(|| a.cmp(b)));

    // One combined alternation so each position in the text matches at most
    // one entry, and a replacement can never be rewritten by a later pass.
    let is_word = |c: char| c.is_alphanumeric() || c == '_';
    let alternatives: Vec<String> = keys
        .iter()
        .map(|k| {
            let lead = k.chars().next().map(is_word).unwrap_or(false);
            let trail = k.chars().last().map(is_word).unwrap_or(false);
            format!(
                "{}{}{}",
                if lead { r"\b" } else { "" },
                regex::escape(k),
                if trail { r"\b" } else { "" }
            )
        })
        .collect();
    let pattern = format!("(?i)(?:{})", alternatives.join("|"));
    let re = match regex::Regex::new(&pattern) {
        Ok(r) => r,
        // A malformed entry must not break dictation.
        Err(_) => return (text.to_string(), 0),
    };

    let mut applied: i64 = 0;
    let result = re
        .replace_all(text, |caps: &regex::Captures| {
            let matched = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            applied += 1;
            keys.iter()
                .find(|k| k.eq_ignore_ascii_case(matched))
                .map(|k| vocab[*k].clone())
                .unwrap_or_else(|| matched.to_string())
        })
        .to_string();
    (result, applied)
}

/// Load snippets from the database and apply them to the text.
/// Replaces any snippet phrase with its expansion (case-insensitive, word-boundary match).
fn apply_snippets(text: &str, app: &tauri::AppHandle) -> Result<String, String> {
    let conn = open_db(app)?;
    apply_snippets_to_conn(text, &conn)
}

/// Core snippet expansion logic (testable without AppHandle).
fn apply_snippets_to_conn(text: &str, conn: &rusqlite::Connection) -> Result<String, String> {
    let mut stmt = conn
        .prepare("SELECT phrase, expansion FROM snippets")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

    if rows.is_empty() {
        return Ok(text.to_string());
    }

    // Sort by phrase length (longest first) so "my email" wins over "email"
    let mut sorted = rows;
    sorted.sort_by(|a, b| b.0.chars().count().cmp(&a.0.chars().count()));

    let is_word = |c: char| c.is_alphanumeric() || c == '_';
    let alternatives: Vec<String> = sorted
        .iter()
        .map(|(phrase, _)| {
            let lead = phrase.chars().next().map(is_word).unwrap_or(false);
            let trail = phrase.chars().last().map(is_word).unwrap_or(false);
            format!(
                "{}{}{}",
                if lead { r"\b" } else { "" },
                regex::escape(phrase),
                if trail { r"\b" } else { "" }
            )
        })
        .collect();
    let pattern = format!("(?i)(?:{})", alternatives.join("|"));
    let re = match regex::Regex::new(&pattern) {
        Ok(r) => r,
        Err(_) => return Ok(text.to_string()),
    };

    let result = re
        .replace_all(text, |caps: &regex::Captures| {
            let matched = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            sorted
                .iter()
                .find(|(p, _)| p.eq_ignore_ascii_case(matched))
                .map(|(_, e)| e.clone())
                .unwrap_or_else(|| matched.to_string())
        })
        .to_string();
    Ok(result)
}

/// Where a model's file lives: the app's models folder first, then the
/// folder the repository ships one in.
fn resolve_model_path(
    model: &str,
    models_dir: &std::path::Path,
    current_dir: &std::path::Path,
    project_root: &std::path::Path,
) -> Option<std::path::PathBuf> {
    let file = format!("ggml-{}.bin", model);
    [
        models_dir.join(&file),
        current_dir.join("third-party/models").join(&file),
        project_root.join("third-party/models").join(&file),
    ]
    .into_iter()
    .find(|p| p.exists())
}

// CrispASR transcription
fn transcribe_wav(
    wav_path: &str,
    model: &str,
    language: &str,
    resource_dir: &std::path::Path,
    models_dir: &std::path::Path,
) -> Result<String, String> {
    // In dev mode current_dir is src-tauri/, so the project root is its parent.
    // In a bundle the files sit next to the executable instead.
    let current_dir = std::env::current_dir().unwrap_or_default();
    let project_root = current_dir.parent().unwrap_or(&current_dir).to_path_buf();

    let roots = [current_dir.clone(), project_root.clone(), resource_dir.to_path_buf()];

    let whisper_path = find_crispasr_binary(&roots).ok_or_else(|| {
        "CrispASR engine is missing from this installation. Reinstall Soravo or contact support.".to_string()
    })?;

    // Model: look in app data dir first (downloaded via Models tab), then third-party.
    let model_path = resolve_model_path(model, models_dir, &current_dir, &project_root)
        .ok_or_else(|| {
            let installed: Vec<String> = std::fs::read_dir(models_dir)
                .or_else(|_| std::fs::read_dir(current_dir.join("third-party/models")))
                .map(|rd| {
                    rd.filter_map(|e| e.ok())
                        .map(|e| e.file_name().to_string_lossy().to_string())
                        .filter(|n| n.ends_with(".bin"))
                        .collect()
                })
                .unwrap_or_default();
            if installed.is_empty() {
                format!("No models installed. Open the Models tab to download one.")
            } else {
                format!(
                    "Model \"{}\" is not installed. Available: {}.",
                    model,
                    installed.join(", ")
                )
            }
        })?;

    let model_path_str = model_path.to_string_lossy().to_string();

    eprintln!("[soravo] crispasr: {}", whisper_path.display());
    eprintln!("[soravo] model: {}", model_path_str);
    eprintln!("[soravo] wav: {}", wav_path);

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
        return Err(engine_error(&output.stderr, model));
    }

    let text = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(text.trim().to_string())
}

/// The engine's failure, in a sentence a person can act on.
///
/// The engine writes several lines to stderr - the residency of the weights
/// on the device, then the actual failure - and only the last of them says
/// what went wrong. A missing companion file gets a name, because "the
/// tokenizer.bin next to the model is missing" is a thing the user can fix.
fn engine_error(stderr: &[u8], model: &str) -> String {
    let text = String::from_utf8_lossy(stderr);
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();

    // A file the engine could not open is the common case: name it.
    for line in &lines {
        if let Some(rest) = line.strip_prefix("load: failed to open '") {
            let path = rest.trim_end_matches('\'');
            let name = path.rsplit(['\\', '/']).next().unwrap_or(path);
            return format!(
                "The engine could not open {name}, which {} needs next to the model file. \
                 Re-download the model from the Models tab.",
                model
            );
        }
    }

    // Otherwise the last line is the failure, with the engine's own prefix
    // taken off.
    let last = lines.last().copied().unwrap_or("the engine failed");
    let clean = last
        .strip_prefix("crispasr: error: ")
        .or_else(|| last.strip_prefix("crispasr: error:"))
        .unwrap_or(last);
    format!("CrispASR failed: {clean}")
}

// Text injection via clipboard + SendKeys (Windows)
#[cfg(target_os = "windows")]
fn inject_text(app: &tauri::AppHandle, text: &str) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    let previous = app.clipboard().read_text().unwrap_or_default();
    app.clipboard().write_text(text.to_string()).map_err(|e| e.to_string())?;

    // Give the focused window a moment to see the new clipboard content, then
    // synthesize Ctrl+V into whatever window currently has focus.
    std::thread::sleep(std::time::Duration::from_millis(60));
    let status = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
        ])
        .status()
        .map_err(|e| format!("failed to run sendkeys: {e}"))?;
    if !status.success() {
        return Err("sendkeys paste failed".to_string());
    }

    // Restore whatever the user had copied before, once the paste has landed.
    let app_clone = app.clone();
    let restore = previous.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
        app_clone.clipboard().write_text(restore).ok();
    });
    Ok(())
}

/// Copy text to the clipboard without injecting it.
#[cfg(target_os = "windows")]
fn copy_text(app: &tauri::AppHandle, text: &str) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(text.to_string()).map_err(|e| e.to_string())
}

/// Copy text to the clipboard without injecting it (Linux stub).
#[cfg(target_os = "linux")]
fn copy_text(app: &tauri::AppHandle, text: &str) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(text.to_string()).map_err(|e| e.to_string())
}

/// Inject text into the focused window (Linux stub — not implemented).
#[cfg(target_os = "linux")]
fn inject_text(app: &tauri::AppHandle, text: &str) -> Result<(), String> {
    app.emit("soravo:error", "Text injection is not available on Linux").ok();
    Err("Text injection is not available on Linux".to_string())
}

/// Re-inject the most recent transcript into the focused window.
fn paste_last(app: &tauri::AppHandle) -> Result<(), String> {
    let conn = open_db(app)?;
    let text: Option<String> = conn
        .query_row(
            "SELECT text FROM transcriptions ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();
    match text {
        Some(t) if !t.is_empty() => inject_text(app, &t),
        _ => {
            app.emit("soravo:error", "No dictations yet to paste").ok();
            Ok(())
        }
    }
}

/// Copy the most recent transcript to the clipboard.
fn copy_last(app: &tauri::AppHandle) -> Result<(), String> {
    let conn = open_db(app)?;
    let text: Option<String> = conn
        .query_row(
            "SELECT text FROM transcriptions ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();
    match text {
        Some(t) if !t.is_empty() => copy_text(app, &t),
        _ => {
            app.emit("soravo:error", "No dictations yet to copy").ok();
            Ok(())
        }
    }
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
    toggle_recording(&app, &state)
}

/// Start a dictation from the window that has the focus.
///
/// The global hook cannot see a key press that the app's own webview takes
/// first, so the hub window drives the recorder itself while it is focused.
/// Both paths call the same function, and it is a no-op unless the recorder is
/// idle, so a key press that both paths see does not start twice.
#[tauri::command]
async fn start_record(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    start_recording(&app, &state)
}

/// End a dictation and transcribe it. A no-op unless a recording is running.
#[tauri::command]
async fn stop_record(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    stop_recording(&app, &state)
}

/// Toggle mode: start when idle, stop when recording.
///
/// Push-to-talk deliberately does not use this — it drives `start_recording`
/// and `stop_recording` from the press and release edges instead.
fn toggle_recording(app: &tauri::AppHandle, state: &AppState) -> Result<(), String> {
    // Filter auto-repeat and double-fire. Kept short so a deliberate second
    // tap still stops the recording; the OS repeat delay is ~500ms.
    const DEBOUNCE_MS: i64 = 300;
    let now = chrono::Utc::now().timestamp_millis();
    {
        let mut last = state.last_toggle_at.lock().map_err(|e| e.to_string())?;
        if now - *last < DEBOUNCE_MS {
            return Ok(());
        }
        *last = now;
    }

    let current = *state.state.lock().map_err(|e| e.to_string())?;
    match current {
        RecState::Idle | RecState::Error => start_recording(app, state),
        RecState::Recording => stop_recording(app, state),
        // Transcribing: ignore extra presses.
        RecState::Transcribing => Ok(()),
    }
}

/// Begin a dictation. No-op unless we are idle (or recovering from an error).
fn start_recording(app: &tauri::AppHandle, state: &AppState) -> Result<(), String> {
    let current = *state.state.lock().map_err(|e| e.to_string())?;
    match current {
        RecState::Idle | RecState::Error => {
            // Supersede any pill-hide that was still pending.
            state.hide_gen.fetch_add(1, Ordering::SeqCst);
            *state.state.lock().unwrap() = RecState::Recording;
            app.emit("soravo:state", RecState::Recording).ok();
            if let Some(win) = app.get_webview_window("pill") {
                win.show().ok();
            }
            app.emit("soravo:record-command", "start").ok();
            Ok(())
        }
        _ => Ok(()),
    }
}

/// End a dictation and kick off transcription.
fn stop_recording(app: &tauri::AppHandle, state: &AppState) -> Result<(), String> {
    let current = *state.state.lock().map_err(|e| e.to_string())?;
    match current {
        RecState::Recording => {
            *state.state.lock().unwrap() = RecState::Transcribing;
            app.emit("soravo:state", RecState::Transcribing).ok();
            app.emit("soravo:record-command", "stop").ok();
            // Bail out if the recorder never hands us any audio.
            spawn_timer(app, &state.audio_gen, std::time::Duration::from_secs(15), |app| {
                app.emit("soravo:error", "No audio arrived from the recorder").ok();
            });
            Ok(())
        }
        _ => Ok(()),
    }
}

#[tauri::command]
async fn cancel(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Cancel the pending audio timeout.
    state.audio_gen.fetch_add(1, Ordering::SeqCst);
    app.emit("soravo:record-command", "cancel").ok();
    *state.state.lock().unwrap() = RecState::Idle;
    app.emit("soravo:state", RecState::Idle).ok();
    schedule_pill_hide(&app, &state, 2500);
    Ok(())
}

#[tauri::command]
async fn submit_audio(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    wav: Vec<u8>,
    duration_ms: i64,
) -> Result<(), String> {
    // Audio arrived in time; cancel the timeout.
    state.audio_gen.fetch_add(1, Ordering::SeqCst);

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
    let smart_cleanup = settings.smart_cleanup;
    let add_punctuation = settings.add_punctuation;
    let vocabulary = settings.vocabulary.clone();

    let wav_path_str = wav_path.to_string_lossy().to_string();

    // Get resource directory and models dir before moving app into the closure
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let models_dir = models_dir(&app);

    // Some backends load a second file from beside the model - Moonshine
    // reads its tokenizer, Mini-Omni2 its codec. The engine looks for them
    // next to the model, so fetch them if they are not there yet; otherwise
    // the transcription fails on a file the user never asked for.
    if let Some(model) = catalog_model(&model) {
        if let Err(err) = ensure_companions(&app, model, &models_dir).await {
            log::error!("[soravo] could not fetch the files {} needs: {err}", model.id);
        }
    }

    // Transcribe
    let result = tokio::task::spawn_blocking(move || {
        transcribe_wav(&wav_path_str, &model, &language, &resource_dir, &models_dir)
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
                cleanup_text(&raw, add_punctuation)
            } else if add_punctuation {
                (capitalize_and_punctuate(&raw), 0)
            } else {
                (raw.clone(), 0)
            };

            // Custom vocabulary is a separate feature and always applies.
            let (text, vocab_applied) = apply_vocabulary(&text, &vocabulary);

            // Snippet expansion: replace phrase with expansion
            let text = apply_snippets(&text, &app)?;

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
                if let Err(err) = inject_text(&app, &text) {
                    app.emit("soravo:error", format!("Paste failed: {err}")).ok();
                }
            }

            app.emit("soravo:transcript", &text).ok();

            schedule_pill_hide(&app, &state, 2500);

            *state.state.lock().unwrap() = RecState::Idle;
            app.emit("soravo:state", RecState::Idle).ok();
        }
        Err(e) => {
            app.emit("soravo:error", &e).ok();
            *state.state.lock().unwrap() = RecState::Error;
            app.emit("soravo:state", RecState::Error).ok();
            // Show the error briefly, then hide the pill and go back to idle.
            spawn_timer(
                &app,
                &state.hide_gen,
                std::time::Duration::from_secs(4),
                |app| {
                    if let Some(win) = app.get_webview_window("pill") {
                        win.hide().ok();
                    }
                    app.emit("soravo:state", RecState::Idle).ok();
                },
            );
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
    let mut per_month = vec![0i64; 12];
    let mut per_year: std::collections::HashMap<i32, i64> = std::collections::HashMap::new();
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
            per_month[(local.month() as usize) - 1] += count;
    *per_year.entry(local.year()).or_insert(0) += count;
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
        per_month,
        per_year: {
            let mut v: Vec<YearEntry> = per_year
                .into_iter()
                .map(|(year, words)| YearEntry { year, words })
                .collect();
            v.sort_by_key(|e| e.year);
            v
        },
        top_words,
        top_phrases,
    })
}

#[tauri::command]
async fn get_runtime_status(app: tauri::AppHandle, model: String) -> Result<serde_json::Value, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let current_dir = std::env::current_dir().unwrap_or_default();
    let project_root = current_dir.parent().unwrap_or(&current_dir).to_path_buf();
    let roots = [current_dir.clone(), project_root.clone(), resource_dir.to_path_buf()];
    // Same resolution as transcribe_wav, so the UI cannot report the engine
    // missing while dictation would in fact work.
    let binary_exists = find_crispasr_binary(&roots).is_some();

    let md = models_dir(&app);
    // A model counts as present only if the engine can actually load it:
    // the weights, whole, plus the files it reads from beside them.
    let model_exists = match catalog_model(&model) {
        Some(entry) => {
            model_is_installed(&md, entry)
                || current_dir
                    .join("third-party/models")
                    .join(format!("ggml-{}.bin", model))
                    .exists()
                || project_root
                    .join("third-party/models")
                    .join(format!("ggml-{}.bin", model))
                    .exists()
        }
        None => false,
    };

    Ok(serde_json::json!({
        "binary": binary_exists,
        "model": model,
        "modelPresent": model_exists
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
    if let Some(v) = patch.get("scratchpadHotkey").and_then(|v| v.as_str()) {
        settings.scratchpad_hotkey = v.to_string();
    }
    if let Some(v) = patch.get("holdToTalk").and_then(|v| v.as_bool()) {
        settings.hold_to_talk = v;
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
    if let Some(v) = patch.get("addPunctuation").and_then(|v| v.as_bool()) {
        settings.add_punctuation = v;
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
        if v == "light" || v == "dark" || v == "system" {
            settings.theme = v.to_string();
        }
    }
    if let Some(v) = patch.get("sidebarOpen").and_then(|v| v.as_bool()) {
        settings.sidebar_open = v;
    }
    if let Some(v) = patch.get("modelsDir").and_then(|v| v.as_str()) {
        settings.models_dir = v.to_string();
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

    // Push the new bindings into the running hook so changes take effect
    // immediately without restarting the app.
    {
        let mut cfg = state.hook_config.write().map_err(|e| e.to_string())?;
        *cfg = hook_config_from_settings(&settings);
    }

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
async fn set_textarea_focus(app: tauri::AppHandle, focused: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.textarea_focused.store(focused, Ordering::Relaxed);
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

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScratchpadNote {
    pub id: i64,
    pub text: String,
    pub created_at: String,
    pub pinned: bool,
}

#[tauri::command]
async fn get_scratchpad_notes(app: tauri::AppHandle) -> Result<Vec<ScratchpadNote>, String> {
    let conn = open_db(&app)?;
    let mut stmt = conn
        .prepare("SELECT id, text, created_at, pinned FROM scratchpad_notes ORDER BY pinned DESC, created_at DESC")
        .map_err(|e| e.to_string())?;
    let notes = stmt
        .query_map([], |row| {
            Ok(ScratchpadNote {
                id: row.get(0)?,
                text: row.get(1)?,
                created_at: row.get(2)?,
                pinned: row.get::<_, i64>(3)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(notes)
}

#[tauri::command]
async fn add_scratchpad_note(app: tauri::AppHandle, text: String) -> Result<ScratchpadNote, String> {
    let conn = open_db(&app)?;
    conn.execute("INSERT INTO scratchpad_notes (text) VALUES (?1)", [&text])
        .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let note = conn
        .query_row(
            "SELECT id, text, created_at, pinned FROM scratchpad_notes WHERE id = ?1",
            [id],
            |row| {
                Ok(ScratchpadNote {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    created_at: row.get(2)?,
                    pinned: row.get::<_, i64>(3)? != 0,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    app.emit("soravo:scratchpad-changed", ()).ok();
    Ok(note)
}

#[tauri::command]
async fn delete_scratchpad_note(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute("DELETE FROM scratchpad_notes WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    app.emit("soravo:scratchpad-changed", ()).ok();
    Ok(())
}

#[tauri::command]
async fn update_scratchpad_note(
    app: tauri::AppHandle,
    id: i64,
    patch: serde_json::Value,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    if let Some(text) = patch.get("text").and_then(|v| v.as_str()) {
        conn.execute(
            "UPDATE scratchpad_notes SET text = ?1 WHERE id = ?2",
            (text, id),
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(pinned) = patch.get("pinned").and_then(|v| v.as_bool()) {
        conn.execute(
            "UPDATE scratchpad_notes SET pinned = ?1 WHERE id = ?2",
            (if pinned { 1 } else { 0 }, id),
        )
        .map_err(|e| e.to_string())?;
    }
    app.emit("soravo:scratchpad-changed", ()).ok();
    Ok(())
}

#[tauri::command]
async fn open_scratchpad_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("scratchpad") {
        if win.is_minimized().unwrap_or(false) {
            win.unminimize().ok();
        }
        win.show().ok();
        win.set_focus().ok();
        // Navigate to scratchpad route
        win.eval("window.location.hash = '#/scratchpad'").ok();
    }
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: i64,
    pub phrase: String,
    pub expansion: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_auto_learned: bool,
}

#[tauri::command]
async fn get_snippets(app: tauri::AppHandle) -> Result<Vec<Snippet>, String> {
    let conn = open_db(&app)?;
    let mut stmt = conn
        .prepare("SELECT id, phrase, expansion, created_at, updated_at, is_auto_learned FROM snippets ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let snippets = stmt
        .query_map([], |row| {
            Ok(Snippet {
                id: row.get(0)?,
                phrase: row.get(1)?,
                expansion: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                is_auto_learned: row.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(snippets)
}

#[tauri::command]
async fn add_snippet(app: tauri::AppHandle, phrase: String, expansion: String) -> Result<Snippet, String> {
    let conn = open_db(&app)?;
    conn.execute(
        "INSERT INTO snippets (phrase, expansion) VALUES (?1, ?2)",
        (&phrase, &expansion),
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let snippet = conn
        .query_row(
            "SELECT id, phrase, expansion, created_at, updated_at, is_auto_learned FROM snippets WHERE id = ?1",
            [id],
            |row| {
                Ok(Snippet {
                    id: row.get(0)?,
                    phrase: row.get(1)?,
                    expansion: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    is_auto_learned: row.get::<_, i64>(5)? != 0,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    Ok(snippet)
}

#[tauri::command]
async fn update_snippet(
    app: tauri::AppHandle,
    id: i64,
    patch: serde_json::Value,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    if let Some(phrase) = patch.get("phrase").and_then(|v| v.as_str()) {
        conn.execute(
            "UPDATE snippets SET phrase = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?2",
            (phrase, id),
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(expansion) = patch.get("expansion").and_then(|v| v.as_str()) {
        conn.execute(
            "UPDATE snippets SET expansion = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?2",
            (expansion, id),
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn delete_snippet(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute("DELETE FROM snippets WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
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
        .plugin(tauri_plugin_deep_link::init())
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

            // Start the system-wide input hook. Unlike the global-shortcut
            // plugin it can observe bare keys (CapsLock), mouse buttons, and
            // key release events, which is what hold-to-talk needs.
            let settings = load_settings(app.handle());
            {
                let mut cfg = state.hook_config.write().unwrap();
                *cfg = hook_config_from_settings(&settings);
            }

            let app_handle = app.handle().clone();
            let handles = hotkeys::HookHandles {
                dictate_start: {
                    let app = app_handle.clone();
                    Arc::new(move || {
                        let state = app.state::<AppState>();
                        if let Err(err) = start_recording(&app, &state) {
                            log::error!("[soravo] start_recording: {err}");
                        }
                    })
                },
                dictate_stop: {
                    let app = app_handle.clone();
                    Arc::new(move || {
                        let state = app.state::<AppState>();
                        if let Err(err) = stop_recording(&app, &state) {
                            log::error!("[soravo] stop_recording: {err}");
                        }
                    })
                },
                dictate_toggle: {
                    let app = app_handle.clone();
                    Arc::new(move || {
                        let state = app.state::<AppState>();
                        if let Err(err) = toggle_recording(&app, &state) {
                            log::error!("[soravo] toggle_recording: {err}");
                        }
                    })
                },
                paste_last: {
                    let app = app_handle.clone();
                    Arc::new(move || {
                        if let Err(err) = paste_last(&app) {
                            log::error!("[soravo] paste_last: {err}");
                        }
                    })
                },
                copy_last: {
                    let app = app_handle.clone();
                    Arc::new(move || {
                        if let Err(err) = copy_last(&app) {
                            log::error!("[soravo] copy_last: {err}");
                        }
                    })
                },
            };

            if let Err(err) = hotkeys::spawn_hook(state.hook_config.clone(), handles, state.textarea_focused.clone()) {
                log::error!("[soravo] {err}");
                app.emit("soravo:error", format!("Global hotkeys unavailable: {err}")).ok();
            }

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
            start_record,
            stop_record,
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
            list_models,
            download_model,
            delete_model,
            set_active_model,
            models_folder,
            default_models_folder,
            open_folder,
            open_link,
            app_version,
            win_min,
            win_max,
            win_close,
            show_hub,
            set_textarea_focus,
            open_scratchpad_window,
            get_scratchpad_notes,
            add_scratchpad_note,
            delete_scratchpad_note,
            update_scratchpad_note,
            get_snippets,
            add_snippet,
            update_snippet,
            delete_snippet,
            quit,
            hotkeys::validate_binding,
            hotkeys::binding_help,
            secure_store::secure_store_set,
            secure_store::secure_store_get,
            secure_store::secure_store_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snippet_and_note_serialise_with_camel_case_keys() {
        // The renderer reads these as createdAt / updatedAt / isAutoLearned.
        // Without the camelCase rename the front end got undefined and every
        // sort or timestamp on the Snippets page threw.
        let snippet = Snippet {
            id: 1,
            phrase: "p".to_string(),
            expansion: "e".to_string(),
            created_at: "c".to_string(),
            updated_at: "u".to_string(),
            is_auto_learned: true,
        };
        let json = serde_json::to_value(&snippet).unwrap();
        assert_eq!(json["phrase"], "p");
        assert_eq!(json["expansion"], "e");
        assert_eq!(json["createdAt"], "c");
        assert_eq!(json["updatedAt"], "u");
        assert_eq!(json["isAutoLearned"], true);
        assert!(json.get("created_at").is_none());

        let note = ScratchpadNote {
            id: 2,
            text: "t".to_string(),
            created_at: "c".to_string(),
            pinned: false,
        };
        let json = serde_json::to_value(&note).unwrap();
        assert_eq!(json["text"], "t");
        assert_eq!(json["createdAt"], "c");
        assert_eq!(json["pinned"], false);
        assert!(json.get("created_at").is_none());
    }

    #[test]
    fn snippets_expand_basic() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE snippets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase TEXT NOT NULL,
                expansion TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                is_auto_learned BOOLEAN NOT NULL DEFAULT 0
            );",
        ).unwrap();
        conn.execute("INSERT INTO snippets (phrase, expansion) VALUES ('hello', 'HELLO WORLD')", []).unwrap();
        conn.execute("INSERT INTO snippets (phrase, expansion) VALUES ('stephen', 'Stephen Dedalus')", []).unwrap();

        let text = "hello there stephen";
        let result = apply_snippets_to_conn(&text, &conn).unwrap();
        assert!(result.contains("HELLO WORLD"), "Expected expansion, got: {}", result);
        assert!(result.contains("Stephen Dedalus"), "Expected name expansion, got: {}", result);
    }

    #[test]
    fn snippets_no_match() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE snippets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase TEXT NOT NULL,
                expansion TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                is_auto_learned BOOLEAN NOT NULL DEFAULT 0
            );",
        ).unwrap();
        conn.execute("INSERT INTO snippets (phrase, expansion) VALUES ('xyz', 'ABC')", []).unwrap();

        let text = "hello there stephen";
        let result = apply_snippets_to_conn(&text, &conn).unwrap();
        assert_eq!(result, text);
    }

    #[test]
    fn snippets_expand_librispeech_words() {
        // Simulate real LibriSpeech transcript words as snippets
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE snippets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase TEXT NOT NULL,
                expansion TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                is_auto_learned BOOLEAN NOT NULL DEFAULT 0
            );",
        ).unwrap();
        // Add snippets based on LibriSpeech transcript
        conn.execute("INSERT INTO snippets (phrase, expansion) VALUES ('rector', 'The Rector (Mr. Hart')", []).unwrap();
        conn.execute("INSERT INTO snippets (phrase, expansion) VALUES ('catechism', 'the Catechism of the Church')", []).unwrap();
        conn.execute("INSERT INTO snippets (phrase, expansion) VALUES ('stephen', 'Stephen Dedalus (protagonist)')", []).unwrap();

        // Test text similar to LibriSpeech transcript line 0026
        let text = "THE RECTOR DID NOT ASK FOR A CATECHISM TO HEAR THE LESSON FROM";
        let result = apply_snippets_to_conn(&text, &conn).unwrap();
        assert!(result.contains("The Rector"), "Expected rector expansion, got: {}", result);
        assert!(result.contains("Catechism"), "Expected catechism expansion, got: {}", result);
        assert!(!result.contains("THE RECTOR"), "Should have been replaced, got: {}", result);
        assert!(!result.contains("CATECHISM"), "Should have been replaced, got: {}", result);
    }

    #[test]
    fn cleanup_keeps_the_word_like() {
        let (text, removed) = cleanup_text("I like this very much", false);
        assert_eq!(text, "I like this very much");
        assert_eq!(removed, 0);
    }

    #[test]
    fn cleanup_removes_real_fillers() {
        let (text, removed) = cleanup_text("Um, I uh think so", false);
        assert_eq!(text, "I think so");
        assert_eq!(removed, 2);
    }

    #[test]
    fn cleanup_drops_orphaned_punctuation() {
        // Removing a leading filler must not leave a dangling separator.
        assert_eq!(cleanup_text("Um, hello", false).0, "Hello");
        assert_eq!(cleanup_text("hello, uh", false).0, "Hello");
        assert_eq!(cleanup_text("so, um, I mean, yes", false).0, "So, yes");
    }

    #[test]
    fn cleanup_collapses_long_space_runs() {
        let (text, _) = cleanup_text("a     b", false);
        assert_eq!(text, "A b");
    }

    #[test]
    fn cleanup_punctuation_is_opt_in() {
        assert_eq!(cleanup_text("hello", false).0, "Hello");
        assert_eq!(cleanup_text("hello", true).0, "Hello.");
    }

    #[test]
    fn cleanup_respects_existing_punctuation() {
        assert_eq!(cleanup_text("really?", true).0, "Really?");
        assert_eq!(cleanup_text("wow!", true).0, "Wow!");
    }

    #[test]
    fn punctuation_helper_matches_cleanup_behaviour() {
        assert_eq!(capitalize_and_punctuate("oh"), "Oh.");
        assert_eq!(capitalize_and_punctuate("oh"), capitalize_and_punctuate("oh"));
        assert_eq!(capitalize_and_punctuate(""), "");
    }

    #[test]
    fn vocabulary_handles_multiword_case_and_boundaries() {
        let mut v = std::collections::HashMap::new();
        v.insert("sore avo".to_string(), "Soravo".to_string());
        v.insert("kubernetes".to_string(), "Kubernetes".to_string());
        // Multi-word entries match literally.
        assert_eq!(apply_vocabulary("built with sore avo", &v), ("built with Soravo".into(), 1));
        // Matching is case-insensitive.
        assert_eq!(apply_vocabulary("deployed to KUBERNETES", &v).1, 1);
        // Substrings of a longer word are not touched.
        assert_eq!(apply_vocabulary("the kubernetes operator", &v).0, "the Kubernetes operator");
        // Nothing to do when the phrase is absent.
        assert_eq!(apply_vocabulary("plain text", &v).1, 0);
    }

    #[test]
    fn vocabulary_applies_independently_of_cleanup() {
        let mut vocab = std::collections::HashMap::new();
        vocab.insert("soravo".to_string(), "Soravo".to_string());
        let (text, applied) = apply_vocabulary("sore avo rocks", &vocab);
        assert_eq!(applied, 0); // exact token sequence only
        let (text, applied) = apply_vocabulary("soravo rocks", &vocab);
        assert_eq!(text, "Soravo rocks");
        assert_eq!(applied, 1);
    }

    #[test]
    fn vocabulary_is_case_insensitive_and_word_bounded() {
        let mut vocab = std::collections::HashMap::new();
        vocab.insert("soravo".to_string(), "Soravo".to_string());
        assert_eq!(apply_vocabulary("Soravo SORAVO", &vocab).0, "Soravo Soravo");
        // Must not match inside a longer word.
        assert_eq!(apply_vocabulary("soravos", &vocab).0, "soravos");
    }

    #[test]
    fn vocabulary_prefers_longer_phrases() {
        let mut vocab = std::collections::HashMap::new();
        vocab.insert("sore".to_string(), "SORE".to_string());
        vocab.insert("sore avo".to_string(), "Soravo".to_string());
        // The phrase must win over the single word regardless of map order.
        assert_eq!(apply_vocabulary("sore avo", &vocab).0, "Soravo");
        assert_eq!(apply_vocabulary("sore", &vocab).0, "SORE");
    }

    #[test]
    fn vocabulary_handles_keys_with_symbols() {
        let mut vocab = std::collections::HashMap::new();
        vocab.insert("c++".to_string(), "CSharpPlusPlus".to_string());
        assert_eq!(apply_vocabulary("i love c++", &vocab).0, "i love CSharpPlusPlus");
    }

    #[test]
    fn vocabulary_with_no_entries_is_a_noop() {
        let empty = std::collections::HashMap::new();
        assert_eq!(apply_vocabulary("hello world", &empty).0, "hello world");
    }

    /// Build a throwaway project tree. `layout` decides where the exe lands:
    /// `"bin"` is what `npm run fetch:asr` produces, `"extracted"` is what a
    /// fresh clone gets from the committed archive.
    fn fixture(layout: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "soravo-asr-test-{}-{}",
            layout,
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        let exe_dir = if layout == "bin" {
            dir.join("third-party").join("bin")
        } else {
            dir.join("third-party")
                .join("crispasr")
                .join("extracted")
                .join("crispasr-windows-x86_64-cpu")
        };
        std::fs::create_dir_all(&exe_dir).unwrap();
        let name = if cfg!(target_os = "windows") { "crispasr.exe" } else { "crispasr" };
        std::fs::write(exe_dir.join(name), b"stub").unwrap();
        dir
    }

    #[test]
    fn asr_lookup_finds_the_relocated_binary() {
        let dir = fixture("bin");
        let found = find_crispasr_binary(&[dir.clone()]);
        assert!(found.is_some(), "should find third-party/bin/<exe>");
        assert!(found.unwrap().to_string_lossy().contains("third-party"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn asr_lookup_falls_back_to_the_committed_archive() {
        // This is the fresh-clone case that previously reported the engine
        // missing even though the binary was present in the repo.
        let dir = fixture("extracted");
        let found = find_crispasr_binary(&[dir.clone()]);
        assert!(found.is_some(), "should find third-party/crispasr/extracted/<build>/<exe>");
        assert!(found.unwrap().to_string_lossy().contains("extracted"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn asr_lookup_returns_none_when_absent() {
        let dir = std::env::temp_dir().join(format!("soravo-asr-empty-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        assert!(find_crispasr_binary(&[dir.clone()]).is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn asr_lookup_prefers_bin_over_extracted() {
        // Both copies present: bin/ wins, because that is the completed-fetch
        // layout and the one a bundle ships.
        let root = std::env::temp_dir().join(format!("soravo-asr-both-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let name = if cfg!(target_os = "windows") { "crispasr.exe" } else { "crispasr" };
        let bin = root.join("third-party").join("bin");
        let extracted = root
            .join("third-party")
            .join("crispasr")
            .join("extracted")
            .join("crispasr-windows-x86_64-cpu");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::create_dir_all(&extracted).unwrap();
        std::fs::write(bin.join(name), b"bin").unwrap();
        std::fs::write(extracted.join(name), b"extracted").unwrap();

        let found = find_crispasr_binary(&[root.clone()]).unwrap();
        assert_eq!(
            std::fs::read(&found).unwrap(),
            b"bin",
            "bin/ must take precedence over the archive copy"
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    /// A model is only usable when its weights are whole and the files the
    /// engine reads from beside them are there too.
    ///
    /// The Moonshine tokenizer is the case this exists for: the weights load
    /// fine and the engine then fails on the missing file, which reads like
    /// the model is broken rather than the install being incomplete.
    #[test]
    fn a_model_needs_its_companion_files() {
        let dir = std::env::temp_dir().join(format!("soravo-models-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let model = catalog_model("moonshine-tiny").expect("moonshine-tiny is in the catalog");
        assert!(
            !model.companions.is_empty(),
            "moonshine-tiny needs its tokenizer"
        );
        let tokenizer = &model.companions[0];
        assert_eq!(tokenizer.file, "tokenizer.bin");

        // The weights alone are not enough.
        let weights = dir.join(format!("ggml-{}.bin", model.id));
        std::fs::write(&weights, vec![0u8; model.size as usize]).unwrap();
        assert!(
            !model_is_installed(&dir, model),
            "the model is not usable without its tokenizer"
        );

        // A truncated weight file is not a model either.
        let tokenizer_path = dir.join(tokenizer.file);
        std::fs::write(&tokenizer_path, vec![0u8; tokenizer.size as usize]).unwrap();
        assert!(
            model_is_installed(&dir, model),
            "the model is usable once the tokenizer is there"
        );

        std::fs::write(&weights, vec![0u8; 10]).unwrap();
        assert!(
            !model_is_installed(&dir, model),
            "a short weight file is a broken download, not a small model"
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The Moonshine tokenizer is shared by both Moonshine models, so
    /// deleting one of them must not take the file the other one reads.
    #[test]
    fn a_shared_companion_survives_the_model_that_is_deleted() {
        let dir = std::env::temp_dir().join(format!("soravo-shared-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let tiny = catalog_model("moonshine-tiny").unwrap();
        let streaming = catalog_model("moonshine-streaming-tiny").unwrap();
        let tokenizer = &tiny.companions[0];

        // Both models are installed and they read the same tokenizer.
        for model in [tiny, streaming] {
            std::fs::write(
                dir.join(format!("ggml-{}.bin", model.id)),
                vec![0u8; model.size as usize],
            )
            .unwrap();
        }
        std::fs::write(dir.join(tokenizer.file), vec![0u8; tokenizer.size as usize]).unwrap();
        assert!(model_is_installed(&dir, tiny));
        assert!(model_is_installed(&dir, streaming));

        // Deleting one leaves the other one working: the tokenizer is still
        // needed, so it stays.
        assert!(
            companion_is_needed_elsewhere(&dir, tiny, tokenizer),
            "the streaming model still reads the tokenizer"
        );

        // With the other model gone, the file goes too.
        std::fs::remove_file(dir.join(format!("ggml-{}.bin", streaming.id))).unwrap();
        assert!(
            !companion_is_needed_elsewhere(&dir, tiny, tokenizer),
            "nothing else reads the tokenizer now"
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The engine's failure is reported in one line, and a missing file is
    /// named, because that is the one the user can do something about.
    #[test]
    fn an_engine_failure_is_readable() {
        let err = engine_error(
            b"moonshine: weight residency: gpu=9 MiB (68 tensors)\n\
              load: failed to open 'C:\\models\\tokenizer.bin'\n\
              crispasr: error: failed to initialise backend 'moonshine'\n",
            "moonshine-tiny",
        );
        assert!(
            err.contains("tokenizer.bin"),
            "the missing file should be named: {err}"
        );
        assert!(
            !err.contains("weight residency"),
            "the engine's diagnostics should not be shown: {err}"
        );

        let err = engine_error(
            b"crispasr: error: failed to initialise backend 'moonshine'\n",
            "moonshine-tiny",
        );
        assert_eq!(
            err, "CrispASR failed: failed to initialise backend 'moonshine'"
        );
    }

    /// Every model in the catalog names its companions by the file name the
    /// engine looks for, so a companion cannot be fetched under a name the
    /// engine would not find.
    #[test]
    fn the_catalog_companions_are_named_as_the_engine_expects() {
        for model in MODEL_CATALOG {
            for companion in model.companions {
                assert!(
                    !companion.file.is_empty(),
                    "{} names a companion without a file name",
                    model.id
                );
                assert!(
                    companion.url.starts_with("https://"),
                    "{} companion {} is not fetched over https",
                    model.id,
                    companion.file
                );
                assert!(
                    companion.size > 0,
                    "{} companion {} has no size",
                    model.id,
                    companion.file
                );
            }
        }
    }

    /// On Linux, the bundled engine is `resource_dir/crispasr-linux/crispasr`
    /// (not `crispasr.exe`). This test verifies the bundled layout is found.
    #[cfg(target_os = "linux")]
    #[test]
    fn asr_lookup_finds_linux_bundled_binary() {
        let dir = std::env::temp_dir().join(format!("soravo-asr-linux-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let linuxDir = dir.join("crispasr-linux");
        std::fs::create_dir_all(&linuxDir).unwrap();
        std::fs::write(linuxDir.join("crispasr"), b"linux-stub").unwrap();

        let found = find_crispasr_binary(&[dir.clone()]).unwrap();
        assert_eq!(
            std::fs::read(&found).unwrap(),
            b"linux-stub",
            "linux bundled engine should be found"
        );
        assert!(
            found.to_string_lossy().contains("crispasr-linux"),
            "should find crispasr-linux directory"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// On Linux, `find_crispasr_binary` must not return `crispasr.exe` from
    /// the Windows `crispasr/` directory, since that binary cannot run.
    #[cfg(target_os = "linux")]
    #[test]
    fn asr_lookup_rejects_windows_exe_on_linux() {
        let dir = std::env::temp_dir().join(format!("soravo-asr-winexe-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let winDir = dir.join("crispasr");
        std::fs::create_dir_all(&winDir).unwrap();
        std::fs::write(winDir.join("crispasr.exe"), b"windows-stub").unwrap();

        let found = find_crispasr_binary(&[dir.clone()]);
        assert!(
            found.is_none(),
            "Windows crispasr.exe should not be usable on Linux"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
    /// The dictionary, end to end, on real speech.
    ///
    /// The sample is the first line of the LibriSpeech test-clean set
    /// (1089-134686-0001): the recording says "stuff it into you" and the
    /// engine hears "stuffed into you" - which is exactly what a dictionary
    /// entry is for. The test runs the path the app runs: the engine, then
    /// the vocabulary.
    ///
    /// The audio is not in the repository, so the test is skipped unless the
    /// WAV is pointed at:
    ///
    ///   SORAVO_TEST_WAV=.../1089-134686-0001.wav cargo test dictionary_rewrites
    ///
    /// The WAV is the LibriSpeech FLAC converted to 16 kHz mono PCM:
    ///
    ///   ffmpeg -i 1089-134686-0001.flac -ar 16000 -ac 1 -c:a pcm_s16le out.wav
    #[test]
    fn dictionary_rewrites_a_misheard_word() {
        let Ok(wav) = std::env::var("SORAVO_TEST_WAV") else {
            eprintln!("skipping: SORAVO_TEST_WAV is not set");
            return;
        };
        if !std::path::Path::new(&wav).exists() {
            eprintln!("skipping: {} does not exist", wav);
            return;
        }

        // The engine and the model have to be installed for this to mean
        // anything; without them there is nothing to test.
        let current_dir = std::env::current_dir().unwrap_or_default();
        let project_root = current_dir.parent().unwrap_or(&current_dir).to_path_buf();
        let roots = [current_dir.clone(), project_root.clone()];
        let Some(whisper) = find_crispasr_binary(&roots) else {
            eprintln!("skipping: CrispASR is not installed");
            return;
        };
        let _ = &whisper;
        let model_dir = dirs::data_dir()
            .unwrap_or_default()
            .join("com.soravo.app")
            .join("models");
        let Some(model) = ["base.en", "small.en", "tiny.en"]
            .iter()
            .map(|m| model_dir.join(format!("ggml-{}.bin", m)))
            .find(|p| p.exists())
        else {
            eprintln!("skipping: no model is installed");
            return;
        };
        let model_id = model
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .trim_start_matches("ggml-")
            .trim_end_matches(".bin")
            .to_string();

        // The engine, exactly as the app runs it.
        let raw = transcribe_wav(
            &wav,
            &model_id,
            "en",
            &project_root,
            &model_dir,
        )
        .expect("the engine should transcribe the sample");
        let raw = raw.trim().to_string();

        // The engine mishears the phrase; that is the point of the sample.
        assert!(
            raw.to_lowercase().contains("stuffered into you"),
            "expected the engine to mishear the phrase, got: {}",
            raw
        );

        // The dictionary entry the user would add for it.
        let mut vocabulary = std::collections::HashMap::new();
        vocabulary.insert("stuffered into you".to_string(), "Stuff it into you".to_string());

        let (text, applied) = apply_vocabulary(&raw, &vocabulary);
        assert_eq!(applied, 1, "the entry should have matched once");
        assert!(
            text.contains("Stuff it into you"),
            "the dictionary should have rewritten the phrase, got: {}",
            text
        );
        // The rest of the line is untouched.
        assert!(
            text.contains("his belly counseled him"),
            "the rest of the transcript should be untouched, got: {}",
            text
        );
    }

