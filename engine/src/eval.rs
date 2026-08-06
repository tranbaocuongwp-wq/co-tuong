//! Static evaluation.
//!
//! The bulk of the score — material plus piece-square tables — is maintained
//! incrementally by [`crate::board::Position`], so [`evaluate`] itself stays
//! O(1). That matters more than a richer term set: a cheap evaluation buys
//! extra search depth, and depth wins games.
//!
//! Tables are written from Red's point of view with display row 0 at the top
//! (Black's back rank), so a Red piece scores higher as its row index falls.
//! Black reuses the same tables through [`flip_sq`].

use crate::board::Position;
use crate::types::*;

/// Score returned for a won game, offset by ply so shorter mates rank higher.
pub const MATE_VALUE: i32 = 30_000;
/// Any score at or above this is a forced mate.
pub const MATE_BOUND: i32 = MATE_VALUE - 512;
pub const INFINITY: i32 = 32_000;

/// Base material values in centipawns (a pawn before the river is 100).
pub const PIECE_VALUE: [i32; 7] = [
    10_000, // King — never actually captured, but keeps sorting sane
    200,    // Advisor
    200,    // Elephant
    400,    // Horse
    900,    // Rook
    450,    // Cannon
    100,    // Pawn
];

#[rustfmt::skip]
const PST_PAWN: [i32; 90] = [
    // Deep in Black's camp a pawn can barely move, so it is worth less than at row 2.
     0,  0,  0, 10, 15, 10,  0,  0,  0,
    10, 15, 20, 40, 50, 40, 20, 15, 10,
    20, 30, 45, 60, 70, 60, 45, 30, 20,
    18, 25, 35, 45, 50, 45, 35, 25, 18,
    12, 18, 25, 30, 35, 30, 25, 18, 12,
     4,  0,  8,  0, 12,  0,  8,  0,  4,
     2,  0,  4,  0,  6,  0,  4,  0,  2,
     0,  0,  0,  0,  0,  0,  0,  0,  0,
     0,  0,  0,  0,  0,  0,  0,  0,  0,
     0,  0,  0,  0,  0,  0,  0,  0,  0,
];

#[rustfmt::skip]
const PST_HORSE: [i32; 90] = [
    -4, -2,  0,  2,  2,  2,  0, -2, -4,
     0,  4,  8, 10,  8, 10,  8,  4,  0,
     4,  8, 16, 18, 16, 18, 16,  8,  4,
     6, 14, 20, 24, 22, 24, 20, 14,  6,
     8, 16, 22, 26, 26, 26, 22, 16,  8,
     6, 14, 20, 22, 22, 22, 20, 14,  6,
     4, 12, 18, 20, 18, 20, 18, 12,  4,
     2, 10, 14, 16, 16, 16, 14, 10,  2,
     0,  4, 10, 12,  8, 12, 10,  4,  0,
    -4,  0,  4,  6,  0,  6,  4,  0, -4,
];

#[rustfmt::skip]
const PST_ROOK: [i32; 90] = [
     6, 10, 10, 14, 16, 14, 10, 10,  6,
    10, 14, 14, 18, 20, 18, 14, 14, 10,
     8, 12, 12, 16, 18, 16, 12, 12,  8,
    10, 14, 14, 18, 20, 18, 14, 14, 10,
    12, 16, 16, 20, 22, 20, 16, 16, 12,
    12, 16, 16, 20, 22, 20, 16, 16, 12,
    10, 14, 14, 18, 20, 18, 14, 14, 10,
     8, 12, 12, 16, 18, 16, 12, 12,  8,
     6, 10, 10, 16, 18, 16, 10, 10,  6,
     6,  8,  8, 14, 16, 14,  8,  8,  6,
];

#[rustfmt::skip]
const PST_CANNON: [i32; 90] = [
     0,  0,  2,  6,  6,  6,  2,  0,  0,
     0,  2,  4,  6,  8,  6,  4,  2,  0,
     2,  2,  0,  4, 10,  4,  0,  2,  2,
     0,  0,  0,  2,  8,  2,  0,  0,  0,
    -2,  0,  4,  2,  6,  2,  4,  0, -2,
     0,  0,  0,  2,  4,  2,  0,  0,  0,
     2,  0,  4,  4,  6,  4,  4,  0,  2,
     0,  2,  4,  6,  6,  6,  4,  2,  0,
     0,  0,  2,  6,  8,  6,  2,  0,  0,
     0,  0,  2,  6,  6,  6,  2,  0,  0,
];

#[rustfmt::skip]
const PST_ADVISOR: [i32; 90] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 2, 0, 2, 0, 0, 0,
    0, 0, 0, 0, 6, 0, 0, 0, 0,
    0, 0, 0, 3, 0, 3, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
];

#[rustfmt::skip]
const PST_ELEPHANT: [i32; 90] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 2, 0, 0, 0, 2, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 0, 0, 0, 6, 0, 0, 0, 1,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 3, 0, 0, 0, 3, 0, 0,
];

