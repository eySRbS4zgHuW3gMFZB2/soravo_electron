//! The dictation interaction state machine.
//!
//! This module is the single source of truth for the two supported
//! interaction modes:
//!
//! * **Push-to-talk** — press and hold the dictation hotkey to record,
//!   release to stop, transcribe and paste. A hold of at least
//!   [`DOUBLE_PRESS_MS`] stops immediately on release; a quick tap (shorter
//!   than that) is treated as a potential first half of a double-press, so
//!   the stop is deferred by at most [`DOUBLE_PRESS_MS`] while the machine
//!   waits for a second press.
//! * **Hands-free** — a quick tap followed by a second press within
//!   [`DOUBLE_PRESS_MS`] enters a persistent recording that survives the
//!   release. The cross cancels and discards; the tick (or pressing the
//!   hotkey) finishes, transcribes and pastes.
//!
//! A single click never starts a persistent recording. There is no toggle
//! mode and no third interaction mode.
//!
//! Every session carries a monotonic `session_id`. The renderer and any
//! asynchronous completion handler must check it before acting on a session,
//! which is what makes stale events deterministically harmless.
//!
//! The FSM is pure: it performs no I/O, reads an injected clock, and returns
//! a list of [`Action`]s for the caller to execute. That keeps the whole
//! interaction model unit-testable without a display server.

use std::time::Duration;

/// The largest gap between a release and the following press that still
/// counts as a double-press, and the smallest hold that stops a PTT
/// recording immediately on release.
pub const DOUBLE_PRESS_MS: i64 = 400;

/// After a failure the pill has nothing to show — it hides as abruptly as a
/// cancellation does (the hub still receives `soravo:error`). No red dot.
pub const ERROR_DISPLAY: Duration = Duration::from_millis(450);

/// How long after completion/cancellation the pill hides.
pub const TRANSIENT_DISPLAY: Duration = Duration::from_millis(450);

/// What the recorder is doing right now.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Phase {
    /// Nothing is shown; the pill is hidden.
    #[default]
    Idle,
    /// The hotkey went down; recording was requested but the audio pipeline
    /// has not confirmed yet. Shown with the same bars/no buttons UI.
    PushToTalkPending,
    /// Push-to-talk recording is live; releasing the hotkey stops it (or, for
    /// a quick tap, arms the double-press watch window).
    PushToTalkRecording,
    /// Hands-free recording is live. Survives hotkey release; ends via the
    /// tick, the cross, or a hotkey press (finish).
    HandsFreeRecording,
    /// A quick tap was released; the machine waits [`DOUBLE_PRESS_MS`] for a
    /// second press before stopping the recording. Shown like PTT.
    HandsFreePending,
    /// Recording stopped; transcription is running.
    Processing,
    /// Transcription finished and pasted. Transient; hides, then `Idle`.
    Completed,
    /// Recording was discarded. Transient; hides, then `Idle`.
    Cancelled,
    /// Something failed. The pill shows nothing (it hides immediately, like a
    /// cancellation); the failure surfaces only through the hub's `soravo:error`.
    Error,
}

/// Coarse-grained state exposed to the renderer over IPC as `soravo:state`.
/// Kept stable for backwards compatibility with the hub and the pill.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecState {
    Idle,
    Recording,
    Transcribing,
    Error,
}

impl RecState {
    pub fn from_phase(phase: Phase) -> Self {
        match phase {
            Phase::Idle | Phase::Completed | Phase::Cancelled => RecState::Idle,
            Phase::PushToTalkPending
            | Phase::PushToTalkRecording
            | Phase::HandsFreeRecording
            | Phase::HandsFreePending => RecState::Recording,
            Phase::Processing => RecState::Transcribing,
            Phase::Error => RecState::Error,
        }
    }
}

/// A raw input edge delivered by either the global hook or a webview.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Input {
    Press,
    Release,
    /// The double-press watch window elapsed without a second press.
    TapWindowElapsed,
}

