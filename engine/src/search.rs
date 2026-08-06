//! Alpha-beta search.
//!
//! Principal-variation search with a transposition table, killer/history move
//! ordering, null-move pruning, late move reductions and a capture-only
//! quiescence pass. Depth is what makes an engine strong, so everything here is
//! in service of searching further rather than judging each leaf more finely.
//!
//! The crate stays free of `std::time` so it can compile to
//! `wasm32-unknown-unknown`: the host injects a clock as a plain function
//! pointer ([`NowFn`]).

use crate::board::{Position, RepKind};
use crate::book::Book;
use crate::eval::{evaluate, INFINITY, MATE_BOUND, MATE_VALUE, PIECE_VALUE};
use crate::learn::{Experience, TIE_MARGIN};
use crate::movegen::MoveList;
use crate::types::*;

pub const MAX_PLY: usize = 64;

/// Optional knowledge sources consulted at the root.
///
/// Both are advisory and neither can override the search by more than a tie
/// margin, so a stale book or a misleading experience record cannot make the
/// engine play something plainly bad.
#[derive(Default)]
pub struct SearchContext<'a> {
    pub book: Option<&'a Book>,
    pub experience: Option<&'a Experience>,
}

/// Milliseconds since an arbitrary fixed epoch. Supplied by the host so the
/// engine itself needs no platform clock.
pub type NowFn = fn() -> u64;

#[derive(Clone, Copy, Debug)]
pub struct SearchLimits {
    /// Hard depth ceiling.
    pub max_depth: u32,
    /// Wall-clock budget in milliseconds; 0 means depth-limited only.
    pub movetime_ms: u64,
    /// Centipawns of noise added to root moves, used to make the easier levels
    /// human-like instead of merely shallow.
    pub randomness_cp: i32,
    /// Seed for that noise, so a given game is reproducible when replayed.
    pub seed: u64,
}

