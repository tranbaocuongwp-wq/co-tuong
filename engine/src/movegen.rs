//! Pseudo-legal move generation.
//!
//! Moves are generated without testing whether they expose the mover's own
//! king; [`Position::make_move`] rejects those and rolls back, which keeps the
//! generator branch-free and makes the flying-general rule fall out of ordinary
//! check detection rather than needing a special case here.

use crate::board::*;
use crate::types::*;

/// The widest position reachable in Xiangqi generates well under 120 moves.
pub const MAX_MOVES: usize = 128;

/// A fixed-capacity move buffer, so search never allocates.
pub struct MoveList {
    pub moves: [Move; MAX_MOVES],
    pub len: usize,
}

impl Default for MoveList {
    fn default() -> Self {
        Self::new()
    }
}

impl MoveList {
    pub fn new() -> Self {
        MoveList {
            moves: [NULL_MOVE; MAX_MOVES],
            len: 0,
        }
    }

    #[inline(always)]
    fn push(&mut self, m: Move) {
        debug_assert!(self.len < MAX_MOVES, "move list overflow");
        if self.len < MAX_MOVES {
            self.moves[self.len] = m;
            self.len += 1;
        }
    }

    #[inline(always)]
    pub fn as_slice(&self) -> &[Move] {
        &self.moves[..self.len]
    }

    pub fn contains(&self, m: Move) -> bool {
        self.as_slice().contains(&m)
    }
}

impl Position {
    /// Generate every pseudo-legal move for the side to move.
    ///
    /// With `captures_only`, emit just the moves that take an enemy piece —
    /// the move set quiescence search explores.
    pub fn generate(&self, list: &mut MoveList, captures_only: bool) {
        list.len = 0;
        let us = self.side;
        let them = 1 - us;

        // A destination is playable if it is on the board and not our own piece;
        // in capture-only mode it must additionally hold an enemy piece.
        let accepts = |board: &[u8; BOARD_LEN], to: usize| -> bool {
            if !on_board(to) {
                return false;
            }
            let dst = board[to];
            if is_side(dst, us) {
                return false;
            }
            !captures_only || is_side(dst, them)
        };

        for from in all_squares() {
            let pc = self.board[from];
            if !is_side(pc, us) {
                continue;
            }
            match kind_of(pc) {
                KING => {
                    for d in KING_MOVES {
                        let to = (from as isize + d) as usize;
                        if in_fort(to) && accepts(&self.board, to) {
                            list.push(mv_make(from, to));
                        }
                    }
                }
                ADVISOR => {
                    for d in ADVISOR_MOVES {
                        let to = (from as isize + d) as usize;
                        if in_fort(to) && accepts(&self.board, to) {
                            list.push(mv_make(from, to));
                        }
                    }
                }
                ELEPHANT => {
                    for (d, eye) in ELEPHANT_MOVES {
                        let to = (from as isize + d) as usize;
                        // The elephant may never cross the river, and its eye
                        // (the midpoint square) must be empty.
                        if !on_board(to) || crossed_river(to, us) {
                            continue;
                        }
                        let eye_sq = (from as isize + eye) as usize;
                        if self.board[eye_sq] != EMPTY {
                            continue;
                        }
                        if accepts(&self.board, to) {
                            list.push(mv_make(from, to));
                        }
                    }
                }
                HORSE => {
                    for (d, leg) in HORSE_MOVES {
                        let leg_sq = (from as isize + leg) as usize;
                        if self.board[leg_sq] != EMPTY {
                            continue; // hobbled horse
                        }
                        let to = (from as isize + d) as usize;
                        if accepts(&self.board, to) {
                            list.push(mv_make(from, to));
                        }
                    }
                }
                ROOK => {
                    for d in ORTHOGONAL {
                        let mut to = (from as isize + d) as usize;
                        while on_board(to) && self.board[to] == EMPTY {
                            if !captures_only {
                                list.push(mv_make(from, to));
                            }
                            to = (to as isize + d) as usize;
                        }
                        if on_board(to) && is_side(self.board[to], them) {
                            list.push(mv_make(from, to));
                        }
                    }
                }
                CANNON => {
                    for d in ORTHOGONAL {
                        let mut to = (from as isize + d) as usize;
                        // Quiet moves: slide freely until something blocks.
                        while on_board(to) && self.board[to] == EMPTY {
                            if !captures_only {
                                list.push(mv_make(from, to));
                            }
                            to = (to as isize + d) as usize;
                        }
                        if !on_board(to) {
                            continue;
                        }
                        // `to` is the screen; the cannon captures the first
                        // piece beyond it, and only if that piece is an enemy.
                        let mut beyond = (to as isize + d) as usize;
                        while on_board(beyond) && self.board[beyond] == EMPTY {
                            beyond = (beyond as isize + d) as usize;
                        }
                        if on_board(beyond) && is_side(self.board[beyond], them) {
                            list.push(mv_make(from, beyond));
                        }
                    }
                }
                _ => {
                    // Pawn: always forward, plus sideways once across the river.
                    let fwd = (from as isize + forward(us)) as usize;
                    if accepts(&self.board, fwd) {
                        list.push(mv_make(from, fwd));
                    }
                    if crossed_river(from, us) {
                        for d in [-1isize, 1] {
                            let to = (from as isize + d) as usize;
                            if accepts(&self.board, to) {
                                list.push(mv_make(from, to));
                            }
                        }
                    }
                }
            }
        }
    }

