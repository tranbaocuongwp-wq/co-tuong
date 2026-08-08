//! Measuring how fast this particular machine searches.
//!
//! A difficulty level names a depth *and* a time cap, and the two mean different
//! things: the depth is the strength, and the cap is what a slow device falls
//! back to. That works when the cap is generous enough for the device to reach
//! the depth — and on a phone it often is not, so "Siêu khó" on a phone has been
//! quietly weaker than "Siêu khó" on a laptop, with nothing to say so.
//!
//! The fix is to measure the machine and stretch the *cap*, never the depth. A
//! fast laptop keeps a small cap because it reaches the depth anyway; a slow
//! phone gets a larger one so it actually arrives at the depth the level
//! promised. That is what makes a level mean the same thing on both.
//!
//! Deliberately in the engine crate rather than in either host: the browser and
//! the desktop app must measure the same position with the same code, or their
//! numbers are not comparable and the whole point is comparing them.

use crate::board::Position;
use crate::search::{NowFn, SearchContext, SearchLimits, Searcher};

/// The position the measurement runs on.
///
/// A middlegame, not the opening array. The opening is answered from the book in
/// normal play and has an unrepresentative branching factor; a middlegame with
/// pieces still on is what the engine actually spends its life searching.
pub const CALIBRATION_FEN: &str =
    "r1bakab1r/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1CN3NC1/9/R1BAKAB1R w - - 0 1";

#[derive(Clone, Copy, Debug)]
pub struct Calibration {
    /// Nodes per second. The number everything else is derived from.
    pub nps: u64,
    /// How deep it got in the budget. Reported for display, not used for maths —
    /// depth is too coarse a measure to scale a time cap by.
    pub depth: u32,
    /// How long it actually took, which is not quite the budget.
    pub ms: u64,
}

/// Run a fixed search and report the rate.
///
/// `adaptive: false` on purpose. The whole point is a number comparable between
/// machines, and adaptive timing would stop the search early on the machine that
/// settled the position first — which is exactly the machine being measured as
/// fast. It would measure itself away.
pub fn calibrate(now: NowFn, budget_ms: u64, tt_mb: usize) -> Calibration {
    let mut pos = Position::from_fen(CALIBRATION_FEN).expect("calibration FEN must parse");
    let mut searcher = Searcher::new(tt_mb, now);
    let limits = SearchLimits {
        max_depth: 64,
        movetime_ms: budget_ms.max(50),
        randomness_cp: 0,
        seed: 0x0BAD_C0DE,
        adaptive: false,
        ..Default::default()
    };
    let r = searcher.search_with(&mut pos, limits, &SearchContext::default(), None);
    let ms = r.time_ms.max(1);
    Calibration { nps: r.nodes * 1000 / ms, depth: r.depth, ms }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::search::system_now_ms;

    #[test]
    fn calibrate_returns_a_positive_rate() {
        let c = calibrate(system_now_ms, 120, 4);
        assert!(c.nps > 0, "a machine that searches no nodes per second is not a machine");
        assert!(c.depth >= 1, "must complete at least one iteration");
        assert!(c.ms >= 1);
    }
}