impl Default for SearchLimits {
    fn default() -> Self {
        SearchLimits {
            max_depth: 64,
            movetime_ms: 3_000,
            randomness_cp: 0,
            seed: 0x1234_5678,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct SearchResult {
    pub best_move: Move,
    pub score: i32,
    pub depth: u32,
    pub nodes: u64,
    pub time_ms: u64,
    pub pv: Vec<Move>,
    /// True when the search stopped on the clock rather than on depth.
    pub stopped_early: bool,
    /// The move came straight from the opening book; no search was run.
    pub from_book: bool,
    /// The experience book overrode the search's first choice among moves it
    /// judged equivalent.
    pub from_experience: bool,
}

const TT_EXACT: u8 = 1;
const TT_LOWER: u8 = 2; // fail-high: the true score is >= `score`
const TT_UPPER: u8 = 3; // fail-low: the true score is <= `score`

#[derive(Clone, Copy, Default)]
struct TtEntry {
    key: u64,
    mv: Move,
    score: i16,
    depth: i8,
    flag: u8,
}

/// Progress callback, invoked once per completed iteration so a UI can show the
/// current depth, score and principal variation while thinking.
pub type InfoFn<'a> = &'a mut dyn FnMut(&SearchResult);

pub struct Searcher {
    tt: Vec<TtEntry>,
    tt_mask: usize,
    killers: [[Move; 2]; MAX_PLY],
    /// History heuristic indexed by moving piece and destination.
    history: [[i32; BOARD_LEN]; 16],
    pv: [[Move; MAX_PLY]; MAX_PLY],
    pv_len: [usize; MAX_PLY],
    nodes: u64,
    stop: bool,
    deadline: u64,
    now: NowFn,
    rng: u64,
}

impl Searcher {
    /// `tt_mb` is the transposition-table budget in megabytes; it is rounded
    /// down to a power-of-two entry count.
    pub fn new(tt_mb: usize, now: NowFn) -> Self {
        let entry_size = core::mem::size_of::<TtEntry>();
        let wanted = (tt_mb.max(1) * 1024 * 1024) / entry_size;
        let entries = wanted.next_power_of_two() / 2;
        let entries = entries.max(1024);
        Searcher {
            tt: vec![TtEntry::default(); entries],
            tt_mask: entries - 1,
            killers: [[NULL_MOVE; 2]; MAX_PLY],
            history: [[0; BOARD_LEN]; 16],
            pv: [[NULL_MOVE; MAX_PLY]; MAX_PLY],
            pv_len: [0; MAX_PLY],
            nodes: 0,
            stop: false,
            deadline: 0,
            now,
            rng: 0x2545_F491_4F6C_DD1D,
        }
    }

    pub fn clear(&mut self) {
        self.tt.iter_mut().for_each(|e| *e = TtEntry::default());
        self.killers = [[NULL_MOVE; 2]; MAX_PLY];
        self.history = [[0; BOARD_LEN]; 16];
    }

    fn rand(&mut self) -> u64 {
        // xorshift64*, plenty for jittering root scores.
        self.rng ^= self.rng >> 12;
        self.rng ^= self.rng << 25;
        self.rng ^= self.rng >> 27;
        self.rng.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }

    // -- transposition table -------------------------------------------------

    #[inline]
    fn tt_probe(&self, key: u64) -> Option<TtEntry> {
        let e = self.tt[(key as usize) & self.tt_mask];
        if e.flag != 0 && e.key == key {
            Some(e)
        } else {
            None
        }
    }

    fn tt_store(&mut self, key: u64, mv: Move, score: i32, depth: i32, flag: u8, ply: usize) {
        let idx = (key as usize) & self.tt_mask;
        let existing = self.tt[idx];
        // Replace shallower entries, and always replace a different position.
        if existing.flag != 0 && existing.key == key && existing.depth > depth as i8 {
            return;
        }
        // Mate scores are stored relative to the current node, not the root,
        // so the same entry stays valid at any distance from the root.
        let stored = if score >= MATE_BOUND {
            score + ply as i32
        } else if score <= -MATE_BOUND {
            score - ply as i32
        } else {
            score
        };
        self.tt[idx] = TtEntry {
            key,
            mv,
            score: stored.clamp(-32_000, 32_000) as i16,
            depth: depth as i8,
            flag,
        };
    }

    #[inline]
    fn tt_score(score: i32, ply: usize) -> i32 {
        if score >= MATE_BOUND {
            score - ply as i32
        } else if score <= -MATE_BOUND {
            score + ply as i32
        } else {
            score
        }
    }

    // -- time ---------------------------------------------------------------

    #[inline]
    fn check_time(&mut self) {
        if self.deadline != 0 && (self.now)() >= self.deadline {
            self.stop = true;
        }
    }

    // -- move ordering -------------------------------------------------------

    /// Score a move for ordering. Good moves must come first or the alpha-beta
    /// window never narrows and the search degenerates toward plain minimax.
    fn score_move(&self, pos: &Position, m: Move, tt_move: Move, ply: usize) -> i32 {
        if m == tt_move {
            return 2_000_000;
        }
        let victim = pos.board[mv_to(m)];
        if victim != EMPTY {
            // MVV-LVA: take the most valuable victim with the least valuable
            // attacker.
            let attacker = pos.board[mv_from(m)];
            return 1_000_000 + PIECE_VALUE[kind_of(victim) as usize] * 16
                - PIECE_VALUE[kind_of(attacker) as usize];
        }
        if ply < MAX_PLY {
            if m == self.killers[ply][0] {
                return 900_000;
            }
            if m == self.killers[ply][1] {
                return 800_000;
            }
        }
        let pc = pos.board[mv_from(m)];
        self.history[pc as usize][mv_to(m)]
    }

    /// Move the best-scoring remaining move into slot `i` (selection sort).
    /// Cheaper than a full sort because most nodes cut off after a few moves.
    fn pick_move(moves: &mut [Move], scores: &mut [i32], i: usize) {
        let mut best = i;
        for j in i + 1..moves.len() {
            if scores[j] > scores[best] {
                best = j;
            }
        }
        moves.swap(i, best);
        scores.swap(i, best);
    }

    // -- quiescence ----------------------------------------------------------

    /// Search only captures (plus full evasions when in check) until the
    /// position is quiet. Without this the engine "sees" a winning capture at
    /// the last ply and never notices the recapture.
    fn qsearch(&mut self, pos: &mut Position, mut alpha: i32, beta: i32) -> i32 {
        self.nodes += 1;
        if self.nodes & 2047 == 0 {
            self.check_time();
        }
        if self.stop {
            return 0;
        }
        let ply = pos.ply;
        if ply >= MAX_PLY - 1 {
            return evaluate(pos);
        }

        let in_check = pos.in_check();
        if !in_check {
            let stand_pat = evaluate(pos);
            if stand_pat >= beta {
                return stand_pat;
            }
            if stand_pat > alpha {
                alpha = stand_pat;
            }
        }

        let mut list = MoveList::new();
        // When in check we must consider every escape, not just captures.
        pos.generate(&mut list, !in_check);
        let mut moves = list.moves;
        let n = list.len;
        let mut scores = [0i32; crate::movegen::MAX_MOVES];
        for i in 0..n {
            scores[i] = self.score_move(pos, moves[i], NULL_MOVE, ply);
        }

        let mut best = if in_check { -INFINITY } else { alpha };
        let mut any_legal = false;
        for i in 0..n {
            Self::pick_move(&mut moves[..n], &mut scores[..n], i);
            let m = moves[i];
            if !pos.make_move(m) {
                continue;
            }
            any_legal = true;
            let score = -self.qsearch(pos, -beta, -alpha);
            pos.undo_move();
            if self.stop {
                return 0;
            }
            if score > best {
                best = score;
            }
            if score > alpha {
                alpha = score;
            }
            if alpha >= beta {
                break;
            }
        }

        if in_check && !any_legal {
            // No escape: in Xiangqi having no legal move loses, full stop.
            return -MATE_VALUE + ply as i32;
        }
        best
    }

    // -- main search ---------------------------------------------------------

    #[allow(clippy::too_many_arguments)]
    fn negamax(
        &mut self,
        pos: &mut Position,
        mut depth: i32,
        mut alpha: i32,
        beta: i32,
        is_pv: bool,
        allow_null: bool,
    ) -> i32 {
        let ply = pos.ply;
        self.pv_len[ply.min(MAX_PLY - 1)] = 0;

        if depth <= 0 {
            return self.qsearch(pos, alpha, beta);
        }

        self.nodes += 1;
        if self.nodes & 2047 == 0 {
            self.check_time();
        }
        if self.stop {
            return 0;
        }
        if ply >= MAX_PLY - 1 {
            return evaluate(pos);
        }

        // Repetition and the 60-move rule. Xiangqi scores perpetual checking
        // against the checker rather than calling it a draw.
        if ply > 0 {
            if let Some(kind) = pos.repetition() {
                return match kind {
                    RepKind::Draw => 0,
                    RepKind::WeLose => -MATE_VALUE + ply as i32,
                    RepKind::WeWin => MATE_VALUE - ply as i32,
                };
            }
            if pos.is_draw_by_halfmove() || pos.is_material_draw() {
                return 0;
            }
            // Mate-distance pruning: a faster mate already found elsewhere
            // makes this subtree irrelevant.
            let mate_alpha = alpha.max(-MATE_VALUE + ply as i32);
            let mate_beta = beta.min(MATE_VALUE - ply as i32 - 1);
            if mate_alpha >= mate_beta {
                return mate_alpha;
            }
        }

        let in_check = pos.in_check();
        // Extend when in check: forcing lines deserve a deeper look and this
        // also keeps the horizon from cutting a mating attack in half.
        if in_check {
            depth += 1;
        }

        let mut tt_move = NULL_MOVE;
        if let Some(e) = self.tt_probe(pos.key) {
            tt_move = e.mv;
            if !is_pv && e.depth as i32 >= depth {
                let s = Self::tt_score(e.score as i32, ply);
                match e.flag {
                    TT_EXACT => return s,
                    TT_LOWER if s >= beta => return s,
                    TT_UPPER if s <= alpha => return s,
                    _ => {}
                }
            }
        }

        let eval = evaluate(pos);

        // Null-move pruning: give the opponent a free move; if we are still
        // winning, this node is almost certainly a cutoff. Disabled in check
        // and when only kings and guards remain, where zugzwang-like positions
        // make the assumption unsafe.
        if allow_null
            && !is_pv
            && !in_check
            && depth >= 3
            && eval >= beta
            && Self::has_heavy_material(pos, pos.side)
        {
            let r = 2 + (depth / 4);
            pos.make_null_move();
            let score = -self.negamax(pos, depth - r - 1, -beta, -beta + 1, false, false);
            pos.undo_null_move();
            if self.stop {
                return 0;
            }
            if score >= beta && score < MATE_BOUND {
                return score;
            }
        }

        let mut list = MoveList::new();
        pos.generate(&mut list, false);
        let n = list.len;
        let mut moves = list.moves;
        let mut scores = [0i32; crate::movegen::MAX_MOVES];
        for i in 0..n {
            scores[i] = self.score_move(pos, moves[i], tt_move, ply);
        }

        let mut best_score = -INFINITY;
        let mut best_move = NULL_MOVE;
        let mut legal = 0u32;
        let alpha_orig = alpha;

        for i in 0..n {
            Self::pick_move(&mut moves[..n], &mut scores[..n], i);
            let m = moves[i];
            let is_capture = pos.board[mv_to(m)] != EMPTY;
            if !pos.make_move(m) {
                continue;
            }
            legal += 1;

            let mut score;
            if legal == 1 {
                // Principal variation: search the first move with a full window.
                score = -self.negamax(pos, depth - 1, -beta, -alpha, is_pv, true);
            } else {
                // Late move reductions: quiet moves ordered late are unlikely
                // to be best, so look at them shallowly first and only re-search
                // if one surprises us.
                let mut reduction = 0;
                if depth >= 3 && legal > 3 && !is_capture && !in_check {
                    reduction = 1 + (depth >= 6 && legal > 8) as i32;
                }
                score = -self.negamax(pos, depth - 1 - reduction, -alpha - 1, -alpha, false, true);
                if score > alpha && reduction > 0 {
                    score = -self.negamax(pos, depth - 1, -alpha - 1, -alpha, false, true);
                }
                if score > alpha && score < beta {
                    score = -self.negamax(pos, depth - 1, -beta, -alpha, is_pv, true);
                }
            }
            pos.undo_move();
            if self.stop {
                return 0;
            }

            if score > best_score {
                best_score = score;
                best_move = m;
                if score > alpha {
                    alpha = score;
                    self.update_pv(ply, m);
                }
                if alpha >= beta {
                    if !is_capture && ply < MAX_PLY {
                        // Killers and history only ever record quiet moves;
                        // captures are already ordered well by MVV-LVA.
                        if self.killers[ply][0] != m {
                            self.killers[ply][1] = self.killers[ply][0];
                            self.killers[ply][0] = m;
                        }
                        let pc = pos.board[mv_from(m)];
                        self.history[pc as usize][mv_to(m)] += depth * depth;
                    }
                    break;
                }
            }
        }

        if legal == 0 {
            // Xiangqi has no stalemate draw: a side with no legal move loses.
            return -MATE_VALUE + ply as i32;
        }

        let flag = if best_score >= beta {
            TT_LOWER
        } else if best_score > alpha_orig {
            TT_EXACT
        } else {
            TT_UPPER
        };
        self.tt_store(pos.key, best_move, best_score, depth, flag, ply);
        best_score
    }

    /// True when `side` still has a rook, cannon or horse — the material that
    /// makes null-move pruning safe.
    fn has_heavy_material(pos: &Position, side: u8) -> bool {
        let c = &pos.counts[side as usize];
        c[ROOK as usize] + c[CANNON as usize] + c[HORSE as usize] > 0
    }

    fn update_pv(&mut self, ply: usize, m: Move) {
        if ply >= MAX_PLY - 1 {
            return;
        }
        self.pv[ply][0] = m;
        let child_len = self.pv_len[ply + 1];
        for i in 0..child_len {
            if i + 1 >= MAX_PLY {
                break;
            }
            self.pv[ply][i + 1] = self.pv[ply + 1][i];
        }
        self.pv_len[ply] = (child_len + 1).min(MAX_PLY);
    }

    fn extract_pv(&self) -> Vec<Move> {
        self.pv[0][..self.pv_len[0]].to_vec()
    }

    // -- driver --------------------------------------------------------------

    /// Search `pos` under `limits` with no book and no experience.
    pub fn search(
        &mut self,
        pos: &mut Position,
        limits: SearchLimits,
        on_info: Option<InfoFn>,
    ) -> SearchResult {
        self.search_with(pos, limits, &SearchContext::default(), on_info)
    }

    /// Search `pos` under `limits`, consulting `ctx` at the root and reporting
    /// each completed iteration to `on_info` if given.
    pub fn search_with(
        &mut self,
        pos: &mut Position,
        limits: SearchLimits,
        ctx: &SearchContext,
        mut on_info: Option<InfoFn>,
    ) -> SearchResult {
        // An opening-book hit short-circuits the search entirely: these moves
        // are known-good and searching them only wastes the player's time.
        if let Some(book) = ctx.book {
            if let Some(mv) = book.pick(pos, limits.seed) {
                return SearchResult {
                    best_move: mv,
                    pv: vec![mv],
                    from_book: true,
                    ..Default::default()
                };
            }
        }

        let start = (self.now)();
        self.nodes = 0;
        self.stop = false;
        self.deadline = if limits.movetime_ms > 0 {
            start + limits.movetime_ms
        } else {
            0
        };
        self.rng = limits.seed | 1;
        // History from a previous move is stale but still a useful prior; decay
        // rather than discard it.
        for row in self.history.iter_mut() {
            for h in row.iter_mut() {
                *h /= 8;
            }
        }
        self.killers = [[NULL_MOVE; 2]; MAX_PLY];

        pos.set_root();
        let root_moves = pos.legal_moves();
        let mut result = SearchResult::default();
        if root_moves.is_empty() {
            result.score = -MATE_VALUE;
            return result;
        }
        result.best_move = root_moves[0];

        let mut prev_score = 0;
        for depth in 1..=limits.max_depth.max(1) {
            // Aspiration windows: assume the score moves little between
            // iterations and re-search wider only when it does.
            let (mut lo, mut hi) = if depth >= 4 {
                (prev_score - 60, prev_score + 60)
            } else {
                (-INFINITY, INFINITY)
            };

            let score = loop {
                let s = self.negamax(pos, depth as i32, lo, hi, true, true);
                if self.stop {
                    break s;
                }
                if s <= lo {
                    lo = (lo - 200).max(-INFINITY);
                } else if s >= hi {
                    hi = (hi + 200).min(INFINITY);
                } else {
                    break s;
                }
            };

            if self.stop {
                result.stopped_early = true;
                break;
            }

            let pv = self.extract_pv();
            if let Some(&m) = pv.first() {
                result.best_move = m;
            }
            result.score = score;
            result.depth = depth;
            result.nodes = self.nodes;
            result.pv = pv;
            result.time_ms = (self.now)().saturating_sub(start);
            prev_score = score;

            if let Some(cb) = on_info.as_deref_mut() {
                cb(&result);
            }

            // A forced mate is found; no deeper search can improve on it.
            if score.abs() >= MATE_BOUND {
                break;
            }
            // Stop if the next iteration plainly cannot finish in time.
            if self.deadline != 0 {
                let elapsed = (self.now)().saturating_sub(start);
                if elapsed * 2 >= limits.movetime_ms {
                    break;
                }
            }
        }

        result.nodes = self.nodes;
        result.time_ms = (self.now)().saturating_sub(start);

        // Let past games break ties between moves the search rates equally.
        if let Some(exp) = ctx.experience {
            let picked = self.apply_experience(pos, &root_moves, &result, exp);
            if picked != result.best_move {
                result.best_move = picked;
                result.from_experience = true;
                result.pv = vec![picked];
            }
        }

        // The easy levels blunder on purpose: pick among the root moves with
        // noise, so they feel like a weak human rather than a fast one.
        if limits.randomness_cp > 0 {
            result.best_move = self.pick_noisy_root_move(pos, &root_moves, limits.randomness_cp);
        }
        result
    }

    /// Re-pick among root moves the search considers near-equivalent, adding the
    /// experience bias.
    ///
    /// Child scores come from the transposition table rather than a fresh
    /// search: every root move worth considering was just searched, so its
    /// entry is present and current, and reusing it costs nothing.
    fn apply_experience(
        &mut self,
        pos: &mut Position,
        roots: &[Move],
        result: &SearchResult,
        exp: &Experience,
    ) -> Move {
        let key = pos.key;
        let best = result.best_move;
        // Never let experience talk the engine out of a forced mate.
        if result.score.abs() >= MATE_BOUND {
            return best;
        }
        // Nothing has ever been learned about this position, so there is no
        // opinion to apply. Returning early matters: without it, the comparison
        // below could still reshuffle equal-looking moves for no reason.
        if exp.lookup(key).is_none() {
            return best;
        }

        let mut chosen = best;
        let mut chosen_value = result.score + exp.bias(key, best);

        for &m in roots {
            if m == best {
                continue;
            }
            if !pos.make_move(m) {
                continue;
            }
            // Only exact entries may be compared. Most table entries are
            // alpha/beta *bounds*, and treating a bound as a score would make
            // a move look better than it was ever proven to be.
            let child = self.tt_probe(pos.key).and_then(|e| {
                (e.flag == TT_EXACT).then(|| -Self::tt_score(e.score as i32, pos.ply))
            });
            pos.undo_move();
            let Some(score) = child else { continue };
            // Only genuinely comparable alternatives are eligible.
            if result.score - score > TIE_MARGIN {
                continue;
            }
            let value = score + exp.bias(key, m);
            if value > chosen_value {
                chosen_value = value;
                chosen = m;
            }
        }
        chosen
    }

    fn pick_noisy_root_move(&mut self, pos: &mut Position, roots: &[Move], noise: i32) -> Move {
        let mut best = roots[0];
        let mut best_score = -INFINITY;
        for &m in roots {
            if !pos.make_move(m) {
                continue;
            }
            let s = -evaluate(pos);
            pos.undo_move();
            let jitter = (self.rand() % (2 * noise as u64 + 1)) as i32 - noise;
            if s + jitter > best_score {
                best_score = s + jitter;
                best = m;
            }
        }
        best
    }
}

/// Wall clock for non-WebAssembly hosts.
///
/// WebAssembly has no `std::time` clock, which is exactly why [`NowFn`] is
/// injected rather than called directly; the browser build passes a
/// `Date.now()` shim instead.
#[cfg(not(target_arch = "wasm32"))]
pub fn system_now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Convenience wrapper: search a position and return only the result.
pub fn search_position(
    pos: &mut Position,
    limits: SearchLimits,
    tt_mb: usize,
    now: NowFn,
) -> SearchResult {
    let mut s = Searcher::new(tt_mb, now);
    s.search(pos, limits, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::START_FEN;

    /// Tests do not need a real clock; depth limits bound them instead.
    fn zero_clock() -> u64 {
        0
    }

    fn search_depth(fen: &str, depth: u32) -> SearchResult {
        let mut pos = Position::from_fen(fen).unwrap();
        let limits = SearchLimits {
            max_depth: depth,
            movetime_ms: 0,
            randomness_cp: 0,
            seed: 1,
        };
        search_position(&mut pos, limits, 8, zero_clock)
    }

    #[test]
    fn finds_a_legal_move_from_the_start() {
        let r = search_depth(START_FEN, 5);
        let mut pos = Position::new();
        assert!(pos.legal_moves().contains(&r.best_move));
        assert!(r.depth >= 5);
        assert!(r.nodes > 0);
    }

    #[test]
    fn takes_a_free_rook() {
        // Black's rook on e6 is defended by nothing; Red's rook on e0 takes it.
        let r = search_depth("3k5/9/9/4r4/9/9/9/9/9/4RK3 w - - 0 1", 4);
        assert_eq!(
            move_to_iccs(r.best_move),
            "e0e6",
            "engine must win the hanging rook"
        );
    }

    #[test]
    fn does_not_hang_a_piece_to_a_recapture() {
        // Quiescence check: taking the pawn on e5 loses the rook to the pawn's
        // defender, so the engine must decline it.
        let r = search_depth("3k5/9/9/4p4/4p4/9/9/9/9/4RK3 w - - 0 1", 5);
        assert_ne!(
            move_to_iccs(r.best_move),
            "e0e5",
            "the recapture must be seen"
        );
    }

    #[test]
    fn finds_mate_in_one_by_unmasking_the_flying_general() {
        // A distinctly Xiangqi mate. Red's horse on e5 is the only thing
        // standing between the two kings; the rooks on d0 and f0 cover both
        // escape files. Any horse move opens the e-file, and the flying-general
        // rule delivers the check that Black cannot answer.
        let fen = "4k4/9/9/9/4N4/9/9/9/9/3RKR3 w - - 0 1";
        let r = search_depth(fen, 3);
        assert!(
            r.score >= MATE_BOUND,
            "should report a forced mate, got {}",
            r.score
        );
        // Verify the claim rather than assuming which move delivers it: after
        // the chosen move Black must have no legal reply at all. (Several moves
        // work here — one opens the flying general, another smothers Black into
        // having no move, which Xiangqi also scores as a loss.)
        let mut pos = Position::from_fen(fen).unwrap();
        assert!(pos.make_move(r.best_move), "best move must be legal");
        assert!(
            !pos.has_legal_move(),
            "{} was reported as mate but Black can still move",
            move_to_iccs(r.best_move)
        );
    }

    #[test]
    fn finds_a_mate_in_two() {
        // Same skeleton, but the horse starts a tempo away, so Red needs two
        // moves. Depth 4 is enough to see it.
        let r = search_depth("4k4/9/9/9/9/9/4N4/9/9/3RKR3 w - - 0 1", 5);
        assert!(
            r.score >= MATE_BOUND,
            "should still see the forced mate, got {}",
            r.score
        );
    }

    #[test]
    fn recognises_being_mated() {
        // Black to move with no legal reply at all.
        let mut pos = Position::from_fen("4k4/9/9/9/9/9/9/9/9/3RKR3 b - - 0 1").unwrap();
        assert!(pos.legal_moves().is_empty());
        let r = search_position(&mut pos, SearchLimits::default(), 4, zero_clock);
        assert_eq!(r.score, -MATE_VALUE);
    }

    #[test]
    fn deeper_search_visits_more_nodes() {
        let shallow = search_depth(START_FEN, 3);
        let deep = search_depth(START_FEN, 6);
        assert!(deep.nodes > shallow.nodes);
        assert!(deep.depth > shallow.depth);
    }

    #[test]
    fn an_opening_book_hit_skips_the_search_entirely() {
        use crate::book::Book;
        let book = Book::new();
        let mut pos = Position::new();
        let ctx = SearchContext {
            book: Some(&book),
            experience: None,
        };
        let mut s = Searcher::new(8, zero_clock);
        let r = s.search_with(&mut pos, SearchLimits::default(), &ctx, None);
        assert!(r.from_book);
        assert_eq!(r.nodes, 0, "a book move must cost no search");
        assert!(pos.legal_moves().contains(&r.best_move));
    }

    #[test]
    fn experience_changes_the_choice_between_equal_moves() {
        use crate::learn::{Experience, Outcome};

        let depth = 4;
        let limits = SearchLimits {
            max_depth: depth,
            movetime_ms: 0,
            randomness_cp: 0,
            seed: 1,
        };

        // What does the engine play with no memory?
        let mut pos = Position::new();
        let mut s = Searcher::new(8, zero_clock);
        let baseline = s.search(&mut pos, limits, None).best_move;

        // Teach it that this move has lost repeatedly.
        let mut exp = Experience::new();
        for _ in 0..8 {
            exp.learn_game(START_FEN, &[baseline], RED, Outcome::Loss)
                .unwrap();
        }
        assert!(exp.bias(Position::new().key, baseline) < 0);

        let mut pos = Position::new();
        let mut s = Searcher::new(8, zero_clock);
        let ctx = SearchContext {
            book: None,
            experience: Some(&exp),
        };
        let r = s.search_with(&mut pos, limits, &ctx, None);
        assert_ne!(
            r.best_move, baseline,
            "a repeatedly punished move should be avoided when equals exist"
        );
        assert!(r.from_experience);
        assert!(pos.legal_moves().contains(&r.best_move));
    }

    #[test]
    fn an_empty_experience_changes_nothing() {
        use crate::learn::Experience;

        // Regression: the tie-breaker used to read alpha/beta *bounds* out of
        // the transposition table as if they were exact scores, so an empty
        // experience book could still swap the engine's choice — in one case
        // declining a free rook. Consulting an empty book must be a no-op.
        let fens = [
            START_FEN,
            "3k5/9/9/4r4/9/9/9/9/9/4RK3 w - - 0 1",
            "r1ba1a3/4kn3/2n1b4/pNp1p1p1p/9/1C2P4/P1P3P1P/1CN1B4/4A4/2BAK2R1 w - - 0 1",
        ];
        let limits = SearchLimits {
            max_depth: 6,
            movetime_ms: 0,
            randomness_cp: 0,
            seed: 1,
        };
        let empty = Experience::new();

        for fen in fens {
            let mut a = Position::from_fen(fen).unwrap();
            let plain = Searcher::new(8, zero_clock).search(&mut a, limits, None);

            let mut b = Position::from_fen(fen).unwrap();
            let ctx = SearchContext {
                book: None,
                experience: Some(&empty),
            };
            let with_exp = Searcher::new(8, zero_clock).search_with(&mut b, limits, &ctx, None);

            assert_eq!(
                move_to_iccs(with_exp.best_move),
                move_to_iccs(plain.best_move),
                "empty experience altered the choice in {fen}"
            );
            assert!(!with_exp.from_experience);
        }
    }

    #[test]
    fn experience_never_overrides_a_forced_mate() {
        use crate::learn::{Experience, Outcome};

        let fen = "4k4/9/9/9/4N4/9/9/9/9/3RKR3 w - - 0 1";
        let limits = SearchLimits {
            max_depth: 3,
            movetime_ms: 0,
            randomness_cp: 0,
            seed: 1,
        };
        let mut pos = Position::from_fen(fen).unwrap();
        let mut s = Searcher::new(8, zero_clock);
        let mating = s.search(&mut pos, limits, None);
        assert!(mating.score >= MATE_BOUND);

        // Poison the mating move as hard as the book allows.
        let mut exp = Experience::new();
        for _ in 0..50 {
            exp.learn_game(fen, &[mating.best_move], RED, Outcome::Loss)
                .unwrap();
        }

        let mut pos = Position::from_fen(fen).unwrap();
        let mut s = Searcher::new(8, zero_clock);
        let ctx = SearchContext {
            book: None,
            experience: Some(&exp),
        };
        let r = s.search_with(&mut pos, limits, &ctx, None);
        assert_eq!(
            r.best_move, mating.best_move,
            "experience must not talk the engine out of mating"
        );
        assert!(!r.from_experience);
    }

    #[test]
    fn search_leaves_the_position_untouched() {
        let mut pos = Position::new();
        let before = pos.to_fen();
        let key = pos.key;
        let limits = SearchLimits {
            max_depth: 6,
            movetime_ms: 0,
            ..Default::default()
        };
        search_position(&mut pos, limits, 8, zero_clock);
        assert_eq!(pos.to_fen(), before);
        assert_eq!(pos.key, key);
        assert_eq!(pos.history_len(), 0);
    }
}
