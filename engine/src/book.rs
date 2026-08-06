//! A small opening book.
//!
//! The book is written as *lines of moves* rather than as a table of
//! position-to-move pairs, and the table is built by replaying those lines from
//! the initial array. Hand-writing FEN keys is how opening books acquire silent
//! bugs; replaying means an illegal or mistyped move fails loudly in
//! [`tests::every_book_line_is_legal`] instead of quietly never matching.
//!
//! Its real job is variety. Without a book the engine opens with the same move
//! every game, which makes even a strong opponent feel mechanical.

use std::collections::HashMap;

use crate::board::Position;
use crate::types::{iccs_to_move, Move};

/// Well-trodden opening lines, in ICCS coordinate notation.
///
/// Names are the traditional Vietnamese/Chinese ones so the intent is legible:
/// these are the openings a club player would actually meet.
const LINES: &[(&str, &[&str])] = &[
    // Pháo đầu (中炮) — the central cannon, the most common opening of all.
    (
        "Pháo đầu vs Bình phong mã",
        &["h2e2", "h9g7", "h0g2", "i9h9", "i0h0", "b9c7"],
    ),
    (
        "Pháo đầu vs Bình phong mã (biến)",
        &["h2e2", "b9c7", "h0g2", "h9g7", "i0h0", "i9h9"],
    ),
    (
        "Pháo đầu vs Phản cung mã",
        &["h2e2", "b9c7", "h0g2", "h7f7"],
    ),
    ("Thuận pháo", &["h2e2", "h7e7", "h0g2", "h9g7"]),
    ("Nghịch pháo", &["h2e2", "b7e7", "h0g2", "b9c7"]),
    // Pháo đầu from the other wing.
    ("Pháo đầu cánh trái", &["b2e2", "h9g7", "b0c2", "i9h9"]),
    // Tiên nhân chỉ lộ (仙人指路) — the pawn thrust.
    ("Tiên nhân chỉ lộ", &["c3c4", "c6c5", "b0c2", "b9c7"]),
    (
        "Tiên nhân chỉ lộ (cánh phải)",
        &["g3g4", "g6g5", "h0g2", "h9g7"],
    ),
    // Khởi mã cục (起马局) — horse first.
    ("Khởi mã cục", &["h0g2", "h9g7", "g3g4", "g6g5"]),
    // Phi tượng cục (飞相局) — elephant first, a quiet system.
    ("Phi tượng cục", &["c0e2", "h9g7", "h0g2", "b7e7"]),
    ("Phi tượng cục (biến)", &["g0e2", "b9c7", "b0c2", "h7f7"]),
    // Quá cung pháo (过宫炮).
    ("Quá cung pháo", &["h2d2", "h9g7", "h0g2", "i9h9"]),
];

/// Maps a position key to the book moves playable there.
pub struct Book {
    entries: HashMap<u64, Vec<Move>>,
}

impl Default for Book {
    fn default() -> Self {
        Self::new()
    }
}

impl Book {
    /// Build the book by replaying every line from the initial array.
    pub fn new() -> Self {
        let mut entries: HashMap<u64, Vec<Move>> = HashMap::new();
        for (_name, line) in LINES {
            let mut pos = Position::new();
            for token in *line {
                let Some(mv) = iccs_to_move(token) else { break };
                let slot = entries.entry(pos.key).or_default();
                if !slot.contains(&mv) {
                    slot.push(mv);
                }
                if !pos.make_move(mv) {
                    // An illegal line is a bug in the table above; drop the
                    // rest of it rather than corrupting the book.
                    break;
                }
            }
        }
        Book { entries }
    }

    /// Book moves available in `pos`, if any.
    pub fn lookup(&self, pos: &Position) -> Option<&[Move]> {
        self.entries.get(&pos.key).map(|v| v.as_slice())
    }

    /// Pick one book move, using `seed` to vary the choice between games.
    pub fn pick(&self, pos: &Position, seed: u64) -> Option<Move> {
        let moves = self.lookup(pos)?;
        if moves.is_empty() {
            return None;
        }
        Some(moves[(seed % moves.len() as u64) as usize])
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::move_to_iccs;

    /// The book's own correctness gate: every move in every line must be legal
    /// at the point it is played.
    #[test]
    fn every_book_line_is_legal() {
        for (name, line) in LINES {
            let mut pos = Position::new();
            for (i, token) in line.iter().enumerate() {
                let mv = iccs_to_move(token)
                    .unwrap_or_else(|| panic!("{name}: move {i} '{token}' is not valid ICCS"));
                let legal = pos.legal_moves();
                assert!(
                    legal.contains(&mv),
                    "{name}: move {i} '{token}' is illegal in {}",
                    pos.to_fen()
                );
                assert!(pos.make_move(mv));
            }
        }
    }

    #[test]
    fn book_offers_several_first_moves() {
        let book = Book::new();
        let pos = Position::new();
        let moves = book.lookup(&pos).expect("start position must be in book");
        assert!(
            moves.len() >= 5,
            "want a varied opening repertoire, got {}",
            moves.len()
        );
        // Every suggestion must be a legal first move.
        let mut p = Position::new();
        let legal = p.legal_moves();
        for m in moves {
            assert!(
                legal.contains(m),
                "book suggests illegal {}",
                move_to_iccs(*m)
            );
        }
    }

    #[test]
    fn pick_varies_with_the_seed() {
        let book = Book::new();
        let pos = Position::new();
        let picks: std::collections::HashSet<Move> =
            (0..16).filter_map(|s| book.pick(&pos, s)).collect();
        assert!(picks.len() > 1, "the book should not always play one move");
    }

    #[test]
    fn unknown_positions_are_not_in_the_book() {
        let book = Book::new();
        let pos = Position::from_fen("3k5/9/9/9/9/9/9/9/9/4K1R2 w - - 0 1").unwrap();
        assert!(book.lookup(&pos).is_none());
    }
}