/// Side effects the caller must execute after a transition.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    /// A new session began; show the pill and start the audio pipeline.
    BeginSession { session: u64, hands_free: bool },
    /// Recording confirmed live by the audio pipeline.
    AudioStarted { session: u64 },
    /// The session converted from PTT to hands-free.
    EnterHandsFree { session: u64 },
    /// A quick tap was released; arm the double-press watchdog. The caller
    /// must deliver [`Input::TapWindowElapsed`] for this session after
    /// `until_ms`.
    WatchForDoublePress { session: u64, until_ms: i64 },
    /// Recording stopped; begin transcription. The caller arms the 15 s
    /// audio-timeout watchdog.
    BeginProcessing { session: u64 },
    /// The session was cancelled; discard captured audio.
    CancelSession { session: u64 },
    /// Handle a non-fatal runtime error (mic lost, decoder failed, …).
    FailSession { session: u64, message: String },
    /// The transcription pipeline reported success.
    CompleteSession { session: u64 },
    /// The transcription pipeline reported failure.
    TranscribeFailed { session: u64, message: String },
    /// The transient (Completed/Cancelled/Error) display period elapsed.
    HideAndReset { session: u64 },
    /// The 15 s audio-timeout watchdog fired.
    AudioTimeout { session: u64 },
    /// Nothing to do.
    Ignore,
}

/// The state machine.
#[derive(Debug)]
pub struct Dictation {
    phase: Phase,
    session: u64,
    /// Time the current session's hotkey went down (first press).
    press_started_ms: i64,
    /// `Some(now)` when the trigger was released in this session.
    /// Auto-repeat (press with no intervening release) always reads `None`,
    /// which is what makes auto-repeat unable to trigger hands-free.
    last_release_ms: Option<i64>,
}

impl Default for Dictation {
    fn default() -> Self {
        Self::new()
    }
}

