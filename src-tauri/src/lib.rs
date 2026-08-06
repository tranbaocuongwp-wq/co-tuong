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

use xiangqi_engine::learn::Outcome;
use xiangqi_engine::search::system_now_ms;
use xiangqi_engine::types::{iccs_to_move, move_to_iccs, Move, BLACK, RED};
use xiangqi_engine::{
    Book, Experience, Position, SearchContext, SearchLimits, Searcher, MATE_BOUND, MATE_VALUE,
    START_FEN,
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
        }
    }
}

pub struct EngineState {
    searcher: Mutex<Searcher>,
    book: Book,
    experience: Mutex<Experience>,
}

impl EngineState {
    fn new() -> Self {
        EngineState {
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

        let limits = SearchLimits {
            max_depth: options.max_depth.clamp(1, 64),
            movetime_ms: options.movetime_ms,
            randomness_cp: options.randomness_cp.max(0),
            seed: options.seed as u64,
        };

        let experience = state.experience.lock().map_err(|e| e.to_string())?;
        let ctx = SearchContext {
            book: options.use_book.then_some(&state.book),
            experience: options.use_experience.then_some(&*experience),
        };
        let mut searcher = state.searcher.lock().map_err(|e| e.to_string())?;
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
        })
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
