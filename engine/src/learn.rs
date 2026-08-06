//! Experience book — the engine's memory of games it has already played.
//!
//! After each finished game the mover's choices are graded by the result and
//! stored per position. On later moves the engine consults that record and, at
//! the root only, prefers a move it has done well with over one it has been
//! punished for.
//!
//! Two deliberate limits keep this from making the engine *worse*, which is the
//! usual failure mode of self-learning books:
//!
//! * The bias is capped ([`MAX_BIAS`]) and scaled by how many games back it, so
//!   a single unlucky loss cannot condemn a good move.
//! * It is applied only among root moves already within a small score margin of
//!   the best. Search still decides what is playable; experience only breaks
//!   ties. The engine will never play a materially worse move because of it.
//!
//! The crate does no I/O, so persistence is the host's job: [`Experience::
//! serialize`] and [`Experience::parse`] move the table through the app's normal
//! storage layer (SQLite in the desktop build, IndexedDB on the web).

use std::collections::HashMap;

use crate::board::Position;
use crate::types::{Move, RED};

/// Largest centipawn adjustment any single record may contribute.
pub const MAX_BIAS: i32 = 60;

/// Root moves within this many centipawns of the best are considered
/// interchangeable, and experience is allowed to choose between them.
pub const TIE_MARGIN: i32 = 30;

/// Games needed before a record carries its full weight.
const CONFIDENCE_GAMES: i32 = 4;

const FORMAT_TAG: &str = "xqexp1";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MoveRecord {
    pub mv: Move,
    /// Sum of results from the mover's point of view: +1 win, -1 loss, 0 draw.
    pub score: i32,
    pub games: u32,
}

/// Outcome of a game from one side's point of view.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Win,
    Loss,
    Draw,
}

impl Outcome {
    fn value(self) -> i32 {
        match self {
            Outcome::Win => 1,
            Outcome::Loss => -1,
            Outcome::Draw => 0,
        }
    }
}

#[derive(Clone, Default)]
pub struct Experience {
    entries: HashMap<u64, Vec<MoveRecord>>,
}

impl Experience {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Total number of stored move records across all positions.
    pub fn record_count(&self) -> usize {
        self.entries.values().map(|v| v.len()).sum()
    }

    fn update(&mut self, key: u64, mv: Move, delta: i32) {
        let slot = self.entries.entry(key).or_default();
        match slot.iter_mut().find(|r| r.mv == mv) {
            Some(r) => {
                r.score += delta;
                r.games += 1;
            }
            None => slot.push(MoveRecord {
                mv,
                score: delta,
                games: 1,
            }),
        }
    }

    /// Grade one finished game.
    ///
    /// `moves` is the full move list from `start_fen`; `learner` is the side
    /// whose decisions we are learning from (normally the engine's side), and
    /// `outcome` is that side's result. Moves by the opponent are skipped —
    /// learning from the human's choices would teach the engine to imitate them
    /// rather than to beat them.
    ///
    /// Returns the number of records touched, or an error if the game does not
    /// replay legally.
    pub fn learn_game(
        &mut self,
        start_fen: &str,
        moves: &[Move],
        learner: u8,
        outcome: Outcome,
    ) -> Result<usize, String> {
        let delta = outcome.value();
        if delta == 0 {
            // Draws carry no signal but must still be replayable; nothing to store.
            return Ok(0);
        }
        let mut pos = Position::from_fen(start_fen)?;
        // Staged, then committed only if the whole game replays. A game that
        // fails halfway must teach nothing at all, or a truncated save would
        // leave the engine with a half-learned, unbalanced record.
        let mut pending: Vec<(u64, Move)> = Vec::with_capacity(moves.len());

        for (i, &mv) in moves.iter().enumerate() {
            let mover = pos.side;
            let key_before = pos.key;
            // This replays data loaded from storage, which may be corrupt or
            // hand-edited, so every move is validated rather than trusted.
            if !pos.make_move_checked(mv) {
                return Err(format!("move {i} does not replay legally"));
            }
            if mover == learner {
                // Key the record by the position *before* the move, which is
                // what the engine looks up next time it faces it.
                pending.push((key_before, mv));
            }
        }

        let touched = pending.len();
        for (key, mv) in pending {
            self.update(key, mv, delta);
        }
        Ok(touched)
    }

    /// Records stored for a position, if any.
    pub fn lookup(&self, key: u64) -> Option<&[MoveRecord]> {
        self.entries.get(&key).map(|v| v.as_slice())
    }

