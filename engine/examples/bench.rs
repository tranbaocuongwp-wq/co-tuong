//! Quick strength probe: how deep does the engine get inside a time budget?
//!
//! Run with `cargo run -p co-tuong-engine --release --example bench`.

use co_tuong_engine::search::{system_now_ms, SearchLimits, Searcher};
use co_tuong_engine::{move_to_iccs, Position, START_FEN};

const POSITIONS: [(&str, &str); 3] = [
    ("opening (initial array)", START_FEN),
    (
        "middlegame",
        "r1ba1a3/4kn3/2n1b4/pNp1p1p1p/9/1C2P4/P1P3P1P/1CN1B4/4A4/2BAK2R1 w - - 0 1",
    ),
    (
        "endgame (rook + pawn vs rook)",
        "3ak4/4a4/9/9/9/9/4P4/9/4A4/3AK1R2 w - - 0 1",
    ),
];

fn main() {
    let budget_ms: u64 = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(5_000);

    println!("Budget: {budget_ms} ms per position, 64 MB transposition table\n");

    for (name, fen) in POSITIONS {
        let mut pos = Position::from_fen(fen).expect("test FEN must parse");
        let mut searcher = Searcher::new(64, system_now_ms);
        let limits = SearchLimits {
            max_depth: 64,
            movetime_ms: budget_ms,
            randomness_cp: 0,
            seed: 42,
            ..Default::default()
        };
        let r = searcher.search(&mut pos, limits, None);
        // A search that finished inside a millisecond reports 0 ms, so guard the
        // division rather than dividing by zero on very fast positions.
        let nps = (r.nodes * 1000).checked_div(r.time_ms).unwrap_or(0);
        let pv: Vec<String> = r.pv.iter().take(8).map(|m| move_to_iccs(*m)).collect();
        println!("{name}");
        println!(
            "  depth {:>2}  score {:>6}  nodes {:>11}  {:>9} n/s  {} ms",
            r.depth, r.score, r.nodes, nps, r.time_ms
        );
        println!(
            "  best {}   pv {}\n",
            move_to_iccs(r.best_move),
            pv.join(" ")
        );
    }
}