impl Dictation {
    pub fn new() -> Self {
        Self {
            phase: Phase::Idle,
            session: 0,
            press_started_ms: 0,
            last_release_ms: None,
        }
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    pub fn session(&self) -> u64 {
        self.session
    }

    /// Is the current session hands-free (persistent)?
    pub fn hands_free(&self) -> bool {
        matches!(
            self.phase,
            Phase::HandsFreeRecording | Phase::HandsFreePending
        )
    }

    pub fn rec_state(&self) -> RecState {
        RecState::from_phase(self.phase)
    }

    /// Feed a raw input edge. `now_ms` is a millisecond clock (any epoch).
    pub fn input(&mut self, input: Input, now_ms: i64) -> Action {
        match (self.phase, input) {
            (Phase::Idle, Input::Press) | (Phase::Error, Input::Press) => {
                self.begin_session(now_ms, false)
            }

            (Phase::PushToTalkPending, Input::Press)
            | (Phase::PushToTalkRecording, Input::Press)
            | (Phase::HandsFreePending, Input::Press) => {
                if let Some(release) = self.last_release_ms {
                    if now_ms - release <= DOUBLE_PRESS_MS {
                        self.phase = Phase::HandsFreeRecording;
                        self.last_release_ms = None;
                        return Action::EnterHandsFree {
                            session: self.session,
                        };
                    }
                }
                // Auto-repeat or a press with no intervening release: ignore.
                Action::Ignore
            }

            (Phase::PushToTalkPending, Input::Release)
            | (Phase::PushToTalkRecording, Input::Release) => {
                self.last_release_ms = Some(now_ms);
                if now_ms - self.press_started_ms >= DOUBLE_PRESS_MS {
                    // Definite hold: stop immediately.
                    self.begin_processing()
                } else {
                    // Quick tap: wait for a possible second press.
                    self.phase = Phase::HandsFreePending;
                    Action::WatchForDoublePress {
                        session: self.session,
                        until_ms: now_ms + DOUBLE_PRESS_MS,
                    }
                }
            }

            (Phase::HandsFreePending, Input::Release) => {
                // Releasing again does not shorten the watch window.
                Action::Ignore
            }

            (Phase::HandsFreePending, Input::TapWindowElapsed) => {
                self.begin_processing()
            }

            (Phase::HandsFreeRecording, Input::Release) => {
                // Releasing does not end hands-free.
                // A release following a press here is simply acknowledged.
                self.last_release_ms = Some(now_ms);
                Action::Ignore
            }

            (Phase::HandsFreeRecording, Input::Press) => {
                // Pressing the hotkey finishes (and pastes), mirroring the
                // reference tooltip "Press <key> to finish and paste".
                self.begin_processing()
            }

            _ => Action::Ignore,
        }
    }

    /// Explicit UI request to toggle a persistent, hands-free dictation.
    /// Idle/error → begin a hands-free session; any recording phase →
    /// finish it (transcribe and paste); processing or transient → ignore.
    pub fn hands_free_toggle(&mut self, now_ms: i64) -> Action {
        match self.phase {
            Phase::Idle | Phase::Error => self.begin_session(now_ms, true),
            Phase::PushToTalkPending
            | Phase::PushToTalkRecording
            | Phase::HandsFreePending
            | Phase::HandsFreeRecording => self.begin_processing(),
            _ => Action::Ignore,
        }
    }

    /// The user clicked the tick (or otherwise asked to finish).
    pub fn finish(&mut self) -> Action {
        match self.phase {
            Phase::PushToTalkPending
            | Phase::PushToTalkRecording
            | Phase::HandsFreeRecording
            | Phase::HandsFreePending => self.begin_processing(),
            _ => Action::Ignore,
        }
    }

    /// The user clicked the cross (or the recorder was discarded).
    pub fn cancel(&mut self) -> Action {
        match self.phase {
            Phase::PushToTalkPending
            | Phase::PushToTalkRecording
            | Phase::HandsFreeRecording
            | Phase::HandsFreePending
            | Phase::Processing => {
                let session = self.session;
                self.phase = Phase::Cancelled;
                Action::CancelSession { session }
            }
            _ => Action::Ignore,
        }
    }

    /// The audio pipeline acknowledged recording start (bars live).
    pub fn audio_started(&mut self) -> Action {
        match self.phase {
            Phase::PushToTalkPending => {
                self.phase = Phase::PushToTalkRecording;
                Action::AudioStarted {
                    session: self.session,
                }
            }
            _ => Action::Ignore,
        }
    }

    /// Non-fatal runtime failure reported by the recorder (mic lost,
    /// decoder failed, …).
    pub fn fail(&mut self, message: String) -> Action {
        match self.phase {
            Phase::PushToTalkPending
            | Phase::PushToTalkRecording
            | Phase::HandsFreeRecording
            | Phase::HandsFreePending
            | Phase::Processing => {
                let session = self.session;
                self.phase = Phase::Error;
                Action::FailSession { session, message }
            }
            _ => Action::Ignore,
        }
    }

    /// The 15 s audio-timeout watchdog fired. Only meaningful in Processing.
    pub fn audio_timeout(&mut self, session: u64) -> Action {
        if self.phase == Phase::Processing && self.session == session {
            self.phase = Phase::Error;
            Action::AudioTimeout { session }
        } else {
            Action::Ignore
        }
    }

    /// The double-press watch window elapsed. Only meaningful while a quick
    /// tap is parked in `HandsFreePending`.
    pub fn tap_window_elapsed(&mut self, session: u64) -> Action {
        if self.phase == Phase::HandsFreePending && self.session == session {
            self.begin_processing()
        } else {
            Action::Ignore
        }
    }

    /// `submit_audio` is only accepted while transcribing. Stale or early
    /// submissions are dropped silently.
    pub fn submit(&self) -> bool {
        self.phase == Phase::Processing
    }

    /// Transcription succeeded.
    pub fn complete(&mut self) -> Action {
        if self.phase == Phase::Processing {
            let session = self.session;
            self.phase = Phase::Completed;
            Action::CompleteSession { session }
        } else {
            Action::Ignore
        }
    }

    /// Transcription failed.
    pub fn transcribe_failed(&mut self, message: String) -> Action {
        if self.phase == Phase::Processing {
            let session = self.session;
            self.phase = Phase::Error;
            Action::TranscribeFailed { session, message }
        } else {
            Action::Ignore
        }
    }

    /// The transient display period for `session` elapsed; hide and reset.
    pub fn hide_and_reset(&mut self, session: u64) -> Action {
        let transient = matches!(
            self.phase,
            Phase::Completed | Phase::Cancelled | Phase::Error
        );
        if transient && self.session == session {
            self.phase = Phase::Idle;
            Action::HideAndReset { session }
        } else {
            Action::Ignore
        }
    }

    fn begin_session(&mut self, now_ms: i64, hands_free: bool) -> Action {
        self.session += 1;
        self.phase = if hands_free {
            Phase::HandsFreeRecording
        } else {
            Phase::PushToTalkPending
        };
        self.press_started_ms = now_ms;
        self.last_release_ms = None;
        Action::BeginSession {
            session: self.session,
            hands_free,
        }
    }

    fn begin_processing(&mut self) -> Action {
        match self.phase {
            Phase::PushToTalkPending
            | Phase::PushToTalkRecording
            | Phase::HandsFreeRecording
            | Phase::HandsFreePending => {
                let session = self.session;
                self.phase = Phase::Processing;
                Action::BeginProcessing { session }
            }
            _ => Action::Ignore,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn press(d: &mut Dictation, now: i64) -> Action {
        d.input(Input::Press, now)
    }
    fn release(d: &mut Dictation, now: i64) -> Action {
        d.input(Input::Release, now)
    }
    fn elapse(d: &mut Dictation, now: i64) -> Action {
        d.input(Input::TapWindowElapsed, now)
    }

    #[test]
    fn hold_then_release_stops_immediately() {
        let mut d = Dictation::new();
        assert_eq!(press(&mut d, 0), Action::BeginSession {
                session: 1,
                hands_free: false,
            });
        d.audio_started();
        assert_eq!(
            release(&mut d, DOUBLE_PRESS_MS),
            Action::BeginProcessing { session: 1 }
        );
        assert_eq!(d.rec_state(), RecState::Transcribing);
    }

    #[test]
    fn quick_tap_defers_stop_until_watch_window_elapses() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        d.audio_started();
        assert_eq!(
            release(&mut d, 100),
            Action::WatchForDoublePress {
                session: 1,
                until_ms: 100 + DOUBLE_PRESS_MS
            }
        );
        assert_eq!(d.phase(), Phase::HandsFreePending);
        assert_eq!(elapse(&mut d, 100 + DOUBLE_PRESS_MS), Action::BeginProcessing { session: 1 });
    }

    #[test]
    fn quick_tap_then_second_press_enters_hands_free() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 100);
        assert_eq!(
            press(&mut d, 250),
            Action::EnterHandsFree { session: 1 }
        );
        assert_eq!(d.phase(), Phase::HandsFreeRecording);
        // The stale watch window must not fire later.
        assert_eq!(elapse(&mut d, 100 + DOUBLE_PRESS_MS), Action::Ignore);
    }