    /// Centipawn adjustment for playing `mv` in the position keyed by `key`.
    ///
    /// Positive means "this has worked before". The value is damped until the
    /// record is backed by several games.
    pub fn bias(&self, key: u64, mv: Move) -> i32 {
        let Some(records) = self.entries.get(&key) else {
            return 0;
        };
        let Some(r) = records.iter().find(|r| r.mv == mv) else {
            return 0;
        };
        let confidence = (r.games as i32).min(CONFIDENCE_GAMES);
        let raw = r.score * 20 * confidence / CONFIDENCE_GAMES;
        raw.clamp(-MAX_BIAS, MAX_BIAS)
    }

    // -- persistence ---------------------------------------------------------

    /// Serialize to a compact line-oriented text form.
    ///
    /// Deliberately hand-rolled rather than JSON: the engine crate stays free of
    /// dependencies so it keeps compiling to WebAssembly unchanged.
    pub fn serialize(&self) -> String {
        let mut out = String::from(FORMAT_TAG);
        out.push('\n');
        // Sort so the output is stable and diffable between saves.
        let mut keys: Vec<&u64> = self.entries.keys().collect();
        keys.sort();
        for key in keys {
            let mut records = self.entries[key].clone();
            records.sort_by_key(|r| r.mv);
            for r in records {
                out.push_str(&format!("{:x} {} {} {}\n", key, r.mv, r.score, r.games));
            }
        }
        out
    }

    /// Parse the format produced by [`Experience::serialize`].
    ///
    /// Unreadable lines are skipped rather than fatal: a corrupted or truncated
    /// save should cost the engine its memory, not prevent it from playing.
    pub fn parse(text: &str) -> Self {
        let mut exp = Experience::new();
        let mut lines = text.lines();
        match lines.next() {
            Some(tag) if tag.trim() == FORMAT_TAG => {}
            _ => return exp,
        }
        for line in lines {
            let mut parts = line.split_whitespace();
            let (Some(k), Some(m), Some(s), Some(g)) =
                (parts.next(), parts.next(), parts.next(), parts.next())
            else {
                continue;
            };
            let (Ok(key), Ok(mv), Ok(score), Ok(games)) = (
                u64::from_str_radix(k, 16),
                m.parse::<Move>(),
                s.parse::<i32>(),
                g.parse::<u32>(),
            ) else {
                continue;
            };
            exp.entries
                .entry(key)
                .or_default()
                .push(MoveRecord { mv, score, games });
        }
        exp
    }

    /// Merge another table into this one, summing records.
    pub fn merge(&mut self, other: &Experience) {
        for (key, records) in &other.entries {
            for r in records {
                let slot = self.entries.entry(*key).or_default();
                match slot.iter_mut().find(|x| x.mv == r.mv) {
                    Some(x) => {
                        x.score += r.score;
                        x.games += r.games;
                    }
                    None => slot.push(*r),
                }
            }
        }
    }

    /// Drop records backed by a single game, to keep a long-lived table small.
    pub fn prune(&mut self, min_games: u32) {
        self.entries.retain(|_, records| {
            records.retain(|r| r.games >= min_games);
            !records.is_empty()
        });
    }
}