    /// Play `mv` only if it is fully legal for the side to move.
    ///
    /// [`Position::make_move`] trusts its caller to have produced the move from
    /// generation and checks only for self-exposure. Anything replaying moves
    /// that came from outside the engine — saved games, an experience file, the
    /// UI — must come through here instead, or a corrupt record could teleport
    /// a piece across the board.
    pub fn make_move_checked(&mut self, mv: Move) -> bool {
        let mut list = MoveList::new();
        self.generate(&mut list, false);
        if !list.contains(mv) {
            return false;
        }
        self.make_move(mv)
    }

    /// Every fully legal move for the side to move.
    pub fn legal_moves(&mut self) -> Vec<Move> {
        let mut list = MoveList::new();
        self.generate(&mut list, false);
        let mut out = Vec::with_capacity(list.len);
        for &m in list.as_slice() {
            if self.make_move(m) {
                self.undo_move();
                out.push(m);
            }
        }
        out
    }

    /// True when the side to move has at least one legal reply.
    ///
    /// Cheaper than [`Position::legal_moves`] because it stops at the first hit.
    pub fn has_legal_move(&mut self) -> bool {
        let mut list = MoveList::new();
        self.generate(&mut list, false);
        for &m in list.as_slice() {
            if self.make_move(m) {
                self.undo_move();
                return true;
            }
        }
        false
    }

    /// Count legal move sequences to `depth`, the standard correctness probe.
    pub fn perft(&mut self, depth: u32) -> u64 {
        if depth == 0 {
            return 1;
        }
        let mut list = MoveList::new();
        self.generate(&mut list, false);
        let mut nodes = 0u64;
        for i in 0..list.len {
            let m = list.moves[i];
            if self.make_move(m) {
                nodes += if depth == 1 { 1 } else { self.perft(depth - 1) };
                self.undo_move();
            }
        }
        nodes
    }

