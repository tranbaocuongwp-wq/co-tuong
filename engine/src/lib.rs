//! A Xiangqi (Chinese chess) engine with no external dependencies.
//!
//! The crate is deliberately free of I/O so the exact same code compiles into
//! the Tauri desktop binary and into WebAssembly for the browser build. Rules
//! live here and only here — the UI asks this engine what is legal rather than
//! reimplementing the rules in TypeScript, which is how the two ever drift.

pub mod board;
pub mod book;
pub mod eval;
pub mod learn;
pub mod movegen;
pub mod notation;
pub mod search;
pub mod types;
pub mod zobrist;

pub use board::{Position, RepKind, START_FEN};
pub use book::Book;
pub use eval::{evaluate, INFINITY, MATE_BOUND, MATE_VALUE};
pub use learn::{Experience, Outcome};
pub use movegen::{MoveList, MAX_MOVES};
pub use search::{
    search_position, InfoFn, NowFn, SearchContext, SearchLimits, SearchResult, Searcher,
};
pub use types::{iccs_to_move, move_to_iccs, Move, BLACK, RED};
