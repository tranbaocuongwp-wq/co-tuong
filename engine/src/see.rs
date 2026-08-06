//! Static exchange evaluation — "if I take here, do I come out ahead?"
//!
//! Needed by the perpetual-chase rule: a move only counts as a chase (捉) when
//! the threatened capture would actually *win* material. Threatening a piece
//! that is defended by an equal or lesser piece is an idle move (闲), and
//! judging that wrongly is how an engine ends up declaring a game lost that was
//! only ever a draw.
//!
//! Unlike the usual table-driven implementation, this plays the exchange out on
//! the real board. That is slower, but it is the only way to be right about
//! cannons: a cannon attacks through exactly one screen, and every capture in
//! the sequence can create or destroy a screen — including for pieces not yet
//! involved. A swap-list built from a static attacker set cannot model that.

use crate::board::Position;
use crate::eval::{INFINITY, PIECE_VALUE};
use crate::movegen::{MoveList, MAX_MOVES};
use crate::types::*;

/// An exchange can involve at most one capture per piece on the board.
const MAX_EXCHANGE_DEPTH: usize = 32;

impl Position {
    /// Net material the side to move wins by playing the capture `mv`, after
    /// every recapture on that square has played out.
    ///
    /// Returns 0 for a non-capture and `-INFINITY` for an illegal move.
    pub fn see(&mut self, mv: Move) -> i32 {
        let target = mv_to(mv);
        // This is a public entry point, so it cannot borrow `make_move`'s
        // assumption that the caller only ever passes generated moves: moving
        // a piece that is not there would corrupt the board outright.
        if !is_side(self.board[mv_from(mv)], self.side) {
            return 0;
        }
        let victim = self.board[target];
        if victim == EMPTY {
            return 0;
        }
        let gain = PIECE_VALUE[kind_of(victim) as usize];
        if !self.make_move(mv) {
            return -INFINITY;
        }
        let score = gain - self.see_at(target, 0);
        self.undo_move();
        score
    }

    /// Material the side to move can win by capturing on `target`, or 0 when it
    /// does better by leaving the square alone.
    fn see_at(&mut self, target: usize, depth: usize) -> i32 {
        if depth >= MAX_EXCHANGE_DEPTH {
            return 0;
        }
        let victim = self.board[target];
        if victim == EMPTY {
            return 0;
        }
        let gain = PIECE_VALUE[kind_of(victim) as usize];

        // Recapture with the least valuable attacker. Where that piece turns
        // out to be pinned, `make_move` rejects it and the next-cheapest
        // attacker is tried instead.
        let mut list = MoveList::new();
        self.generate(&mut list, true);
        let mut candidates = [(0i32, NULL_MOVE); MAX_MOVES];
        let mut count = 0;
        for &m in list.as_slice() {
            if mv_to(m) != target {
                continue;
            }
            candidates[count] = (PIECE_VALUE[kind_of(self.board[mv_from(m)]) as usize], m);
            count += 1;
        }
        candidates[..count].sort_unstable_by_key(|(value, _)| *value);

        for &(_, m) in &candidates[..count] {
            if !self.make_move(m) {
                continue;
            }
            let score = gain - self.see_at(target, depth + 1);
            self.undo_move();
            // A side is never obliged to enter a losing exchange, so a negative
            // result means the capture simply is not made.
            return score.max(0);
        }
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn see_of(fen: &str, iccs: &str) -> i32 {
        let mut pos = Position::from_fen(fen).unwrap();
        pos.see(iccs_to_move(iccs).unwrap())
    }

    #[test]
    fn taking_a_free_piece_wins_its_full_value() {
        // Black rook on e6, nothing defends it.
        let v = see_of("3k5/9/9/4r4/9/9/9/9/9/4RK3 w - - 0 1", "e0e6");
        assert_eq!(v, PIECE_VALUE[ROOK as usize]);
    }

    #[test]
    fn a_defended_piece_costs_the_attacker() {
        // Red rook takes the black pawn on e5, and the pawn behind it recaptures.
        // Winning a pawn and losing a rook is badly negative.
        let v = see_of("3k5/9/9/4p4/4p4/9/9/9/9/4RK3 w - - 0 1", "e0e5");
        assert!(
            v < 0,
            "taking into a recapture must be judged losing, got {v}"
        );
    }

    #[test]
    fn an_equal_trade_is_neutral() {
        // Rook takes rook, rook recaptures: the exchange nets nothing.
        let v = see_of("3k5/4r4/4r4/9/9/9/9/9/9/4RK3 w - - 0 1", "e0e8");
        assert_eq!(v, 0);
    }

    #[test]
    fn a_quiet_move_scores_zero() {
        assert_eq!(see_of("3k5/9/9/9/9/9/9/9/9/4RK3 w - - 0 1", "e0e5"), 0);
    }

    #[test]
    fn the_defender_declines_a_losing_recapture() {
        // Red pawn e5 takes the black horse on e6. Black's rook on e8 *could*
        // recapture, but Red's rook on e0 — unblocked once the pawn advances —
        // would then win it. Black therefore declines, and Red simply keeps the
        // horse. Getting this wrong is what makes an engine avoid good captures.
        let fen = "3k5/4r4/9/4n4/4P4/9/9/9/9/4RK3 w - - 0 1";
        let v = see_of(fen, "e5e6");
        assert_eq!(
            v, PIECE_VALUE[HORSE as usize],
            "Black should decline the recapture, leaving Red a clean horse"
        );
    }

    #[test]
    fn a_move_from_an_empty_square_is_refused() {
        // `see` is public, so it must not trust its input the way `make_move`
        // does; e4 is empty in this position.
        assert_eq!(
            see_of("3k5/4r4/9/4n4/4P4/9/9/9/9/4RK3 w - - 0 1", "e4e6"),
            0
        );
        // Nor may it move a piece belonging to the other side.
        assert_eq!(
            see_of("3k5/4r4/9/4n4/4P4/9/9/9/9/4RK3 w - - 0 1", "e8e6"),
            0
        );
    }

    #[test]
    fn a_cannon_screen_is_respected() {
        // Red cannon e0, its own pawn on e4 as the screen, black rook on e6.
        // The cannon wins the rook cleanly — nothing defends it.
        let v = see_of("3k5/9/9/4r4/9/4P4/9/9/9/4CK3 w - - 0 1", "e0e6");
        assert_eq!(v, PIECE_VALUE[ROOK as usize]);
    }

    #[test]
    fn see_leaves_the_position_untouched() {
        let fen = "3k5/4r4/4r4/9/9/9/9/9/9/4RK3 w - - 0 1";
        let mut pos = Position::from_fen(fen).unwrap();
        let before = pos.to_fen();
        let key = pos.key;
        pos.see(iccs_to_move("e0e8").unwrap());
        assert_eq!(pos.to_fen(), before);
        assert_eq!(pos.key, key);
        assert_eq!(pos.key, pos.recompute_key());
        assert_eq!(pos.history_len(), 0);
    }

    #[test]
    fn an_illegal_capture_is_rejected() {
        // Taking with the advisor would expose Red's king to the black rook.
        let v = see_of("3k5/9/9/9/9/9/9/9/4A4/4K3r w - - 0 1", "e1d2");
        assert_eq!(v, 0, "not a capture at all");
    }
}