/// Side identifier helper for callers that think in "red / black" strings.
pub fn side_from_str(s: &str) -> u8 {
    if s.eq_ignore_ascii_case("black") || s.eq_ignore_ascii_case("b") {
        1
    } else {
        RED
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::START_FEN;
    use crate::types::iccs_to_move;

    fn line(tokens: &[&str]) -> Vec<Move> {
        tokens.iter().map(|t| iccs_to_move(t).unwrap()).collect()
    }

    #[test]
    fn losing_moves_are_penalised_and_winning_moves_rewarded() {
        let moves = line(&["h2e2", "h9g7", "h0g2"]);
        let start = Position::new();

        let mut exp = Experience::new();
        exp.learn_game(START_FEN, &moves, RED, Outcome::Loss)
            .unwrap();
        let first = iccs_to_move("h2e2").unwrap();
        assert!(
            exp.bias(start.key, first) < 0,
            "a move from a lost game must be discouraged"
        );

        let mut exp = Experience::new();
        exp.learn_game(START_FEN, &moves, RED, Outcome::Win)
            .unwrap();
        assert!(exp.bias(start.key, first) > 0);
    }

    #[test]
    fn only_the_learner_side_is_recorded() {
        let moves = line(&["h2e2", "h9g7", "h0g2"]);
        let mut exp = Experience::new();
        let touched = exp
            .learn_game(START_FEN, &moves, RED, Outcome::Loss)
            .unwrap();
        // Red played moves 0 and 2; Black's reply must not be recorded.
        assert_eq!(touched, 2);
        assert_eq!(exp.record_count(), 2);
    }

    #[test]
    fn bias_is_capped_and_grows_with_confidence() {
        let moves = line(&["h2e2"]);
        let start = Position::new();
        let mv = iccs_to_move("h2e2").unwrap();

        let mut exp = Experience::new();
        exp.learn_game(START_FEN, &moves, RED, Outcome::Loss)
            .unwrap();
        let after_one = exp.bias(start.key, mv);

        for _ in 0..3 {
            exp.learn_game(START_FEN, &moves, RED, Outcome::Loss)
                .unwrap();
        }
        let after_four = exp.bias(start.key, mv);
        assert!(
            after_four < after_one,
            "repeated losses should weigh more heavily"
        );

        // No amount of evidence may exceed the cap.
        for _ in 0..200 {
            exp.learn_game(START_FEN, &moves, RED, Outcome::Loss)
                .unwrap();
        }
        assert_eq!(exp.bias(start.key, mv), -MAX_BIAS);
    }

    #[test]
    fn draws_teach_nothing() {
        let moves = line(&["h2e2", "h9g7"]);
        let mut exp = Experience::new();
        assert_eq!(
            exp.learn_game(START_FEN, &moves, RED, Outcome::Draw)
                .unwrap(),
            0
        );
        assert!(exp.is_empty());
    }

    #[test]
    fn an_illegal_replay_is_reported_not_silently_learned() {
        let mut exp = Experience::new();

        // Wrong side: after h2e2 it is Black's turn, so a Red rook move must be
        // rejected rather than quietly applied.
        let wrong_side = vec![iccs_to_move("h2e2").unwrap(), iccs_to_move("a0a9").unwrap()];
        assert!(exp
            .learn_game(START_FEN, &wrong_side, RED, Outcome::Loss)
            .is_err());

        // Geometrically impossible move for the piece standing there.
        let nonsense = vec![iccs_to_move("a0e5").unwrap()];
        assert!(exp
            .learn_game(START_FEN, &nonsense, RED, Outcome::Loss)
            .is_err());

        // Moving from an empty square.
        let empty_from = vec![iccs_to_move("e5e6").unwrap()];
        assert!(exp
            .learn_game(START_FEN, &empty_from, RED, Outcome::Loss)
            .is_err());

        assert!(exp.is_empty(), "nothing may be learned from a bad replay");
    }

    #[test]
    fn serialization_round_trips() {
        let moves = line(&["h2e2", "h9g7", "h0g2"]);
        let mut exp = Experience::new();
        exp.learn_game(START_FEN, &moves, RED, Outcome::Loss)
            .unwrap();
        exp.learn_game(START_FEN, &moves, RED, Outcome::Win)
            .unwrap();

        let text = exp.serialize();
        let back = Experience::parse(&text);
        assert_eq!(back.len(), exp.len());
        assert_eq!(back.record_count(), exp.record_count());

        let start = Position::new();
        let mv = iccs_to_move("h2e2").unwrap();
        assert_eq!(back.bias(start.key, mv), exp.bias(start.key, mv));
    }

    #[test]
    fn corrupt_input_degrades_gracefully() {
        assert!(Experience::parse("").is_empty());
        assert!(Experience::parse("not-our-format\ngarbage").is_empty());
        // A valid header with junk rows yields an empty but usable table.
        let exp = Experience::parse("xqexp1\nzz not a record\n123 456\n");
        assert!(exp.is_empty());
    }

    #[test]
    fn prune_drops_one_off_records() {
        let moves = line(&["h2e2"]);
        let mut exp = Experience::new();
        exp.learn_game(START_FEN, &moves, RED, Outcome::Loss)
            .unwrap();
        assert_eq!(exp.record_count(), 1);
        exp.prune(2);
        assert_eq!(exp.record_count(), 0);
    }

    #[test]
    fn merge_sums_two_tables() {
        let moves = line(&["h2e2"]);
        let mut a = Experience::new();
        a.learn_game(START_FEN, &moves, RED, Outcome::Loss).unwrap();
        let mut b = Experience::new();
        b.learn_game(START_FEN, &moves, RED, Outcome::Loss).unwrap();
        a.merge(&b);
        let start = Position::new();
        let recs = a.lookup(start.key).unwrap();
        assert_eq!(recs.len(), 1);
        assert_eq!(recs[0].games, 2);
        assert_eq!(recs[0].score, -2);
    }
}
