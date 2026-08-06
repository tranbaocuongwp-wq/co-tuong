//! Board geometry, piece encoding and move encoding.
//!
//! The board is a 16x16 mailbox. The playable 9x10 grid sits at rows 3..=12 and
//! columns 3..=11, so the sentinel border absorbs every off-board index a move
//! delta can produce — move generation never needs a bounds check.
//!
//! Rows run top to bottom exactly like Xiangqi FEN: internal row 3 is Black's
//! back rank, internal row 12 is Red's back rank. Red therefore advances toward
//! *decreasing* row indices.

pub const BOARD_LEN: usize = 256;

/// Internal row of Black's back rank / Red's back rank.
pub const ROW_TOP: usize = 3;
pub const ROW_BOTTOM: usize = 12;
pub const COL_LEFT: usize = 3;
pub const COL_RIGHT: usize = 11;

/// The river runs between internal rows 7 and 8.
pub const ROW_RIVER_BLACK: usize = 7; // last row of Black's own half
pub const ROW_RIVER_RED: usize = 8; // first row of Red's own half

pub const RED: u8 = 0;
pub const BLACK: u8 = 1;

// Piece encoding: 0 = empty, otherwise `1 + kind + 8 * side`.
// Red pieces occupy 1..=7, Black pieces occupy 9..=15. Bit 3 is the side flag,
// which makes `side_of` and `is_side` single-instruction checks.
pub const EMPTY: u8 = 0;

pub const KING: u8 = 0;
pub const ADVISOR: u8 = 1;
pub const ELEPHANT: u8 = 2;
pub const HORSE: u8 = 3;
pub const ROOK: u8 = 4;
pub const CANNON: u8 = 5;
pub const PAWN: u8 = 6;

pub const RED_KING: u8 = 1;
pub const BLACK_KING: u8 = 9;

/// Build a piece byte from a side and a piece kind.
#[inline(always)]
pub const fn make_piece(side: u8, kind: u8) -> u8 {
    1 + kind + 8 * side
}

/// Piece kind (`KING`..`PAWN`) of a non-empty piece byte.
#[inline(always)]
pub const fn kind_of(pc: u8) -> u8 {
    (pc & 7) - 1
}

/// Owning side of a non-empty piece byte.
#[inline(always)]
pub const fn side_of(pc: u8) -> u8 {
    (pc >> 3) & 1
}

/// True when `pc` is a non-empty piece belonging to `side`.
#[inline(always)]
pub const fn is_side(pc: u8, side: u8) -> bool {
    pc != EMPTY && side_of(pc) == side
}

/// Square index from display coordinates: `row` 0..=9 top-down, `col` 0..=8 left-to-right.
#[inline(always)]
pub const fn sq(row: usize, col: usize) -> usize {
    (row + ROW_TOP) * 16 + (col + COL_LEFT)
}

/// Internal row (3..=12) of a square.
#[inline(always)]
pub const fn row_of(s: usize) -> usize {
    s >> 4
}

/// Internal column (3..=11) of a square.
#[inline(always)]
pub const fn col_of(s: usize) -> usize {
    s & 15
}

/// Display row 0..=9 (0 = Black's back rank).
#[inline(always)]
pub const fn disp_row(s: usize) -> usize {
    row_of(s) - ROW_TOP
}

/// Display column 0..=8 (0 = Black's left / file 'a').
#[inline(always)]
pub const fn disp_col(s: usize) -> usize {
    col_of(s) - COL_LEFT
}

/// Mirror a square vertically, mapping a Red-oriented table index to Black.
#[inline(always)]
pub const fn flip_sq(s: usize) -> usize {
    sq(9 - disp_row(s), disp_col(s))
}

/// Forward direction for a side: Red advances up the board (row decreases).
#[inline(always)]
pub const fn forward(side: u8) -> isize {
    if side == RED {
        -16
    } else {
        16
    }
}

/// True when a piece of `side` standing on `s` has crossed the river.
#[inline(always)]
pub const fn crossed_river(s: usize, side: u8) -> bool {
    if side == RED {
        row_of(s) <= ROW_RIVER_BLACK
    } else {
        row_of(s) >= ROW_RIVER_RED
    }
}

const fn build_in_board() -> [bool; BOARD_LEN] {
    let mut t = [false; BOARD_LEN];
    let mut r = ROW_TOP;
    while r <= ROW_BOTTOM {
        let mut c = COL_LEFT;
        while c <= COL_RIGHT {
            t[r * 16 + c] = true;
            c += 1;
        }
        r += 1;
    }
    t
}