    #[test]
    fn slow_second_press_does_not_enter_hands_free() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 100);
        // Watch window elapses first (as it would in production via the timer).
        assert_eq!(elapse(&mut d, 500), Action::BeginProcessing { session: 1 });
        assert_eq!(press(&mut d, 501), Action::Ignore);
        assert_eq!(d.phase(), Phase::Processing);
    }

    #[test]
    fn autorepeat_press_without_release_never_converts() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        for t in 1..20 {
            assert_eq!(press(&mut d, t * 30), Action::Ignore);
            assert_eq!(d.phase(), Phase::PushToTalkPending);
        }
        // Releasing after a long "held with auto-repeat" stream still stops once.
        assert_eq!(
            release(&mut d, 19 * 30),
            Action::BeginProcessing { session: 1 }
        );
    }

    #[test]
    fn tap_window_elapsed_only_matches_own_session() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 100);
        assert_eq!(d.tap_window_elapsed(999), Action::Ignore); // stale session
        assert_eq!(d.tap_window_elapsed(1), Action::BeginProcessing { session: 1 });
    }

    #[test]
    fn triple_tap_finishes_hands_free_once() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 100);
        assert_eq!(press(&mut d, 150), Action::EnterHandsFree { session: 1 });
        release(&mut d, 200);
        assert_eq!(press(&mut d, 250), Action::BeginProcessing { session: 1 });
        assert_eq!(press(&mut d, 300), Action::Ignore);
    }

    #[test]
    fn hands_free_survives_release() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 100);
        press(&mut d, 150);
        assert_eq!(release(&mut d, 10_000), Action::Ignore);
        assert_eq!(d.phase(), Phase::HandsFreeRecording);
    }

    #[test]
    fn cross_discards() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 100);
        press(&mut d, 150);
        assert_eq!(d.cancel(), Action::CancelSession { session: 1 });
        assert!(!d.submit());
    }

    #[test]
    fn cancel_during_tap_watch_window_discards() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 50);
        assert_eq!(d.phase(), Phase::HandsFreePending);
        assert_eq!(d.cancel(), Action::CancelSession { session: 1 });
        assert_eq!(elapse(&mut d, 50 + DOUBLE_PRESS_MS), Action::Ignore);
    }

    #[test]
    fn tick_completes_from_recording_states() {
        for setup in [0, 1, 2] {
            let mut d = Dictation::new();
            press(&mut d, 0);
            match setup {
                0 => {}                    // pending / PTT recording
                1 => {                     // hands-free pending (tap)
                    release(&mut d, 100);
                }
                2 => {                     // hands-free recording
                    release(&mut d, 100);
                    press(&mut d, 150);
                }
                _ => unreachable!(),
            }
            assert_eq!(d.finish(), Action::BeginProcessing { session: 1 });
        }
    }

    #[test]
    fn submit_is_gated_on_processing() {
        let mut d = Dictation::new();
        assert!(!d.submit());
        press(&mut d, 0);
        assert!(!d.submit());
        release(&mut d, DOUBLE_PRESS_MS);
        assert!(d.submit());
    }

    #[test]
    fn stale_submit_after_cancel_is_dropped() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 100);
        elapse(&mut d, 100 + DOUBLE_PRESS_MS); // → Processing
        d.cancel();
        assert!(!d.submit());
    }

    #[test]
    fn error_then_press_starts_new_session() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        assert_eq!(
            d.fail("mic gone".to_string()),
            Action::FailSession {
                session: 1,
                message: "mic gone".to_string()
            }
        );
        assert_eq!(
            press(&mut d, 1000),
            Action::BeginSession {
                session: 2,
                hands_free: false,
            }
        );
    }

    #[test]
    fn audio_timeout_only_fires_in_processing_and_only_for_current_session() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        assert_eq!(d.audio_timeout(1), Action::Ignore);
        release(&mut d, DOUBLE_PRESS_MS);
        assert_eq!(d.audio_timeout(99), Action::Ignore);
        assert_eq!(d.audio_timeout(1), Action::AudioTimeout { session: 1 });
        assert_eq!(d.phase(), Phase::Error);
    }

    #[test]
    fn complete_then_hide_resets_to_idle() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, DOUBLE_PRESS_MS);
        assert_eq!(d.complete(), Action::CompleteSession { session: 1 });
        assert_eq!(d.rec_state(), RecState::Idle);
        assert_eq!(d.hide_and_reset(1), Action::HideAndReset { session: 1 });
        assert_eq!(d.phase(), Phase::Idle);
        // A stale hide from session 1 must not reset a newer session 2.
        press(&mut d, 10_000);
        assert_eq!(d.hide_and_reset(1), Action::Ignore);
        assert_eq!(d.phase(), Phase::PushToTalkPending);
    }

    #[test]
    fn transcribe_failure_lands_in_error() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, DOUBLE_PRESS_MS);
        assert_eq!(
            d.transcribe_failed("crispasr died".to_string()),
            Action::TranscribeFailed {
                session: 1,
                message: "crispasr died".to_string()
            }
        );
        assert_eq!(d.rec_state(), RecState::Error);
    }

    #[test]
    fn cancel_during_processing_is_idempotent() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, DOUBLE_PRESS_MS);
        assert_eq!(d.cancel(), Action::CancelSession { session: 1 });
        assert_eq!(d.cancel(), Action::Ignore);
        assert!(!d.submit());
    }

    #[test]
    fn boundary_exactly_at_double_press_window_still_converts() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        release(&mut d, 100); // tap
        assert_eq!(
            press(&mut d, 100 + DOUBLE_PRESS_MS),
            Action::EnterHandsFree { session: 1 }
        );
    }

    #[test]
    fn hands_free_toggle_starts_persistent_session_then_finishes() {
        let mut d = Dictation::new();
        assert_eq!(
            d.hands_free_toggle(0),
            Action::BeginSession {
                session: 1,
                hands_free: true,
            }
        );
        assert_eq!(d.phase(), Phase::HandsFreeRecording);
        assert_eq!(release(&mut d, 100), Action::Ignore); // persists
        assert_eq!(
            d.hands_free_toggle(200),
            Action::BeginProcessing { session: 1 }
        );
        // Second call after finishing is ignored
        assert_eq!(d.hands_free_toggle(300), Action::Ignore);
        assert_eq!(d.phase(), Phase::Processing);
    }

    #[test]
    fn hands_free_toggle_during_ptt_finishes_instead() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        assert_eq!(
            d.hands_free_toggle(100),
            Action::BeginProcessing { session: 1 }
        );
    }

    #[test]
    fn second_hold_does_not_toggle_or_create_sessions() {
        let mut d = Dictation::new();
        press(&mut d, 0);
        d.audio_started();
        // A second press with no intervening release (impossible physically
        // for a hold, and meaningless for repeats): ignored.
        assert_eq!(press(&mut d, 500), Action::Ignore);
        assert_eq!(d.session(), 1);
    }
}