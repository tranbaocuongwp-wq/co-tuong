//! Position state: the board, FEN conversion, make/unmake, check detection and
//! repetition rules.

use crate::eval::piece_square_value;
use crate::movegen::MoveList;
use crate::types::*;
use crate::zobrist::{piece_key, SIDE_KEY};

/// Verdict for a position that repeats an earlier one in the game.
///
/// Xiangqi differs sharply from chess here: perpetual checking is *losing*, not
/// a draw. A cycle in which only one side was checking is scored against that
/// side.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RepKind {
    /// Neither side was at fault, or both were in the same way.
    Draw,
    /// The side to move was the offender, so it loses.
    WeLose(Forcing),
    /// The opponent was the offender, so it loses.
    WeWin(Forcing),
}

/// Which offence the losing side committed. Carried through so the interface
/// can tell a player *why* the game ended rather than just that it did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Forcing {
    /// 长将 — perpetual check.
    Check,
    /// 长捉 — perpetual chase.
    Chase,
}

/// What a move was doing, for the repetition rules.
///
/// The Chinese terms are the ones the competition rules use: 将 (check),
/// 捉 (chase) and 闲 (idle). Only the first two are "forcing"; a single idle
/// move anywhere in a repeated cycle clears the side that played it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Intent {
    /// 将 — the move gives check.
    Check,
    /// 捉 — the move creates a new threat to win material.
    Chase,
    /// 闲 — anything else.
    Idle,
}

/// Longest repeated cycle still examined for a perpetual chase.
///
/// Six full moves is far more than a real chase needs; beyond that the cycle is
/// shuffling, and classifying it costs more than it is worth.
const MAX_CHASE_CYCLE: usize = 12;

/// Bit position of a square in the 90-bit target set the chase rules use.
#[inline]
fn target_bit(s: usize) -> u32 {
    (disp_row(s) * 9 + disp_col(s)) as u32
}

#[derive(Clone, Copy)]
struct Undo {
    mv: Move,
    captured: u8,
    halfmove: u32,
    gave_check: bool,
}

