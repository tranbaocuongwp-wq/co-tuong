//! Traditional Vietnamese move notation ("Pháo 2 bình 5").
//!
//! Coordinate notation is what the engine stores; this is what a player reads.
//! The two conventions differ in an easy-to-miss way: files are numbered from
//! *each player's own right*, so Red's file 1 and Black's file 1 sit on opposite
//! edges of the board, and "tiến" means opposite directions for the two sides.

use crate::board::Position;
use crate::types::*;

fn piece_name(kind: u8) -> &'static str {
    match kind {
        KING => "Tướng",
        ADVISOR => "Sĩ",
        ELEPHANT => "Tượng",
        HORSE => "Mã",
        ROOK => "Xe",
        CANNON => "Pháo",
        _ => "Tốt",
    }
}

/// File number as the given side counts it: 1..=9 starting from that side's
/// own right-hand edge.
fn file_number(s: usize, side: u8) -> usize {
    if side == RED {
        9 - disp_col(s)
    } else {
        disp_col(s) + 1
    }
}

/// True when the piece moves toward the enemy.
fn is_advance(from: usize, to: usize, side: u8) -> bool {
    if side == RED {
        disp_row(to) < disp_row(from)
    } else {
        disp_row(to) > disp_row(from)
    }
}

/// Horses, advisors and elephants move diagonally, so "advance 2" would be
/// ambiguous; for them the trailing number is the destination file instead of a
/// distance.
fn uses_destination_file(kind: u8) -> bool {
    matches!(kind, HORSE | ADVISOR | ELEPHANT)
}

/// Render `mv` in Vietnamese notation. `pos` must be the position *before* the
/// move is played.
pub fn move_to_vietnamese(pos: &Position, mv: Move) -> String {
    let from = mv_from(mv);
    let to = mv_to(mv);
    let pc = pos.board[from];
    if pc == EMPTY {
        return move_to_iccs(mv);
    }
    let side = side_of(pc);
    let kind = kind_of(pc);
    let name = piece_name(kind);

    // Two like pieces stacked on one file are distinguished by which is nearer
    // the enemy rather than by file number.
    let subject = match stacked_partner(pos, from, pc) {
        Some(other) => {
            let we_are_front = if side == RED {
                disp_row(from) < disp_row(other)
            } else {
                disp_row(from) > disp_row(other)
            };
            format!("{} {}", name, if we_are_front { "trước" } else { "sau" })
        }
        None => format!("{} {}", name, file_number(from, side)),
    };

    if disp_row(from) == disp_row(to) {
        return format!("{} bình {}", subject, file_number(to, side));
    }

    let action = if is_advance(from, to, side) {
        "tiến"
    } else {
        "thoái"
    };
    let amount = if uses_destination_file(kind) {
        file_number(to, side)
    } else {
        disp_row(from).abs_diff(disp_row(to))
    };
    format!("{} {} {}", subject, action, amount)
}

/// Another piece of the same type and colour sharing this file, if exactly one
/// exists. Returns `None` for 0 or 2+ partners, where "trước/sau" would itself
/// be ambiguous and file numbering reads better.
fn stacked_partner(pos: &Position, from: usize, pc: u8) -> Option<usize> {
    let col = disp_col(from);
    let mut found = None;
    for r in 0..10 {
        let s = sq(r, col);
        if s != from && pos.board[s] == pc {
            if found.is_some() {
                return None;
            }
            found = Some(s);
        }
    }
    found
}

