//! Perft — the correctness gate for move generation.
//!
//! Counting every legal move sequence to a given depth and comparing against
//! published reference figures is the only practical way to prove a Xiangqi
//! generator right. It catches exactly the rules that are easy to get subtly
//! wrong: the hobbled horse, the elephant's blocked eye, the cannon's screen,
//! and the flying-general constraint. If these numbers match, the rules match.

use co_tuong_engine::Position;

/// Reference node counts from the initial array.
const START_PERFT: [(u32, u64); 5] = [
    (1, 44),
    (2, 1_920),
    (3, 79_666),
    (4, 3_290_240),
    (5, 133_312_995),
];

#[test]
fn perft_from_the_initial_array() {
    let mut pos = Position::new();
    // Depth 5 takes a while in a debug build, so it lives in its own
    // `--release`-only test below.
    for &(depth, expected) in &START_PERFT[..4] {
        let got = pos.perft(depth);
        assert_eq!(got, expected, "perft({depth}) mismatch");
    }
}

#[test]
#[ignore = "slow: run with --release --ignored"]
fn perft_depth_five() {
    let mut pos = Position::new();
    let (depth, expected) = START_PERFT[4];
    assert_eq!(pos.perft(depth), expected, "perft({depth}) mismatch");
}

/// Perft must be reachable from a mid-game position too, where all the awkward
/// interactions (screens, pins, blocked legs) actually occur.
#[test]
fn perft_is_stable_under_make_unmake() {
    let mut pos = Position::new();
    let before = pos.to_fen();
    let before_key = pos.key;
    pos.perft(3);
    assert_eq!(
        pos.to_fen(),
        before,
        "perft must leave the position untouched"
    );
    assert_eq!(pos.key, before_key);
    assert_eq!(pos.key, pos.recompute_key());
    assert_eq!(pos.score, pos.recompute_score());
}