#[rustfmt::skip]
const PST_KING: [i32; 90] = [
    0, 0, 0,  0,  0,  0, 0, 0, 0,
    0, 0, 0,  0,  0,  0, 0, 0, 0,
    0, 0, 0,  0,  0,  0, 0, 0, 0,
    0, 0, 0,  0,  0,  0, 0, 0, 0,
    0, 0, 0,  0,  0,  0, 0, 0, 0,
    0, 0, 0,  0,  0,  0, 0, 0, 0,
    0, 0, 0, -8,-10, -8, 0, 0, 0,
    0, 0, 0, -4, -6, -4, 0, 0, 0,
    0, 0, 0,  2,  4,  2, 0, 0, 0,
    0, 0, 0,  0,  0,  0, 0, 0, 0,
];

const PST: [&[i32; 90]; 7] = [
    &PST_KING,
    &PST_ADVISOR,
    &PST_ELEPHANT,
    &PST_HORSE,
    &PST_ROOK,
    &PST_CANNON,
    &PST_PAWN,
];

/// Material value plus positional bonus for a piece standing on `s`.
///
/// Called by the board on every placement and removal, which is what keeps the
/// running score in [`Position::score`] correct.
#[inline]
pub fn piece_square_value(pc: u8, s: usize) -> i32 {
    let kind = kind_of(pc) as usize;
    // Black reads the Red-oriented table through a vertical mirror.
    let idx = if side_of(pc) == RED { s } else { flip_sq(s) };
    let table_idx = disp_row(idx) * 9 + disp_col(idx);
    PIECE_VALUE[kind] + PST[kind][table_idx]
}

/// How dangerous a side's attacking force is, used to price the opponent's
/// defensive pieces. Rooks dominate, then cannons and horses.
#[inline]
fn attack_power(pos: &Position, side: u8) -> i32 {
    let c = &pos.counts[side as usize];
    4 * c[ROOK as usize] as i32 + 2 * c[CANNON as usize] as i32 + 2 * c[HORSE as usize] as i32
}

/// King-safety term.
///
/// This is the Xiangqi-specific piece of judgement that material alone misses:
/// advisors and elephants are nearly worthless against a bare board but
/// decisive against rooks and cannons, and a king stripped of them collapses.
/// A cannon in particular is far stronger against a king with no advisors,
/// because the advisor is what screens the palace file.
fn king_safety(pos: &Position, side: u8) -> i32 {
    let them = 1 - side;
    let c = &pos.counts[side as usize];
    let advisors = c[ADVISOR as usize] as i32;
    let elephants = c[ELEPHANT as usize] as i32;

    // A full shield is 2 advisors + 2 elephants; weight advisors higher since
    // they defend the palace itself.
    let shield = 3 * advisors + 2 * elephants; // 0..=10
    let exposure = 10 - shield;
    let threat = attack_power(pos, them);

    // No attackers left means the shield is irrelevant; scale accordingly.
    let mut penalty = exposure * threat * 3 / 2;

    // Missing both advisors against any cannon is the classic losing shape.
    if advisors == 0 && pos.counts[them as usize][CANNON as usize] > 0 {
        penalty += 60;
    }
    -penalty
}

/// Static score of the position from the side-to-move's point of view.
pub fn evaluate(pos: &Position) -> i32 {
    let us = pos.side;
    let them = 1 - us;
    let material = pos.score[us as usize] - pos.score[them as usize];
    let safety = king_safety(pos, us) - king_safety(pos, them);
    // Small tempo bonus: having the move is worth something in a sharp game.
    material + safety + 8
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::START_FEN;

    #[test]
    fn start_position_is_balanced() {
        let pos = Position::new();
        // Perfectly symmetric array: the only asymmetry is the tempo bonus.
        assert_eq!(evaluate(&pos), 8);
        assert_eq!(pos.score[RED as usize], pos.score[BLACK as usize]);
    }

    #[test]
    fn tables_mirror_exactly() {
        // A Red piece on a square must score the same as a Black piece on the
        // vertically mirrored square, or the two sides play different games.
        for kind in KING..=PAWN {
            for s in all_squares() {
                let r = piece_square_value(make_piece(RED, kind), s);
                let b = piece_square_value(make_piece(BLACK, kind), flip_sq(s));
                assert_eq!(r, b, "asymmetric table for kind {kind} at {s}");
            }
        }
    }

    #[test]
    fn a_rook_up_is_clearly_winning() {
        // Remove Black's a-file rook from the start position.
        let fen = START_FEN.replace("rnbakabnr", "1nbakabnr");
        let pos = Position::from_fen(&fen).unwrap();
        assert!(
            evaluate(&pos) > 800,
            "a whole rook should register, got {}",
            evaluate(&pos)
        );
    }

    #[test]
    fn advancing_a_pawn_across_the_river_gains_value() {
        let home = Position::from_fen("4k4/9/9/9/9/9/4P4/9/9/4K4 w - - 0 1").unwrap();
        let across = Position::from_fen("4k4/9/9/4P4/9/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert!(
            across.score[RED as usize] > home.score[RED as usize],
            "a pawn over the river must be worth more"
        );
    }

    #[test]
    fn stripping_advisors_hurts_against_heavy_pieces() {
        let guarded = Position::from_fen("3ak4/4a4/9/9/9/9/9/9/4R4/4K4 b - - 0 1").unwrap();
        let bare = Position::from_fen("4k4/9/9/9/9/9/9/9/4R4/4K4 b - - 0 1").unwrap();
        // Compare Black's own safety term directly, isolating it from material.
        assert!(
            king_safety(&bare, BLACK) < king_safety(&guarded, BLACK),
            "a bare king must be judged less safe"
        );
    }
}