const fn build_in_fort() -> [bool; BOARD_LEN] {
    let mut t = [false; BOARD_LEN];
    let mut r = 3;
    while r <= 12 {
        // Palaces: Black on rows 3..=5, Red on rows 10..=12, both on columns 6..=8.
        if (r >= 3 && r <= 5) || (r >= 10 && r <= 12) {
            let mut c = 6;
            while c <= 8 {
                t[r * 16 + c] = true;
                c += 1;
            }
        }
        r += 1;
    }
    t
}

/// True for the 90 playable squares, false for the sentinel border.
pub static IN_BOARD: [bool; BOARD_LEN] = build_in_board();
/// True for the 18 palace squares.
pub static IN_FORT: [bool; BOARD_LEN] = build_in_fort();

#[inline(always)]
pub fn on_board(s: usize) -> bool {
    IN_BOARD[s]
}

#[inline(always)]
pub fn in_fort(s: usize) -> bool {
    IN_FORT[s]
}

/// The 90 playable squares, in display order (Black's back rank first).
pub fn all_squares() -> impl Iterator<Item = usize> {
    (0..10).flat_map(|r| (0..9).map(move |c| sq(r, c)))
}

// ---------------------------------------------------------------------------
// Move encoding
// ---------------------------------------------------------------------------

/// A move packed as `from | (to << 8)`. Both endpoints are mailbox indices.
pub type Move = u16;

pub const NULL_MOVE: Move = 0;

#[inline(always)]
pub const fn mv_make(from: usize, to: usize) -> Move {
    (from as u16) | ((to as u16) << 8)
}

#[inline(always)]
pub const fn mv_from(m: Move) -> usize {
    (m & 0xFF) as usize
}

#[inline(always)]
pub const fn mv_to(m: Move) -> usize {
    (m >> 8) as usize
}

/// Render a move in ICCS/UCCI coordinate notation, e.g. `h2e2`.
///
/// Files are lettered a..i from Red's left; ranks are numbered 0..9 from Red's
/// back rank upward, which is the convention the UCCI protocol uses.
pub fn move_to_iccs(m: Move) -> String {
    let f = mv_from(m);
    let t = mv_to(m);
    format!(
        "{}{}{}{}",
        (b'a' + disp_col(f) as u8) as char,
        9 - disp_row(f),
        (b'a' + disp_col(t) as u8) as char,
        9 - disp_row(t)
    )
}

/// Parse ICCS/UCCI coordinate notation back into a move.
pub fn iccs_to_move(s: &str) -> Option<Move> {
    let b = s.as_bytes();
    if b.len() != 4 {
        return None;
    }
    let file = |c: u8| -> Option<usize> {
        if (b'a'..=b'i').contains(&c) {
            Some((c - b'a') as usize)
        } else {
            None
        }
    };
    let rank = |c: u8| -> Option<usize> {
        if c.is_ascii_digit() {
            Some(9 - (c - b'0') as usize)
        } else {
            None
        }
    };
    Some(mv_make(
        sq(rank(b[1])?, file(b[0])?),
        sq(rank(b[3])?, file(b[2])?),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn geometry_round_trips() {
        for r in 0..10 {
            for c in 0..9 {
                let s = sq(r, c);
                assert!(on_board(s));
                assert_eq!(disp_row(s), r);
                assert_eq!(disp_col(s), c);
            }
        }
        assert_eq!(IN_BOARD.iter().filter(|b| **b).count(), 90);
        assert_eq!(IN_FORT.iter().filter(|b| **b).count(), 18);
    }

    #[test]
    fn piece_encoding_round_trips() {
        for side in [RED, BLACK] {
            for kind in KING..=PAWN {
                let pc = make_piece(side, kind);
                assert_eq!(side_of(pc), side);
                assert_eq!(kind_of(pc), kind);
                assert!(is_side(pc, side));
                assert!(!is_side(pc, 1 - side));
            }
        }
        assert!(!is_side(EMPTY, RED));
        assert!(!is_side(EMPTY, BLACK));
    }

    #[test]
    fn iccs_round_trips() {
        // Red's cannon from the initial position: h2 -> e2 (the classic centre cannon).
        let m = iccs_to_move("h2e2").unwrap();
        assert_eq!(move_to_iccs(m), "h2e2");
        assert_eq!(mv_from(m), sq(7, 7));
        assert_eq!(mv_to(m), sq(7, 4));
    }

    #[test]
    fn river_sides() {
        // Red's home half is the bottom of the board (display rows 5..=9).
        assert!(!crossed_river(sq(9, 0), RED));
        assert!(!crossed_river(sq(5, 0), RED));
        assert!(crossed_river(sq(4, 0), RED));
        assert!(!crossed_river(sq(0, 0), BLACK));
        assert!(crossed_river(sq(5, 0), BLACK));
    }
}
