//! Tauri desktop shell.
//!
//! The desktop build reuses the *same* engine crate as the browser build; the
//! only thing it replaces is the search, which runs here as native code instead
//! of WebAssembly (roughly twice the nodes per second, so a extra ply or two).
//! Rules, move generation and notation still come from the WebAssembly module
//! on the main thread, so there is exactly one implementation of the rules.
//!
//! Searches are CPU-bound and run for seconds, so every command hands the work
//! to a blocking thread rather than occupying an async runtime worker.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::Manager;

use co_tuong_engine::learn::Outcome;
use co_tuong_engine::search::system_now_ms;
use co_tuong_engine::types::{iccs_to_move, move_to_iccs, Move, BLACK, RED};
use co_tuong_engine::notation::move_to_vietnamese;
use co_tuong_engine::{
    Book, Experience, Position, SearchContext, SearchLimits, Searcher, StopFlag, MATE_BOUND,
    MATE_VALUE, START_FEN,
};

/// Transposition table size for the desktop build. Generous compared with the
/// browser's 16 MB, because a desktop app can afford it and a bigger table is
/// close to free strength.
const TT_MB: usize = 128;

/// Mirrors the shape the WebAssembly binding returns, so the frontend can treat
/// the two engines through one interface.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchInfo {
    pub iccs: String,
    pub score: i32,
    pub depth: u32,
    pub nodes: f64,
    pub time_ms: f64,
    pub pv: Vec<String>,
    pub from_book: bool,
    pub from_experience: bool,
    pub mate_in: Option<i32>,
    /// The search ran out of clock mid-iteration rather than finishing.
    pub stopped_early: bool,
    /// Which stopping condition fired. See `StopReason` in the engine.
    pub stop_reason: String,
    /// How many times the best move changed while thinking.
    pub best_changes: u32,
    /// The budget it aimed at after any extension, as opposed to the ceiling.
    pub soft_ms: f64,
}

/// One option offered by the hint, with everything needed to explain it.
///
/// Mirrors the WebAssembly build's shape exactly. The interface above this
/// cannot tell which engine answered, and must not have to.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HintInfo {
    pub iccs: String,
    pub text: String,
    pub score: i32,
    pub captured: Option<&'static str>,
    pub gives_check: bool,
    pub threats: Vec<&'static str>,
    /// Where those threatened pieces stand, in the same order as `threats`.
    pub threat_squares: Vec<Square>,
    pub reply: String,
}

/// A board square as the UI counts them: row 0 is Black's back rank.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Square {
    pub row: usize,
    pub col: usize,
}

fn square_of(sq: u8) -> Square {
    Square {
        row: co_tuong_engine::types::disp_row(sq as usize),
        col: co_tuong_engine::types::disp_col(sq as usize),
    }
}

fn kind_name(kind: u8) -> &'static str {
    match kind {
        0 => "k",
        1 => "a",
        2 => "e",
        3 => "h",
        4 => "r",
        5 => "c",
        _ => "p",
    }
}

