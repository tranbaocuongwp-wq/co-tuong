//! Position state: the board, FEN conversion, make/unmake, check detection and
//! repetition rules.

use crate::eval::piece_square_value;
use crate::types::*;
use crate::zobrist::{piece_key, SIDE_KEY};

/// Verdict for a position that repeats an earlier one in the game.
///
/// Xiangqi differs sharply from chess here: perpetual checking is *losing*, not
/// a draw. A cycle in which only one side was checking is scored against that
/// side.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RepKind {
    /// Neither side (or both sides) checked throughout the cycle.
    Draw,
    /// The side to move was the perpetual checker, so it loses.
    WeLose,
    /// The opponent was the perpetual checker, so it loses.
    WeWin,
}

#[derive(Clone, Copy)]
struct Undo {
    mv: Move,
    captured: u8,
    halfmove: u32,
    gave_check: bool,
}

/// The starting array, in Xiangqi FEN.
pub const START_FEN: &str = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";

/// Horse move deltas, and for each the leg square measured from the *horse*.
///
/// A horse at `king + delta` reaches `king` only if its leg is empty; the leg is
/// the orthogonal square the horse steps over first.
const HORSE_ATTACK: [(isize, isize); 8] = [
    (-33, 16),
    (-31, 16),
    (-18, 1),
    (-14, -1),
    (14, 1),
    (18, -1),
    (31, -16),
    (33, -16),
];

/// Horse move deltas paired with the leg square measured from the *origin*.
pub const HORSE_MOVES: [(isize, isize); 8] = [
    (-33, -16),
    (-31, -16),
    (-18, -1),
    (-14, 1),
    (14, -1),
    (18, 1),
    (31, 16),
    (33, 16),
];

/// Elephant move deltas paired with the eye square that must be empty.
pub const ELEPHANT_MOVES: [(isize, isize); 4] = [(-34, -17), (-30, -15), (30, 15), (34, 17)];

pub const ADVISOR_MOVES: [isize; 4] = [-17, -15, 15, 17];
pub const KING_MOVES: [isize; 4] = [-16, -1, 1, 16];
pub const ORTHOGONAL: [isize; 4] = [-16, -1, 1, 16];

#[derive(Clone)]
pub struct Position {
    pub board: [u8; BOARD_LEN],
    pub side: u8,
    pub key: u64,
    pub king_sq: [usize; 2],
    /// Incrementally maintained material + piece-square score per side.
    pub score: [i32; 2],
    /// Live piece count per side and kind, so evaluation never rescans the board.
    pub counts: [[i8; 7]; 2],
    /// Plies since the last capture, for the 60-move draw rule.
    pub halfmove: u32,
    /// Full move number, purely for FEN round-tripping.
    pub move_num: u32,
    /// Search ply, reset by [`Position::set_root`].
    pub ply: usize,
    stack: Vec<Undo>,
    /// `keys[i]` is the position key *before* `stack[i]` was played.
    keys: Vec<u64>,
}

impl Default for Position {
    fn default() -> Self {
        Self::from_fen(START_FEN).expect("start position must parse")
    }
}

impl Position {
    pub fn new() -> Self {
        Self::default()
    }

    fn empty() -> Self {
        Position {
            board: [EMPTY; BOARD_LEN],
            side: RED,
            key: 0,
            king_sq: [0; 2],
            score: [0; 2],
            counts: [[0; 7]; 2],
            halfmove: 0,
            move_num: 1,
            ply: 0,
            stack: Vec::with_capacity(256),
            keys: Vec::with_capacity(256),
        }
    }

    // -- piece placement -----------------------------------------------------

    fn add_piece(&mut self, s: usize, pc: u8) {
        self.board[s] = pc;
        self.key ^= piece_key(pc, s);
        let side = side_of(pc) as usize;
        self.score[side] += piece_square_value(pc, s);
        self.counts[side][kind_of(pc) as usize] += 1;
        if kind_of(pc) == KING {
            self.king_sq[side] = s;
        }
    }