/// Render a whole game, pairing Red and Black moves as they would be written on
/// a score sheet.
pub fn game_to_vietnamese(start_fen: &str, moves: &[Move]) -> Result<Vec<String>, String> {
    let mut pos = Position::from_fen(start_fen)?;
    let mut out = Vec::with_capacity(moves.len());
    for (i, &mv) in moves.iter().enumerate() {
        out.push(move_to_vietnamese(&pos, mv));
        if !pos.make_move_checked(mv) {
            return Err(format!("move {i} does not replay legally"));
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::START_FEN;

    fn say(fen: &str, iccs: &str) -> String {
        let pos = Position::from_fen(fen).unwrap();
        move_to_vietnamese(&pos, iccs_to_move(iccs).unwrap())
    }

    #[test]
    fn the_classic_centre_cannon() {
        // Red's right-hand cannon sits on Red's file 2 and slides to file 5.
        assert_eq!(say(START_FEN, "h2e2"), "Pháo 2 bình 5");
        // The left-hand cannon is Red's file 8.
        assert_eq!(say(START_FEN, "b2e2"), "Pháo 8 bình 5");
    }

    #[test]
    fn black_counts_files_from_its_own_right() {
        // Black's h-file cannon is Black's file 2 — the mirror of Red's.
        let after_red = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1";
        assert_eq!(say(after_red, "h7e7"), "Pháo 8 bình 5");
        assert_eq!(say(after_red, "b7e7"), "Pháo 2 bình 5");
    }

    #[test]
    fn straight_movers_report_distance_but_horses_report_a_file() {
        // A rook advancing two ranks says "tiến 2".
        assert_eq!(
            say("3k5/9/9/9/9/9/9/9/9/R3K4 w - - 0 1", "a0a2"),
            "Xe 9 tiến 2"
        );
        // A horse says which file it lands on, since a diagonal distance would
        // be ambiguous.
        assert_eq!(say(START_FEN, "b0c2"), "Mã 8 tiến 7");
        assert_eq!(say(START_FEN, "h0g2"), "Mã 2 tiến 3");
    }

    #[test]
    fn advance_and_retreat_are_relative_to_each_side() {
        // Red advances toward the top of the board.
        assert_eq!(
            say("3k5/9/9/9/9/9/9/9/R8/4K4 w - - 0 1", "a1a3"),
            "Xe 9 tiến 2"
        );
        assert_eq!(
            say("3k5/9/9/9/9/9/9/9/R8/4K4 w - - 0 1", "a1a0"),
            "Xe 9 thoái 1"
        );
        // Black advances toward the bottom, so the same geometry inverts. Note
        // the file number flips too: the a-file is Red's 9 but Black's 1.
        assert_eq!(
            say("3k5/r8/9/9/9/9/9/9/9/4K4 b - - 0 1", "a8a6"),
            "Xe 1 tiến 2"
        );
        assert_eq!(
            say("3k5/r8/9/9/9/9/9/9/9/4K4 b - - 0 1", "a8a9"),
            "Xe 1 thoái 1"
        );
    }

    #[test]
    fn stacked_pieces_use_front_and_rear() {
        // Two red rooks on the same file: the advanced one is "trước".
        let fen = "3k5/9/9/9/9/9/R8/9/R8/4K4 w - - 0 1";
        assert_eq!(say(fen, "a3a4"), "Xe trước tiến 1");
        assert_eq!(say(fen, "a1a2"), "Xe sau tiến 1");

        // For Black, "trước" is the one nearer Red — the opposite row order.
        let fen = "3k5/9/r8/9/r8/9/9/9/9/4K4 b - - 0 1";
        assert_eq!(say(fen, "a5a4"), "Xe trước tiến 1");
        assert_eq!(say(fen, "a7a6"), "Xe sau tiến 1");
    }

    #[test]
    fn a_whole_game_renders() {
        let moves: Vec<Move> = ["h2e2", "h9g7", "h0g2"]
            .iter()
            .map(|s| iccs_to_move(s).unwrap())
            .collect();
        let text = game_to_vietnamese(START_FEN, &moves).unwrap();
        // Red's h-horse is Red's file 2; Black's h-horse is Black's file 8.
        // The two sides genuinely name the same file differently.
        assert_eq!(text, vec!["Pháo 2 bình 5", "Mã 8 tiến 7", "Mã 2 tiến 3"]);
    }

    #[test]
    fn an_illegal_game_is_reported() {
        let moves = vec![iccs_to_move("a0a9").unwrap()];
        assert!(game_to_vietnamese(START_FEN, &moves).is_err());
    }
}