    /// Per-move perft breakdown, for bisecting a mismatch against a reference.
    pub fn perft_divide(&mut self, depth: u32) -> Vec<(String, u64)> {
        let mut list = MoveList::new();
        self.generate(&mut list, false);
        let mut out = Vec::new();
        for i in 0..list.len {
            let m = list.moves[i];
            if self.make_move(m) {
                let n = if depth <= 1 { 1 } else { self.perft(depth - 1) };
                self.undo_move();
                out.push((move_to_iccs(m), n));
            }
        }
        out.sort();
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pos(fen: &str) -> Position {
        Position::from_fen(fen).unwrap()
    }

    #[test]
    fn start_position_has_44_legal_moves() {
        // The classic figure: 2 rooks x2, 2 horses x2, 2 cannons x(6+6+... ),
        // 5 pawns, 2 elephants x2, 2 advisors x2, 1 king. Any deviation here
        // means a piece's move rules are wrong.
        let mut p = Position::new();
        assert_eq!(p.legal_moves().len(), 44);
    }

    #[test]
    fn elephant_cannot_cross_the_river_or_move_through_a_blocked_eye() {
        // The kings are deliberately kept off a shared file in every fixture
        // below; otherwise the flying-general rule, not the piece being tested,
        // is what decides legality.
        // Lone red elephant on c0 has two moves: a2 and e2.
        let mut p = pos("3k5/9/9/9/9/9/9/9/9/2B1K4 w - - 0 1");
        let moves: Vec<String> = p.legal_moves().iter().map(|m| move_to_iccs(*m)).collect();
        assert_eq!(moves.iter().filter(|m| m.starts_with("c0")).count(), 2);

        // Block the eye at b1 and only the a-side move disappears.
        let mut p = pos("3k5/9/9/9/9/9/9/9/1P7/2B1K4 w - - 0 1");
        let moves: Vec<String> = p.legal_moves().iter().map(|m| move_to_iccs(*m)).collect();
        assert!(
            !moves.contains(&"c0a2".to_string()),
            "blocked eye must stop it"
        );
        assert!(moves.contains(&"c0e2".to_string()));
    }

    #[test]
    fn pawn_only_moves_sideways_after_crossing() {
        // Red pawn on its own half: forward only.
        let mut p = pos("3k5/9/9/9/9/9/4P4/9/9/4K4 w - - 0 1");
        let m: Vec<String> = p.legal_moves().iter().map(|x| move_to_iccs(*x)).collect();
        assert_eq!(m.iter().filter(|s| s.starts_with("e3")).count(), 1);

        // Same pawn once across the river: forward plus both sideways.
        let mut p = pos("3k5/9/9/4P4/9/9/9/9/9/4K4 w - - 0 1");
        let m: Vec<String> = p.legal_moves().iter().map(|x| move_to_iccs(*x)).collect();
        assert_eq!(m.iter().filter(|s| s.starts_with("e6")).count(), 3);
    }

    #[test]
    fn cannon_captures_only_over_exactly_one_screen() {
        // Red cannon e0, its own pawn as the screen on e4, black rook on e6.
        let mut p = pos("3k5/9/9/4r4/9/4P4/9/9/9/4CK3 w - - 0 1");
        let m: Vec<String> = p.legal_moves().iter().map(|x| move_to_iccs(*x)).collect();
        assert!(
            m.contains(&"e0e6".to_string()),
            "cannon should jump the screen"
        );
        // It must not be able to take the screen itself, nor land short of it.
        assert!(!m.contains(&"e0e4".to_string()));
    }

    #[test]
    fn king_is_confined_to_the_palace() {
        let mut p = pos("4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1");
        let m: Vec<String> = p.legal_moves().iter().map(|x| move_to_iccs(*x)).collect();
        // From e0 the king may go d0, f0, e1 — but e1 keeps it on the open
        // e-file opposite the black king, which the flying-general rule forbids.
        assert!(m.contains(&"e0d0".to_string()));
        assert!(m.contains(&"e0f0".to_string()));
        assert!(
            !m.contains(&"e0e1".to_string()),
            "flying general forbids this"
        );
        // The king can never leave the palace.
        assert!(!m.iter().any(|s| s.starts_with("e0") && s.ends_with("c0")));
    }

    #[test]
    fn checkmate_leaves_no_legal_move() {
        // Black's king on e9 faces Red's king down the open e-file, which is
        // check; both escape squares are covered by rooks. That is mate.
        let mut p = pos("4k4/9/9/9/9/9/9/9/9/3RKR3 b - - 0 1");
        assert!(p.in_check());
        assert!(!p.has_legal_move(), "this position is checkmate");

        // Give Black a rook that can interpose on the e-file and it survives.
        let mut p = pos("4k4/9/9/9/9/9/9/r8/9/3RKR3 b - - 0 1");
        assert!(p.in_check());
        assert!(p.has_legal_move(), "the rook can block on e2");
    }

    #[test]
    fn capture_only_generation_is_a_subset() {
        let p = pos("3k5/9/9/4r4/9/4P4/9/9/9/3RKC3 w - - 0 1");
        let mut all = MoveList::new();
        p.generate(&mut all, false);
        let mut caps = MoveList::new();
        p.generate(&mut caps, true);
        assert!(caps.len < all.len);
        for &m in caps.as_slice() {
            assert!(all.contains(m), "capture move missing from full generation");
            assert!(p.board[mv_to(m)] != EMPTY, "capture must land on a piece");
        }
    }
}