    fn remove_piece(&mut self, s: usize) -> u8 {
        let pc = self.board[s];
        debug_assert_ne!(pc, EMPTY);
        self.board[s] = EMPTY;
        self.key ^= piece_key(pc, s);
        let side = side_of(pc) as usize;
        self.score[side] -= piece_square_value(pc, s);
        self.counts[side][kind_of(pc) as usize] -= 1;
        pc
    }

    // -- FEN -----------------------------------------------------------------

    pub fn from_fen(fen: &str) -> Result<Self, String> {
        let mut pos = Position::empty();
        let mut fields = fen.split_whitespace();
        let placement = fields.next().ok_or("empty FEN")?;

        let mut kings_found = [false; 2];
        for (r, rank) in placement.split('/').enumerate() {
            if r >= 10 {
                return Err("FEN has more than 10 ranks".into());
            }
            let mut c = 0usize;
            for ch in rank.chars() {
                if let Some(d) = ch.to_digit(10) {
                    c += d as usize;
                    continue;
                }
                if c >= 9 {
                    return Err(format!("rank {r} overflows the board"));
                }
                let side = if ch.is_ascii_uppercase() { RED } else { BLACK };
                let kind = match ch.to_ascii_lowercase() {
                    'k' => KING,
                    'a' => ADVISOR,
                    'b' | 'e' => ELEPHANT,
                    'n' | 'h' => HORSE,
                    'r' => ROOK,
                    'c' => CANNON,
                    'p' => PAWN,
                    other => return Err(format!("unknown piece '{other}' in FEN")),
                };
                if kind == KING {
                    if kings_found[side as usize] {
                        return Err("FEN has two kings for one side".into());
                    }
                    kings_found[side as usize] = true;
                }
                pos.add_piece(sq(r, c), make_piece(side, kind));
                c += 1;
            }
        }
        if !kings_found[RED as usize] || !kings_found[BLACK as usize] {
            return Err("FEN is missing a king".into());
        }

        match fields.next() {
            None | Some("w") | Some("r") => pos.side = RED,
            Some("b") => {
                pos.side = BLACK;
                pos.key ^= SIDE_KEY;
            }
            Some(other) => return Err(format!("unknown side to move '{other}'")),
        }

        // Fields 3 and 4 (castling / en passant) are placeholders in Xiangqi FEN.
        let _ = fields.next();
        let _ = fields.next();
        pos.halfmove = fields.next().and_then(|s| s.parse().ok()).unwrap_or(0);
        pos.move_num = fields.next().and_then(|s| s.parse().ok()).unwrap_or(1);
        Ok(pos)
    }

    pub fn to_fen(&self) -> String {
        let mut out = String::with_capacity(80);
        for r in 0..10 {
            if r > 0 {
                out.push('/');
            }
            let mut run = 0;
            for c in 0..9 {
                let pc = self.board[sq(r, c)];
                if pc == EMPTY {
                    run += 1;
                    continue;
                }
                if run > 0 {
                    out.push_str(&run.to_string());
                    run = 0;
                }
                let ch = match kind_of(pc) {
                    KING => 'k',
                    ADVISOR => 'a',
                    ELEPHANT => 'b',
                    HORSE => 'n',
                    ROOK => 'r',
                    CANNON => 'c',
                    _ => 'p',
                };
                out.push(if side_of(pc) == RED {
                    ch.to_ascii_uppercase()
                } else {
                    ch
                });
            }
            if run > 0 {
                out.push_str(&run.to_string());
            }
        }
        out.push_str(if self.side == RED { " w" } else { " b" });
        out.push_str(&format!(" - - {} {}", self.halfmove, self.move_num));
        out
    }

    // -- attack detection ----------------------------------------------------