/// A plain description of the move just played, for the commentary.
///
/// Deliberately says nothing about evaluation. Someone watching a board can see
/// which piece moved, what it took and what it is now aiming at without knowing
/// a single centipawn, and those are the facts a commentator speaks from.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MoveReport {
    /// Kind of the piece that moved.
    pub mover: u8,
    /// Which side played it.
    pub mover_side: u8,
    /// Kind taken, if the move was a capture.
    pub captured: Option<u8>,
    /// Whether the move left the opponent in check.
    pub gives_check: bool,
    /// Enemy kinds the moved piece could now profitably take, best first.
    pub threats: Vec<u8>,
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
        let plies = self.repetition_distance()?;

        // A null move inside the window means we are somewhere in null-move
        // pruning, where the sequence is not a real game continuation and the
        // pieces never actually moved. Classifying it would be meaningless, so
        // fall back to the check-only verdict.
        let window = &self.stack[self.stack.len() - plies..];
        if window.iter().any(|u| u.mv == NULL_MOVE) {
            return Some(self.judge_by_checks(plies));
        }

        // Perpetual check is decisive on its own, and full classification
        // cannot overturn it: a side that checked every move is forcing under
        // any reading. Taking the cheap answer here keeps the common case out
        // of the replay below, which matters because this runs at every node.
        let by_checks = self.judge_by_checks(plies);
        if by_checks != RepKind::Draw {
            return Some(by_checks);
        }

        // A genuine chase is short: the chaser re-establishes the threat every
        // move or two. Long cycles are shuffles, and replaying them is the
        // expensive case, so they are left as draws — an omission, never a
        // wrong loss.
        if plies > MAX_CHASE_CYCLE {
            return Some(RepKind::Draw);
        }

        // Otherwise the cycle has to be replayed to look for a chase. That runs
        // on a copy so the caller's position — mid-search — is never disturbed.
        let mut probe = self.clone_cycle(plies);
        Some(probe.judge_cycle(plies))
    }

    /// Plies back to the most recent identical position, or `None` if the
    /// current position does not repeat.
    ///
    /// Deliberately cheap: this runs at every search node, whereas the verdict
    /// below only runs on the rare occasions it returns `Some`.
    fn repetition_distance(&self) -> Option<usize> {
        let mut steps = 0usize;
        let mut i = self.stack.len();
        while i > 0 {
            i -= 1;
            if self.stack[i].captured != EMPTY {
                // A capture is irreversible: nothing before it can recur.
                break;
            }
            steps += 1;
            if steps.is_multiple_of(2) && self.keys[i] == self.key {
                return Some(steps);
            }
        }
        None
    }

    /// Verdict using only the recorded check flags.
    ///
    /// This is the conservative fallback: it can find perpetual check but never
    /// perpetual chase, so the worst it does is call a draw.
    fn judge_by_checks(&self, plies: usize) -> RepKind {
        let mut we_check = true;
        let mut they_check = true;
        for (offset, u) in self.stack[self.stack.len() - plies..]
            .iter()
            .rev()
            .enumerate()
        {
            if offset % 2 == 0 {
                they_check &= u.gave_check;
            } else {
                we_check &= u.gave_check;
            }
        }
        match (we_check, they_check) {
            (true, false) => RepKind::WeLose(Forcing::Check),
            (false, true) => RepKind::WeWin(Forcing::Check),
            _ => RepKind::Draw,
        }
    }

    /// Full verdict: replay the cycle, classify every move, and apply the
    /// competition rules.
    ///
    /// Consumes `self` as scratch space — call it on a copy.
    fn judge_cycle(&mut self, plies: usize) -> RepKind {
        let us = self.side;

        let mut moves = Vec::with_capacity(plies);
        for _ in 0..plies {
            match self.stack.last() {
                Some(u) => moves.push(u.mv),
                None => return RepKind::Draw,
            }
            self.undo_move();
        }
        moves.reverse();

        // "Forcing" means every move that side made in the cycle was a check or
        // a chase — one idle move anywhere in the cycle clears the side.
        let mut us_forcing = true;
        let mut us_only_checks = true;
        let mut them_forcing = true;
        let mut them_only_checks = true;

        for mv in moves {
            let mover = self.side;
            let Some(intent) = self.classify_and_make(mv) else {
                // The cycle did not replay. This should be impossible for moves
                // taken off our own stack, but guessing at a verdict from a
                // half-replayed position is exactly the mistake worth avoiding.
                return RepKind::Draw;
            };
            if mover == us {
                us_forcing &= intent != Intent::Idle;
                us_only_checks &= intent == Intent::Check;
            } else {
                them_forcing &= intent != Intent::Idle;
                them_only_checks &= intent == Intent::Check;
            }
        }

        // A side that checked on every move is a perpetual checker; otherwise
        // its offence was the chasing.
        let offence = |only_checks: bool| {
            if only_checks {
                Forcing::Check
            } else {
                Forcing::Chase
            }
        };

        match (us_forcing, them_forcing) {
            (true, false) => RepKind::WeLose(offence(us_only_checks)),
            (false, true) => RepKind::WeWin(offence(them_only_checks)),
            (false, false) => RepKind::Draw,
            // Both sides are at fault. Perpetual checking is judged more
            // harshly than perpetual chasing, so a side that only checked loses
            // to a side that only chased; like against like is a draw.
            (true, true) => match (us_only_checks, them_only_checks) {
                (true, false) => RepKind::WeLose(Forcing::Check),
                (false, true) => RepKind::WeWin(Forcing::Check),
                _ => RepKind::Draw,
            },
        }
    }

    /// Play `mv` and report what it was doing: checking, chasing, or neither.
    ///
    /// Returns `None` (leaving the position untouched) if the move will not
    /// replay.
    fn classify_and_make(&mut self, mv: Move) -> Option<Intent> {
        let mover = self.side;
        let before: u128 = self.profitable_targets(mover);
        if !self.make_move(mv) {
            return None;
        }
        if self.in_check() {
            // The side now to move is in check, so the move just played was one.
            return Some(Intent::Check);
        }
        let after = self.profitable_targets(mover);
        // Only a *newly created* threat counts as a chase. Without this, a side
        // shuffling harmlessly while an unrelated piece of theirs happens to
        // stand en prise would be condemned for chasing.
        let created_threat = after & !before != 0;
        Some(if created_threat {
            Intent::Chase
        } else {
            Intent::Idle
        })
    }

    /// Squares holding enemy pieces that `side` could profitably capture, as a
    /// bitset over the 90 playable points.
    ///
    /// The exclusions are the rule's, not conveniences:
    /// * a King or Pawn doing the threatening counts as idle;
    /// * the King as target is check, handled separately;
    /// * a Pawn that has not crossed the river is not protected by the rule;
    /// * and the capture must actually win material, or it is merely an offer
    ///   to trade.
    ///
    /// Takes `&mut self` and flips the side to move in place rather than
    /// working on a copy: this is called twice per ply of every repeated cycle,
    /// and the copying showed up plainly in the engine's node rate.
    fn profitable_targets(&mut self, side: u8) -> u128 {
        let saved_side = self.side;
        let saved_key = self.key;
        if self.side != side {
            self.side = side;
            self.key ^= SIDE_KEY;
        }

        let mut list = MoveList::new();
        self.generate(&mut list, true);
        let mut bits: u128 = 0;

        for i in 0..list.len {
            let m = list.moves[i];
            let to = mv_to(m);
            let bit = 1u128 << target_bit(to);
            if bits & bit != 0 {
                continue; // already established by a cheaper attacker
            }
            let attacker = self.board[mv_from(m)];
            let victim = self.board[to];
            if matches!(kind_of(attacker), KING | PAWN) {
                continue;
            }
            if kind_of(victim) == KING {
                continue;
            }
            if kind_of(victim) == PAWN && !crossed_river(to, 1 - side) {
                continue;
            }
            // An undefended piece is winnable without playing the exchange out,
            // which is the common case and skips the expensive part.
            let profitable = if self.is_attacked(to, 1 - side) {
                self.see(m) > 0
            } else {
                true
            };
            if profitable {
                bits |= bit;
            }
        }

        self.side = saved_side;
        self.key = saved_key;
        bits
    }

    /// A copy carrying only the last `plies` of history — enough to unwind and
    /// replay the cycle, and nothing more.
    ///
    /// A plain `clone` would copy the entire game history on every repetition
    /// hit. Search finds repetitions constantly, and that copying alone cost
    /// about a fifth of the engine's speed.
    fn clone_cycle(&self, plies: usize) -> Position {
        let start = self.stack.len() - plies;
        Position {
            board: self.board,
            side: self.side,
            key: self.key,
            king_sq: self.king_sq,
            score: self.score,
            counts: self.counts,
            halfmove: self.halfmove,
            move_num: self.move_num,
            ply: 0,
            stack: self.stack[start..].to_vec(),
            keys: self.keys[start..].to_vec(),
        }
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

    /// What the move just played did, and what the piece that played it is now
    /// eyeing.
    ///
    /// This exists for the commentary, not for the search — it answers the
    /// questions someone watching the board asks out loud: which piece moved,
    /// what did it take, and what is it threatening now. Returns `None` before
    /// the first move.
    ///
    /// "Threatening" here is the same standard the chase rule uses, and for the
    /// same reason: a capture that merely offers a trade is not a threat, and
    /// saying it is would make the commentator cry wolf every time two pieces
    /// looked at each other. Only captures that actually win material count.
    pub fn last_move_report(&mut self) -> Option<MoveReport> {
        let u = *self.stack.last()?;
        let to = mv_to(u.mv);
        let moved = self.board[to];
        // A move is always followed by the side flipping, so the piece that
        // just moved belongs to whoever is *not* to move now.
        let mover_side = side_of(moved);

        let saved_side = self.side;
        let saved_key = self.key;
        if self.side != mover_side {
            self.side = mover_side;
            self.key ^= SIDE_KEY;
        }

        let mut list = MoveList::new();
        self.generate(&mut list, true);
        let mut threats = Vec::new();

        for i in 0..list.len {
            let m = list.moves[i];
            // Only what *this* piece threatens. What the rest of the army is
            // doing was already true before the move and is not news.
            if mv_from(m) != to {
                continue;
            }
            let target = mv_to(m);
            let victim = self.board[target];
            if kind_of(victim) == KING {
                continue; // that is check, and it is reported on its own
            }
            let profitable = if self.is_attacked(target, 1 - mover_side) {
                self.see(m) > 0
            } else {
                true
            };
            if profitable && !threats.contains(&kind_of(victim)) {
                threats.push(kind_of(victim));
            }
        }

        self.side = saved_side;
        self.key = saved_key;

        // Most valuable first: that is the one worth naming.
        threats.sort_by_key(|k| match *k {
            ROOK => 0,
            CANNON => 1,
            HORSE => 2,
            ELEPHANT => 3,
            ADVISOR => 4,
            _ => 5,
        });

        Some(MoveReport {
            mover: kind_of(moved),
            captured: if u.captured == EMPTY {
                None
            } else {
                Some(kind_of(u.captured))
            },
            mover_side,
            gives_check: self.in_check(),
            threats,
        })
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

    /// A rook swinging onto a file to eye an undefended cannon.
    ///
    /// The position is deliberately bare: the point is that the report names
    /// the piece that moved and the piece it now threatens, not that the engine
    /// evaluates the position well.
    #[test]
    fn a_move_report_names_the_mover_and_what_it_threatens() {
        let mut pos = Position::from_fen("5k3/9/4c4/9/R8/9/9/9/9/3K5 w - - 0 1").unwrap();
        assert!(pos.make_move_checked(iccs_to_move("a5e5").unwrap()));

        let report = pos.last_move_report().unwrap();
        assert_eq!(report.mover, ROOK);
        assert_eq!(report.mover_side, RED);
        assert_eq!(report.captured, None);
        assert!(!report.gives_check);
        assert_eq!(report.threats, vec![CANNON]);
    }

    /// A capture reports what it took, and stops threatening what it just ate.
    #[test]
    fn a_move_report_names_the_capture() {
        let mut pos = Position::from_fen("5k3/9/4c4/9/4R4/9/9/9/9/3K5 w - - 0 1").unwrap();
        assert!(pos.make_move_checked(iccs_to_move("e5e7").unwrap()));

        let report = pos.last_move_report().unwrap();
        assert_eq!(report.mover, ROOK);
        assert_eq!(report.captured, Some(CANNON));
        assert!(report.threats.is_empty());
    }

    /// Nothing has been played, so there is nothing to report.
    #[test]
    fn a_move_report_needs_a_move() {
        let mut pos = Position::new();
        assert!(pos.last_move_report().is_none());
    }
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

    fn play(pos: &mut Position, moves: &[&str]) {
        for mv in moves {
            assert!(
                pos.make_move_checked(iccs_to_move(mv).unwrap()),
                "'{mv}' is illegal in {}",
                pos.to_fen()
            );
        }
    }

    /// Red's rook hounds an undefended black horse; the horse dodges between
    /// two squares and the rook follows. Red is the one refusing to vary, so
    /// Red loses — this is the whole point of the perpetual-chase rule.
    #[test]
    fn perpetual_chase_loses_for_the_chaser() {
        let mut pos = Position::from_fen("3k5/9/8R/9/n8/9/9/9/9/4K4 w - - 0 1").unwrap();
        play(&mut pos, &["i7i5", "a5b7", "i5i7", "b7a5"]);
        // Red is to move again at the repeated position, so "we" is Red.
        assert_eq!(pos.repetition(), Some(RepKind::WeLose(Forcing::Chase)));
    }

    /// The same shape, but nothing is under threat: two rooks shuffling on
    /// opposite edges. Nobody is at fault, so it is a draw.
    #[test]
    fn harmless_shuffling_is_a_draw() {
        let mut pos = Position::from_fen("3k5/9/8r/9/9/9/9/R8/9/4K4 w - - 0 1").unwrap();
        play(&mut pos, &["a2a3", "i7i6", "a3a2", "i6i7"]);
        assert_eq!(pos.repetition(), Some(RepKind::Draw));
    }

    /// Perpetual check must still be caught now that classification runs.
    #[test]
    fn perpetual_check_still_loses() {
        let mut pos = Position::from_fen("3k5/4R4/9/9/9/9/9/9/9/K8 w - - 0 1").unwrap();
        play(&mut pos, &["e8d8", "d9e9", "d8e8", "e9d9"]);
        assert_eq!(pos.repetition(), Some(RepKind::WeLose(Forcing::Check)));
    }

    #[test]
    fn a_position_that_does_not_repeat_returns_nothing() {
        let mut pos = Position::new();
        play(&mut pos, &["h2e2", "h9g7", "h0g2"]);
        assert_eq!(pos.repetition(), None);
    }

    // -- what counts as a chase ---------------------------------------------

    #[test]
    fn a_defended_piece_is_not_being_chased() {
        // Red rook eyes the black horse on a5, but a black rook on a9 guards
        // the file: taking wins a horse and loses a rook, so it is an offer to
        // trade, not a chase.
        let mut guarded = Position::from_fen("r2k5/9/9/9/n7R/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert_eq!(
            guarded.profitable_targets(RED),
            0,
            "a losing capture must not count as a chase"
        );

        // Remove the guard and the same attack becomes a real threat.
        let mut loose = Position::from_fen("3k5/9/9/9/n7R/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert_eq!(loose.profitable_targets(RED), 1u128 << target_bit(sq(4, 0)));
    }

    #[test]
    fn a_pawn_short_of_the_river_is_not_worth_chasing() {
        // The rule does not protect a pawn that has not crossed.
        let mut home = Position::from_fen("3k5/9/9/p7R/9/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert_eq!(home.profitable_targets(RED), 0);

        // Once across, it is a normal target.
        let mut across = Position::from_fen("3k5/9/9/9/9/p7R/9/9/9/4K4 w - - 0 1").unwrap();
        assert_eq!(
            across.profitable_targets(RED),
            1u128 << target_bit(sq(5, 0))
        );
    }

    #[test]
    fn a_pawn_or_king_doing_the_threatening_counts_as_idle() {
        // A pawn attacking a horse is not a chase, however profitable.
        let mut pawn = Position::from_fen("3k5/9/9/4n4/4P4/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert_eq!(pawn.profitable_targets(RED), 0);

        // Neither is the king attacking a piece beside it.
        let mut king = Position::from_fen("3k5/9/9/9/9/9/9/9/4n4/4K4 w - - 0 1").unwrap();
        assert_eq!(king.profitable_targets(RED), 0);
    }

    #[test]
    fn only_a_newly_created_threat_is_a_chase() {
        // Red's rook on i5 already attacks the horse on a5. Moving a *different*
        // piece changes nothing about that threat, so it is an idle move — the
        // engine must not condemn a side merely for having a standing attack.
        let mut pos = Position::from_fen("3k5/9/9/9/n7R/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert_eq!(pos.profitable_targets(RED), 1u128 << target_bit(sq(4, 0)));
        let idle = pos.classify_and_make(iccs_to_move("e0e1").unwrap());
        assert_eq!(idle, Some(Intent::Idle));

        // Whereas creating the attack in the first place is a chase.
        let mut fresh = Position::from_fen("3k5/9/8R/9/n8/9/9/9/9/4K4 w - - 0 1").unwrap();
        assert_eq!(
            fresh.classify_and_make(iccs_to_move("i7i5").unwrap()),
            Some(Intent::Chase)
        );
    }

    #[test]
    fn classification_leaves_a_replayable_position() {
        // The verdict is computed on a copy, so the real position must come
        // through a repetition check completely unchanged.
        let mut pos = Position::from_fen("3k5/9/8R/9/n8/9/9/9/9/4K4 w - - 0 1").unwrap();
        play(&mut pos, &["i7i5", "a5b7", "i5i7", "b7a5"]);
        let fen = pos.to_fen();
        let key = pos.key;
        let len = pos.history_len();
        pos.repetition();
        assert_eq!(pos.to_fen(), fen);
        assert_eq!(pos.key, key);
        assert_eq!(pos.key, pos.recompute_key());
        assert_eq!(pos.history_len(), len);
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