/// One place that turns the interface's options into the engine's limits.
///
/// Mirrors `limits_from` in the WebAssembly build. The two engines must be
/// given the same instructions or a level means two different things depending
/// on whether the player is on the desktop app or the web one.
fn limits_from(opts: &SearchOptions, randomness_cp: i32) -> SearchLimits {
    let mut limits = SearchLimits {
        max_depth: opts.max_depth.clamp(1, 64),
        movetime_ms: opts.movetime_ms,
        randomness_cp,
        seed: opts.seed as u64,
        adaptive: opts.adaptive,
        ..Default::default()
    };
    if opts.soft_ms > 0 && opts.movetime_ms > 0 {
        let pct = (opts.soft_ms * 100 / opts.movetime_ms).clamp(10, 100) as u32;
        limits.policy.soft_pct = pct;
    }
    limits
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SearchOptions {
    pub max_depth: u32,
    pub movetime_ms: u64,
    pub randomness_cp: i32,
    pub seed: f64,
    pub use_book: bool,
    pub use_experience: bool,
    /// The budget to aim at, in milliseconds. Zero means "work it out from
    /// `movetime_ms`".
    pub soft_ms: u64,
    /// Off means spend `movetime_ms` the way the engine did before adaptive
    /// timing existed.
    pub adaptive: bool,
}

impl Default for SearchOptions {
    fn default() -> Self {
        SearchOptions {
            max_depth: 64,
            movetime_ms: 3_000,
            randomness_cp: 0,
            seed: 1.0,
            use_book: true,
            use_experience: true,
            soft_ms: 0,
            adaptive: true,
        }
    }
}

pub struct EngineState {
    /// Raised by the interface thread, read by the search inside its blocking
    /// task. This is the one host where cancelling actually works: the search
    /// has a thread of its own, so something else can still be listening.
    cancel: StopFlag,
    searcher: Mutex<Searcher>,
    book: Book,
    experience: Mutex<Experience>,
}

impl EngineState {
    fn new() -> Self {
        EngineState {
            cancel: StopFlag::new(),
            searcher: Mutex::new(Searcher::new(TT_MB, system_now_ms)),
            book: Book::new(),
            experience: Mutex::new(Experience::new()),
        }
    }
}

/// Rebuild a position by replaying moves, validating each one.
///
/// The frontend is not trusted to send a legal sequence: a bug there must
/// surface as an error, not as a corrupted board inside the engine.
fn replay(start_fen: &str, moves: &str) -> Result<(Position, Vec<Move>), String> {
    let mut pos = Position::from_fen(start_fen)?;
    let mut parsed = Vec::new();
    for (i, token) in moves.split_whitespace().enumerate() {
        let mv = iccs_to_move(token).ok_or_else(|| format!("move {i} '{token}' is not ICCS"))?;
        if !pos.make_move_checked(mv) {
            return Err(format!("move {i} '{token}' is illegal"));
        }
        parsed.push(mv);
    }
    Ok((pos, parsed))
}

/// Search the position reached by replaying `moves` from `start_fen`.
#[tauri::command]
async fn engine_search(
    app: tauri::AppHandle,
    start_fen: String,
    moves: String,
    options: SearchOptions,
) -> Result<SearchInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<EngineState>();
        let (mut pos, _) = replay(&start_fen, &moves)?;

        let limits = limits_from(&options, options.randomness_cp.max(0));

        let experience = state.experience.lock().map_err(|e| e.to_string())?;
        let ctx = SearchContext {
            book: options.use_book.then_some(&state.book),
            experience: options.use_experience.then_some(&*experience),
        };
        let mut searcher = state.searcher.lock().map_err(|e| e.to_string())?;
        // A flag left raised by a previous cancel would stop this search before
        // it began.
        state.cancel.clear();
        searcher.set_cancel(Some(state.cancel.clone()));
        let r = searcher.search_with(&mut pos, limits, &ctx, None);

        let mate_in = if r.score.abs() >= MATE_BOUND {
            let plies = MATE_VALUE - r.score.abs();
            Some(if r.score > 0 { plies } else { -plies })
        } else {
            None
        };

        Ok(SearchInfo {
            iccs: move_to_iccs(r.best_move),
            score: r.score,
            depth: r.depth,
            nodes: r.nodes as f64,
            time_ms: r.time_ms as f64,
            pv: r.pv.iter().map(|m| move_to_iccs(*m)).collect(),
            from_book: r.from_book,
            from_experience: r.from_experience,
            mate_in,
            stopped_early: r.stopped_early,
            stop_reason: r.stop_reason.as_str().to_string(),
            best_changes: r.best_changes,
            soft_ms: r.soft_ms as f64,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Stop the search that is running now, if there is one.
///
/// Not `async`, and deliberately: the point is to set the flag *while* a search
/// is blocking, and an async command queued behind it would be no use at all.
#[tauri::command]
fn engine_cancel(app: tauri::AppHandle) {
    app.state::<EngineState>().cancel.raise();
}

/// Measure how fast this machine searches, so a difficulty level can mean the
/// same strength on a laptop and on a phone.
#[tauri::command]
async fn engine_benchmark(budget_ms: u64) -> Result<Calibration, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let c = co_tuong_engine::calibrate(system_now_ms, budget_ms, TT_MB);
        Ok(Calibration { nps: c.nps as f64, depth: c.depth, ms: c.ms as f64 })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Calibration {
    pub nps: f64,
    pub depth: u32,
    pub ms: f64,
}

/// The best few moves for the side to move, best first, each with its reasons.
#[tauri::command]
async fn engine_hints(
    app: tauri::AppHandle,
    start_fen: String,
    moves: String,
    options: SearchOptions,
    count: usize,
) -> Result<Vec<HintInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<EngineState>();
        let (mut pos, _) = replay(&start_fen, &moves)?;

        let limits = limits_from(&options, 0);

        let experience = state.experience.lock().map_err(|e| e.to_string())?;
        let ctx = SearchContext {
            book: None,
            experience: options.use_experience.then_some(&*experience),
        };
        let mut searcher = state.searcher.lock().map_err(|e| e.to_string())?;
        let ranked = searcher.rank_moves(&mut pos, limits, &ctx, count.clamp(1, 5));
        drop(searcher);

        let mut out = Vec::with_capacity(ranked.len());
        for choice in ranked {
            // Notation is read off the position before the move; the
            // consequences off the position after it.
            let text = move_to_vietnamese(&pos, choice.mv);
            if !pos.make_move(choice.mv) {
                continue;
            }
            let report = pos.last_move_report();
            let reply = if choice.reply == 0 {
                String::new()
            } else {
                move_to_vietnamese(&pos, choice.reply)
            };
            pos.undo_move();

            out.push(HintInfo {
                iccs: move_to_iccs(choice.mv),
                text,
                score: choice.score,
                captured: report.as_ref().and_then(|r| r.captured.map(kind_name)),
                gives_check: report.as_ref().is_some_and(|r| r.gives_check),
                threats: report
                    .as_ref()
                    .map(|r| r.threats.iter().copied().map(kind_name).collect())
                    .unwrap_or_default(),
                threat_squares: report
                    .as_ref()
                    .map(|r| r.threat_squares.iter().map(|s| square_of(*s)).collect())
                    .unwrap_or_default(),
                reply,
            });
        }

        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Grade a finished game into the experience book.
#[tauri::command]
async fn engine_learn(
    app: tauri::AppHandle,
    start_fen: String,
    moves: String,
    learner: String,
    outcome: String,
) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<EngineState>();
        let side = if learner.eq_ignore_ascii_case("b") {
            BLACK
        } else {
            RED
        };
        let outcome = match outcome.as_str() {
            "win" => Outcome::Win,
            "loss" => Outcome::Loss,
            "draw" => Outcome::Draw,
            other => return Err(format!("unknown outcome '{other}'")),
        };
        let (_, parsed) = replay(&start_fen, &moves)?;
        let mut exp = state.experience.lock().map_err(|e| e.to_string())?;
        exp.learn_game(&start_fen, &parsed, side, outcome)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Serialize the experience book so the frontend can persist it.
#[tauri::command]
fn engine_experience_text(state: tauri::State<'_, EngineState>) -> Result<String, String> {
    let exp = state.experience.lock().map_err(|e| e.to_string())?;
    Ok(exp.serialize())
}

/// Restore a previously saved experience book.
#[tauri::command]
fn engine_load_experience(
    state: tauri::State<'_, EngineState>,
    text: String,
) -> Result<usize, String> {
    let mut exp = state.experience.lock().map_err(|e| e.to_string())?;
    *exp = Experience::parse(&text);
    Ok(exp.record_count())
}

/// Clear the transposition table, e.g. when a new game starts.
#[tauri::command]
fn engine_reset(state: tauri::State<'_, EngineState>) -> Result<(), String> {
    state.searcher.lock().map_err(|e| e.to_string())?.clear();
    Ok(())
}

/// The initial array, so the frontend has one source for it.
#[tauri::command]
fn engine_start_fen() -> String {
    START_FEN.to_string()
}

/// Schema for the game history database.
///
/// Kept in code rather than in loose .sql files so the migration ships inside
/// the binary and cannot go missing from a bundle.
fn migrations() -> Vec<tauri_plugin_sql::Migration> {
    use tauri_plugin_sql::{Migration, MigrationKind};
    vec![Migration {
        version: 1,
        description: "create game history",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:cotuong.db", migrations())
                .build(),
        )
        .manage(EngineState::new())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            engine_search,
            engine_cancel,
            engine_benchmark,
            engine_hints,
            engine_learn,
            engine_experience_text,
            engine_load_experience,
            engine_reset,
            engine_start_fen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replay_accepts_a_real_game_and_rejects_a_forged_one() {
        let (pos, moves) = replay(START_FEN, "h2e2 h9g7 h0g2").unwrap();
        assert_eq!(moves.len(), 3);
        assert_ne!(pos.to_fen(), START_FEN);

        // Wrong side to move.
        assert!(replay(START_FEN, "h2e2 a0a9").is_err());
        // Not coordinate notation at all.
        assert!(replay(START_FEN, "hello").is_err());
        // A move the piece cannot make.
        assert!(replay(START_FEN, "a0e5").is_err());
    }

    #[test]
    fn an_empty_move_list_is_the_start_position() {
        let (pos, moves) = replay(START_FEN, "").unwrap();
        assert!(moves.is_empty());
        assert_eq!(pos.to_fen(), START_FEN);
    }
}