    /// True when `s` is attacked by any piece of `by`.
    ///
    /// Only rooks, cannons, horses, pawns and the enemy king can ever attack the
    /// square a king stands on — advisors and elephants are confined to their
    /// own half — but this routine is written for any square, so it covers them
    /// too where it is cheap to do so.
    pub fn is_attacked(&self, s: usize, by: u8) -> bool {
        // Pawns: an enemy pawn reaches `s` from behind, or sideways once it has
        // crossed the river.
        let pawn = make_piece(by, PAWN);
        let back = (s as isize - forward(by)) as usize;
        if on_board(back) && self.board[back] == pawn {
            return true;
        }
        for d in [-1isize, 1] {
            let f = (s as isize + d) as usize;
            if on_board(f) && self.board[f] == pawn && crossed_river(f, by) {
                return true;
            }
        }

        // Horses, respecting the blocked leg.
        let horse = make_piece(by, HORSE);
        for (d, leg) in HORSE_ATTACK {
            let h = (s as isize + d) as usize;
            if on_board(h) && self.board[h] == horse {
                let l = (h as isize + leg) as usize;
                if self.board[l] == EMPTY {
                    return true;
                }
            }
        }

        // Advisors and elephants (never relevant for kings, but kept correct).
        let advisor = make_piece(by, ADVISOR);
        for d in ADVISOR_MOVES {
            let a = (s as isize + d) as usize;
            if on_board(a) && self.board[a] == advisor && in_fort(a) {
                return true;
            }
        }
        let elephant = make_piece(by, ELEPHANT);
        for (d, eye) in ELEPHANT_MOVES {
            let e = (s as isize + d) as usize;
            if on_board(e) && self.board[e] == elephant {
                let eye_sq = (e as isize + eye) as usize;
                if self.board[eye_sq] == EMPTY && !crossed_river(s, by) {
                    return true;
                }
            }
        }

        // Sliding scans handle rook, king (adjacent + the flying-general rule)
        // and cannon (which needs exactly one screen) in a single pass.
        let rook = make_piece(by, ROOK);
        let cannon = make_piece(by, CANNON);
        let king = make_piece(by, KING);
        for d in ORTHOGONAL {
            let mut t = (s as isize + d) as usize;
            while on_board(t) && self.board[t] == EMPTY {
                t = (t as isize + d) as usize;
            }
            if !on_board(t) {
                continue;
            }
            // First blocker: a rook attacks, and so does a king standing
            // directly opposite with nothing in between (the flying general).
            if self.board[t] == rook || self.board[t] == king {
                return true;
            }
            // Look past the screen for a cannon.
            let mut u = (t as isize + d) as usize;
            while on_board(u) && self.board[u] == EMPTY {
                u = (u as isize + d) as usize;
            }
            if on_board(u) && self.board[u] == cannon {
                return true;
            }
        }
        false
    }

    /// True when `side`'s king is in check (including by the flying general).
    #[inline]
    pub fn is_checked(&self, side: u8) -> bool {
        self.is_attacked(self.king_sq[side as usize], 1 - side)
    }

    /// True when the side to move is in check.
    #[inline]
    pub fn in_check(&self) -> bool {
        self.is_checked(self.side)
    }

    // -- make / unmake -------------------------------------------------------

    /// Play `mv` unconditionally. Returns `false` and leaves the position
    /// untouched if the move would expose the mover's own king, which is how
    /// pseudo-legal moves are filtered.
    pub fn make_move(&mut self, mv: Move) -> bool {
        let from = mv_from(mv);
        let to = mv_to(mv);
        let mover = self.board[from];
        debug_assert!(is_side(mover, self.side));

        let captured = self.board[to];
        self.keys.push(self.key);

        if captured != EMPTY {
            self.remove_piece(to);
        }
        self.remove_piece(from);
        self.add_piece(to, mover);

        let me = self.side;
        if self.is_checked(me) {
            // Illegal: roll back exactly what we just did.
            self.remove_piece(to);
            self.add_piece(from, mover);
            if captured != EMPTY {
                self.add_piece(to, captured);
            }
            self.keys.pop();
            return false;
        }

        let prev_halfmove = self.halfmove;
        self.halfmove = if captured == EMPTY {
            self.halfmove + 1
        } else {
            0
        };
        self.side = 1 - self.side;
        self.key ^= SIDE_KEY;
        if self.side == RED {
            self.move_num += 1;
        }
        self.ply += 1;

        let gave_check = self.is_checked(self.side);
        self.stack.push(Undo {
            mv,
            captured,
            halfmove: prev_halfmove,
            gave_check,
        });
        true
    }

    pub fn undo_move(&mut self) {
        let u = self.stack.pop().expect("undo_move with empty stack");
        let from = mv_from(u.mv);
        let to = mv_to(u.mv);

        self.ply -= 1;
        if self.side == RED {
            self.move_num -= 1;
        }
        self.side = 1 - self.side;
        self.key ^= SIDE_KEY;
        self.halfmove = u.halfmove;

        let mover = self.remove_piece(to);
        self.add_piece(from, mover);
        if u.captured != EMPTY {
            self.add_piece(to, u.captured);
        }
        self.keys.pop();
        debug_assert_eq!(self.key, *self.keys.last().unwrap_or(&self.key));
    }

    /// Pass the turn, for null-move pruning. Never call this while in check.
    pub fn make_null_move(&mut self) {
        self.keys.push(self.key);
        self.stack.push(Undo {
            mv: NULL_MOVE,
            captured: EMPTY,
            halfmove: self.halfmove,
            gave_check: false,
        });
        self.side = 1 - self.side;
        self.key ^= SIDE_KEY;
        self.halfmove += 1;
        self.ply += 1;
    }

    pub fn undo_null_move(&mut self) {
        let u = self.stack.pop().expect("undo_null_move with empty stack");
        self.ply -= 1;
        self.halfmove = u.halfmove;
        self.side = 1 - self.side;
        self.key ^= SIDE_KEY;
        self.keys.pop();
    }

    // -- game-level rules ----------------------------------------------------

    /// Detect a repetition of the current position and score it under Xiangqi
    /// rules, where the perpetual checker loses.
    pub fn repetition(&self) -> Option<RepKind> {
        let n = self.stack.len();
        let mut we_check = true;
        let mut they_check = true;
        let mut steps = 0usize;
        let mut i = n;
        while i > 0 {
            i -= 1;
            let u = self.stack[i];
            if u.captured != EMPTY {
                // A capture is irreversible: nothing before it can recur.
                break;
            }
            steps += 1;
            if steps % 2 == 1 {
                they_check &= u.gave_check;
            } else {
                we_check &= u.gave_check;
            }
            if steps.is_multiple_of(2) && self.keys[i] == self.key {
                return Some(match (we_check, they_check) {
                    (true, false) => RepKind::WeLose,
                    (false, true) => RepKind::WeWin,
                    _ => RepKind::Draw,
                });
            }
        }
        None
    }

    /// True once 120 plies (60 full moves) have passed with no capture.
    pub fn is_draw_by_halfmove(&self) -> bool {
        self.halfmove >= 120
    }

    /// Neither side has a piece that can deliver mate on its own.
    pub fn is_material_draw(&self) -> bool {
        all_squares().all(|s| {
            let pc = self.board[s];
            pc == EMPTY || matches!(kind_of(pc), KING | ADVISOR | ELEPHANT)
        })
    }

    /// Reset the search-relative ply counter; call before starting a search.
    pub fn set_root(&mut self) {
        self.ply = 0;
    }

    /// The move played to reach this position, if any.
    pub fn last_move(&self) -> Option<Move> {
        self.stack.last().map(|u| u.mv).filter(|m| *m != NULL_MOVE)
    }

    pub fn history_len(&self) -> usize {
        self.stack.len()
    }

    /// Recompute the key and incremental score from scratch; used by tests to
    /// prove the incremental updates never drift.
    pub fn recompute_key(&self) -> u64 {
        let mut k = 0u64;
        for s in all_squares() {
            if self.board[s] != EMPTY {
                k ^= piece_key(self.board[s], s);
            }
        }
        if self.side == BLACK {
            k ^= SIDE_KEY;
        }
        k
    }

    pub fn recompute_score(&self) -> [i32; 2] {
        let mut sc = [0i32; 2];
        for s in all_squares() {
            let pc = self.board[s];
            if pc != EMPTY {
                sc[side_of(pc) as usize] += piece_square_value(pc, s);
            }
        }
        sc
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_position_round_trips_through_fen() {
        let pos = Position::new();
        assert_eq!(pos.to_fen(), START_FEN);
        assert_eq!(pos.side, RED);
        assert_eq!(pos.key, pos.recompute_key());
        assert_eq!(pos.score, pos.recompute_score());
        assert!(!pos.in_check());
    }

    #[test]
    fn kings_are_located() {
        let pos = Position::new();
        assert_eq!(pos.board[pos.king_sq[RED as usize]], RED_KING);
        assert_eq!(pos.board[pos.king_sq[BLACK as usize]], BLACK_KING);
        assert_eq!(pos.king_sq[RED as usize], sq(9, 4));
        assert_eq!(pos.king_sq[BLACK as usize], sq(0, 4));
    }

    #[test]
    fn flying_general_is_detected() {
        // Bare kings facing each other down the e-file with nothing between.
        let pos = Position::from_fen("4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert!(pos.is_checked(RED));
        assert!(pos.is_checked(BLACK));
        // Interpose a pawn and the confrontation is broken.
        let pos = Position::from_fen("4k4/9/9/9/4P4/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert!(!pos.is_checked(RED));
        assert!(!pos.is_checked(BLACK));
    }

    #[test]
    fn cannon_needs_exactly_one_screen() {
        // Cannon on e5, one screen on e3 -> checks the king on e0.
        let pos = Position::from_fen("4k4/9/9/9/9/4C4/9/4N4/9/4K4 w - - 0 1").unwrap();
        assert!(!pos.is_checked(BLACK), "no screen means no cannon check");

        let pos = Position::from_fen("4k4/9/4N4/9/9/4C4/9/9/9/4K4 w - - 0 1").unwrap();
        assert!(pos.is_checked(BLACK), "exactly one screen gives check");

        let pos = Position::from_fen("4k4/4N4/4N4/9/9/4C4/9/9/9/4K4 w - - 0 1").unwrap();
        assert!(!pos.is_checked(BLACK), "two screens block the cannon");
    }

    #[test]
    fn horse_check_respects_its_leg() {
        // Kings sit on different files throughout so the flying-general rule
        // cannot be what produces the check we are measuring.
        // Black king d9; red horse c7 attacks it.
        let pos = Position::from_fen("3k5/9/2N6/9/9/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert!(pos.is_checked(BLACK));
        // Put a piece on the horse's leg (c8) and the attack evaporates.
        let pos = Position::from_fen("3k5/2P6/2N6/9/9/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert!(!pos.is_checked(BLACK), "blocked leg means no horse check");
    }

    #[test]
    fn make_and_undo_restore_state_exactly() {
        let mut pos = Position::new();
        let before_fen = pos.to_fen();
        let before_key = pos.key;
        let before_score = pos.score;

        // Centre cannon: h2 -> e2.
        let mv = iccs_to_move("h2e2").unwrap();
        assert!(pos.make_move(mv));
        assert_eq!(pos.side, BLACK);
        assert_eq!(pos.key, pos.recompute_key());
        assert_eq!(pos.score, pos.recompute_score());

        pos.undo_move();
        assert_eq!(pos.to_fen(), before_fen);
        assert_eq!(pos.key, before_key);
        assert_eq!(pos.score, before_score);
    }

    #[test]
    fn illegal_move_is_rejected_and_leaves_position_intact() {
        // Moving the advisor away would expose Red's king to the black rook.
        let mut pos = Position::from_fen("3k5/9/9/9/9/9/9/9/4A4/4K3r w - - 0 1").unwrap();
        let before = pos.to_fen();
        let before_key = pos.key;
        let mv = mv_make(sq(8, 4), sq(7, 3));
        assert!(!pos.make_move(mv), "self-exposing move must be rejected");
        assert_eq!(pos.to_fen(), before);
        assert_eq!(pos.key, before_key);
        assert_eq!(pos.key, pos.recompute_key());
    }
}
