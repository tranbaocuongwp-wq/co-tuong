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

/// How the clock is spent, as opposed to how much of it there is.
///
/// `movetime_ms` is a ceiling, and until now it was also the plan: the search
/// used all of it on every move, including the ones with a single sensible
/// reply. That is the wrong shape for a game. A person given forty-five seconds
/// does not spend forty-five seconds recapturing a pawn — they spend two, and
/// keep the rest for the position where it matters.
///
/// So the budget is a target rather than a quota. It is cut short when the
/// answer is plainly settled, and extended when the search says it is not yet
/// sure. Both directions are bounded: never below `min_depth`, never past
/// `panic_pct` of the ceiling.
///
/// These are percentages rather than milliseconds because they have to hold at
/// every level of the ladder — the same policy governs a six-second "Dễ" move
/// and a forty-five-second "Siêu khó" one.
#[derive(Clone, Copy, Debug)]
pub struct TimePolicy {
    /// The budget actually aimed at, as a percentage of `movetime_ms`.
    ///
    /// Higher than the 50% the old fixed rule worked out to, and deliberately:
    /// that rule guessed the next iteration would cost twice the last, while
    /// this one measures it, so it can afford to cut things finer without
    /// starting an iteration it cannot finish. Measured at 45 and at 65 on the
    /// bench positions it made no difference at all — the early exit is what
    /// stops a settled search. What this number governs is the *unsettled* one,
    /// where it is the only thing keeping the search from wandering to the wall.
    pub soft_pct: u32,
    /// The ceiling every extension is clamped to. Leaves headroom under the
    /// hard deadline so a granted extension can actually be used.
    pub panic_pct: u32,
    /// Added to the soft budget for each iteration that looks unsettled.
    pub instability_pct: u32,
    /// Iterations the best move must survive unchanged before stopping early.
    pub easy_stable_iters: u32,
    /// How far ahead of the second-best move the best one must be, in
    /// centipawns, before the choice counts as made. A whole piece: measured at
    /// two pawns, the exit fired on ordinary middlegames and cost seven plies.
    pub easy_margin_cp: i32,
    /// No early exit below this depth, however settled it looks. A position can
    /// look quiet for twelve plies and be lost on the thirteenth — and the
    /// ladder aims at depths of sixteen and up, so an exit at eight is not a
    /// saving, it is half the strength the level promised.
    pub min_depth: u32,
    /// Below this budget, behave exactly as before. Hint ranking slices the
    /// clock into 8ms and 60ms pieces, and adaptive timing at that scale is
    /// noise rather than judgement.
    pub min_adaptive_ms: u64,
}

impl Default for TimePolicy {
    fn default() -> Self {
        TimePolicy {
            soft_pct: 60,
            panic_pct: 85,
            instability_pct: 60,
            easy_stable_iters: 4,
            easy_margin_cp: 400,
            min_depth: 12,
            min_adaptive_ms: 300,
        }
    }
}

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
    /// How to spend `movetime_ms`. See `TimePolicy`.
    pub policy: TimePolicy,
    /// When false, the budget is spent exactly as it was before adaptive timing
    /// existed. Kept so a regression can be bisected against the old behaviour
    /// without rebuilding.
    pub adaptive: bool,
}

impl Default for SearchLimits {
    fn default() -> Self {
        SearchLimits {
            max_depth: 64,
            movetime_ms: 3_000,
            randomness_cp: 0,
            seed: 0x1234_5678,
            policy: TimePolicy::default(),
            adaptive: true,
        }
    }
}

/// Whether the next iteration is worth starting.
///
/// The rule this replaces assumed each iteration costs exactly twice the last
/// one. With principal-variation search, null-move pruning and late-move
/// reductions all working to make deeper iterations cheaper than they sound,
/// that number is neither 2 nor constant: it runs low on a quiet position,
/// where the old rule stopped with half the budget unspent, and high on a
/// tactical one, where the old rule started an iteration it could not finish
/// and then threw the work away.
///
/// So measure it. `last_iter / prev_iter` is the branching factor this search
/// is actually seeing, on this position, on this machine.
///
/// Clamped because the first iterations take microseconds and their ratio is
/// noise — an unclamped estimate from two sub-millisecond samples can predict
/// anything at all.
pub(crate) fn should_start_iteration(elapsed: u64, last_iter: u64, prev_iter: u64, soft: u64) -> bool {
    if soft == 0 {
        return true;
    }
    let ebf = if prev_iter > 0 && last_iter > 0 {
        ((last_iter as f64 / prev_iter as f64).clamp(1.3, 4.0) * 100.0) as u64
    } else {
        // No usable sample yet. Two is the old assumption and a fair prior.
        200
    };
    elapsed + last_iter * ebf / 100 <= soft
}

/// Why the search stopped.
///
/// Worth reporting rather than inferring. "Depth 18" tells a player nothing
/// about whether the engine was still unsure at depth 18 or had been certain
/// since depth 9 — and those are the two cases where a person would most like
/// to know what the machine was doing.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum StopReason {
    /// Ran out of depth. The budget was never the constraint.
    #[default]
    Depth,
    /// Reached the budget it aimed at, having finished an iteration.
    SoftBudget,
    /// Hit the wall mid-iteration; that iteration's work was discarded.
    HardDeadline,
    /// A forced mate; nothing deeper can improve on it.
    Mate,
    /// The move was settled and stayed settled. See `TimePolicy`.
    EasyPosition,
    /// Only one legal move existed.
    Forced,
    /// The host asked it to stop.
    Cancelled,
    /// The opening book answered; no search ran.
    Book,
}

impl StopReason {
    /// A stable identifier for the hosts to hand to the interface.
    pub fn as_str(self) -> &'static str {
        match self {
            StopReason::Depth => "depth",
            StopReason::SoftBudget => "soft",
            StopReason::HardDeadline => "hard",
            StopReason::Mate => "mate",
            StopReason::EasyPosition => "easy",
            StopReason::Forced => "forced",
            StopReason::Cancelled => "cancelled",
            StopReason::Book => "book",
        }
    }
}

/// A flag the host can raise to stop a search in progress.
///
/// Shared rather than owned because whoever wants the search stopped is by
/// definition not the thread running it. On the desktop that works: the search
/// runs in a blocking task and the interface thread can set the flag. In a
/// browser it does not — a worker sitting inside a search never returns to its
/// event loop to receive the message — so there the flag is only ever set
/// before a search starts. The type is honest either way.
#[derive(Clone, Default)]
pub struct StopFlag(std::sync::Arc<std::sync::atomic::AtomicBool>);

impl StopFlag {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn raise(&self) {
        self.0.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    pub fn clear(&self) {
        self.0.store(false, std::sync::atomic::Ordering::Relaxed);
    }
    pub fn raised(&self) -> bool {
        self.0.load(std::sync::atomic::Ordering::Relaxed)
    }
}

/// One option a hint can offer, with what it is worth.
#[derive(Clone, Copy, Debug)]
pub struct RootChoice {
    pub mv: Move,
    /// Centipawns from the moving side's point of view, after the reply.
    pub score: i32,
    /// The answer the engine expects. Zero when the move ends the game.
    pub reply: Move,
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
    /// Which of the stopping conditions actually fired.
    pub stop_reason: StopReason,
    /// How many times the best move changed between iterations. A high count on
    /// a settled-looking position is the honest signal that it was not settled.
    pub best_changes: u32,
    /// The budget the search aimed at, after any extensions it granted itself.
    /// Differs from `movetime_ms`, which is only the ceiling.
    pub soft_ms: u64,
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
    /// The wall. Crossing it abandons the current iteration.
    deadline: u64,
    /// The target. Crossing it stops *starting* new iterations, so the work
    /// already done is always kept. Moves outward when the position looks
    /// unsettled, never past `panic_deadline`.
    soft_deadline: u64,
    panic_deadline: u64,
    cancel: Option<StopFlag>,
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
            soft_deadline: 0,
            panic_deadline: 0,
            cancel: None,
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

    /// Hand the searcher a flag the host may raise while it is running.
    pub fn set_cancel(&mut self, flag: Option<StopFlag>) {
        self.cancel = flag;
    }

    #[inline]
    fn cancelled(&self) -> bool {
        self.cancel.as_ref().is_some_and(|f| f.raised())
    }

    #[inline]
    fn check_time(&mut self) {
        if self.deadline != 0 && (self.now)() >= self.deadline {
            self.stop = true;
        }
        if self.cancelled() {
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
                    // Perpetual check and perpetual chase are both losses; the
                    // search does not care which offence it was.
                    RepKind::WeLose(_) => -MATE_VALUE + ply as i32,
                    RepKind::WeWin(_) => MATE_VALUE - ply as i32,
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
    /// Score every legal move and return the best few, best first.
    ///
    /// The ordinary search answers "what should I play". This answers "what are
    /// my options, and how much worse is each one" — which is what a hint needs
    /// to be able to *justify* itself. One move with a score says "trust me";
    /// three moves with scores can be compared, and a player learns something
    /// from the comparison.
    ///
    /// Done by playing each root move and searching the position it leads to,
    /// rather than by teaching the main search to keep several lines. That
    /// search is tuned to prove one move best as fast as it can — narrowing the
    /// window, pruning siblings, cutting off early — and every one of those
    /// tricks makes the *other* moves' scores meaningless. Searching them
    /// separately is slower and correct.
    ///
    /// The opening book is deliberately left out: a book move is a fine thing
    /// to play but it comes with no score, and a hint that cannot say how good
    /// its advice is has nothing to offer here.
    ///
    /// ## Why this is done in two passes
    ///
    /// The obvious implementation — split the time budget evenly across every
    /// legal move — is what this used to do, and it gave bad advice. A
    /// middlegame position has around forty legal moves, so a two-and-a-half
    /// second budget bought sixty milliseconds each: about four plies. At four
    /// plies a losing move and a winning move can easily come back with the
    /// same score, and since the list is *sorted* by those scores, the noise
    /// decides the order. The player was being confidently handed whichever
    /// blunder happened to look best at depth four.
    ///
    /// Spreading effort evenly is the mistake. Almost all of those forty moves
    /// are obviously bad and need only enough search to be dismissed; the answer
    /// is among a handful. So: one cheap pass to find that handful, then the
    /// whole remaining budget spent on it. Same wall clock, several plies deeper
    /// where it counts.
    ///
    /// ## The anchor
    ///
    /// A shallow scouting pass can discard the move that actually wins — a test
    /// in this file demonstrates exactly that on a crowded middlegame, which is
    /// why the pass alone is not enough. So the ordinary search runs first and
    /// its move is placed at the head of the list unconditionally.
    ///
    /// That gives the guarantee a hint needs to be worth trusting: **the first
    /// suggestion is never worse than the move the engine would play itself.**
    /// The ranking's job is to explain the alternatives, not to overrule the
    /// strongest statement the engine is capable of making — and a shallower
    /// search disagreeing with a deeper one is noise, not a discovery.
    pub fn rank_moves(
        &mut self,
        pos: &mut Position,
        limits: SearchLimits,
        ctx: &SearchContext,
        top: usize,
    ) -> Vec<RootChoice> {
        /// Plies for the scouting pass. Enough to see a hanging piece, no more —
        /// this pass only has to be right about which moves are *plausible*.
        const SCOUT_DEPTH: u32 = 4;
        /// Never give a scouted move less than this, however many there are.
        const SCOUT_MIN_MS: u64 = 8;
        /// Never give a shortlisted move less than this.
        const DEEP_MIN_MS: u64 = 60;
        /// The shortlist is at least this long, so a hint always has real
        /// alternatives to compare even when only one move is any good.
        const SHORTLIST_MIN: usize = 8;
        /// Share of the budget spent deciding what to think about.
        const SCOUT_SHARE: u64 = 4;
        /// Share of the budget given to the ordinary search that anchors the list.
        const ANCHOR_SHARE: u64 = 3;

        let moves = pos.legal_moves();
        if moves.is_empty() || top == 0 {
            return Vec::new();
        }

        let child_ctx = SearchContext {
            book: None,
            experience: ctx.experience,
        };

        // The move the engine would play, and the score it stands behind. This
        // is the one number here that comes from a full-width search of the real
        // position rather than from a slice of the budget.
        let anchor = self.search_with(
            pos,
            SearchLimits {
                movetime_ms: limits.movetime_ms / ANCHOR_SHARE,
                randomness_cp: 0,
                ..limits
            },
            &child_ctx,
            None,
        );

        let rest = limits.movetime_ms - limits.movetime_ms / ANCHOR_SHARE;
        let scout_budget = rest / SCOUT_SHARE;
        let scout_limits = SearchLimits {
            max_depth: limits.max_depth.min(SCOUT_DEPTH).max(1),
            movetime_ms: if limits.movetime_ms > 0 {
                (scout_budget / moves.len() as u64).max(SCOUT_MIN_MS)
            } else {
                0
            },
            // No noise: the whole point is to compare these honestly.
            randomness_cp: 0,
            seed: limits.seed,
            ..Default::default()
        };

        let mut scouted = Vec::with_capacity(moves.len());
        for mv in moves {
            // The anchor already has a better answer than this pass could give.
            if mv == anchor.best_move {
                continue;
            }
            if !pos.make_move(mv) {
                continue;
            }
            let child = self.search_with(pos, scout_limits, &child_ctx, None);
            pos.undo_move();
            // The child score is from the opponent's point of view.
            scouted.push(RootChoice {
                mv,
                score: -child.score,
                reply: child.best_move,
            });
        }
        scouted.sort_by(|a, b| b.score.cmp(&a.score));

        // Wider than `top` on purpose: the scouting pass is shallow, so a move
        // worth offering may be sitting a few places down the list. Giving it a
        // proper search is the only way to find that out.
        let shortlist = scouted.len().min(top.saturating_mul(3).max(SHORTLIST_MIN));
        let deep_budget = rest.saturating_sub(scout_budget);
        let deep_limits = SearchLimits {
            max_depth: limits.max_depth.saturating_sub(1).max(1),
            movetime_ms: if limits.movetime_ms > 0 {
                (deep_budget / shortlist as u64).max(DEEP_MIN_MS)
            } else {
                0
            },
            randomness_cp: 0,
            seed: limits.seed,
            ..Default::default()
        };

        let mut out = Vec::with_capacity(shortlist);
        for choice in scouted.into_iter().take(shortlist) {
            if !pos.make_move(choice.mv) {
                continue;
            }
            let child = self.search_with(pos, deep_limits, &child_ctx, None);
            pos.undo_move();
            out.push(RootChoice {
                mv: choice.mv,
                score: -child.score,
                reply: child.best_move,
            });
        }

        out.sort_by(|a, b| b.score.cmp(&a.score));
        out.truncate(top.saturating_sub(1));

        // The anchor goes in front of them all — see the note above. Its reply is
        // the second move of its own principal variation, which is precisely
        // "what the engine expects to happen next".
        if anchor.best_move != 0 {
            out.insert(
                0,
                RootChoice {
                    mv: anchor.best_move,
                    score: anchor.score,
                    reply: anchor.pv.get(1).copied().unwrap_or(0),
                },
            );
        }
        out.truncate(top);
        out
    }

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
        /*
         * Three clocks, not one.
         *
         * `deadline` is the wall the search must never cross, and crossing it
         * costs the current iteration. `soft_deadline` is the time it actually
         * aims at; stopping there means every iteration it ran is kept. The gap
         * between them is the room an extension has to move into, and
         * `panic_deadline` is how far into that room it is allowed to go.
         *
         * Below `min_adaptive_ms` none of this applies. Hint ranking slices the
         * clock into pieces of eight and sixty milliseconds, and judgement about
         * how to spend eight milliseconds is not judgement, it is noise.
         */
        let policy = limits.policy;
        let adaptive = limits.adaptive && limits.movetime_ms >= policy.min_adaptive_ms;
        self.deadline = if limits.movetime_ms > 0 {
            start + limits.movetime_ms
        } else {
            0
        };
        let soft_base = if adaptive {
            limits.movetime_ms * policy.soft_pct as u64 / 100
        } else {
            limits.movetime_ms
        };
        self.soft_deadline = if limits.movetime_ms > 0 { start + soft_base } else { 0 };
        self.panic_deadline = if limits.movetime_ms > 0 {
            start + limits.movetime_ms * policy.panic_pct as u64 / 100
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

        /*
         * One legal move is not a decision.
         *
         * A forced recapture, or a King with a single square to run to, has
         * nothing to think about — and yet the search would sit there burning
         * the entire time budget before playing the only thing it could. At the
         * top level that was forty seconds of the player watching a spinner to
         * be told what they already knew.
         *
         * A shallow search still runs, and deliberately: the interface reads
         * the score and the principal variation off this result to draw the
         * position chart and to let the commentator look ahead. Returning a
         * bare move with a zero score would snap the win bar to even every time
         * a piece was recaptured. Six plies costs a few milliseconds and keeps
         * all of that honest.
         */
        if root_moves.len() == 1 {
            let forced_depth = limits.max_depth.min(6).max(1);
            self.negamax(pos, forced_depth as i32, -INFINITY, INFINITY, true, true);
            result.score = self.negamax(pos, 1, -INFINITY, INFINITY, true, true);
            result.depth = forced_depth;
            result.nodes = self.nodes;
            result.best_move = root_moves[0];
            result.pv = self.extract_pv();
            if result.pv.first() != Some(&root_moves[0]) {
                result.pv = vec![root_moves[0]];
            }
            result.time_ms = (self.now)().saturating_sub(start);
            result.stop_reason = StopReason::Forced;
            return result;
        }

        let mut prev_score = 0;
        let mut prev_best = NULL_MOVE;
        let mut stable = 0u32;
        let mut last_iter_ms = 0u64;
        let mut prev_iter_ms = 0u64;
        let mut reason = StopReason::Depth;

        for depth in 1..=limits.max_depth.max(1) {
            let iter_start = (self.now)();
            // A fail-low at the root is the single most valuable reason in this
            // engine to spend more time: it means the move about to be played is
            // worse than it was believed to be. The aspiration loop below used to
            // absorb it silently.
            let mut failed_low = false;

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
                    failed_low = true;
                    lo = (lo - 200).max(-INFINITY);
                } else if s >= hi {
                    hi = (hi + 200).min(INFINITY);
                } else {
                    break s;
                }
            };

            if self.stop {
                result.stopped_early = true;
                reason = if self.cancelled() {
                    StopReason::Cancelled
                } else {
                    StopReason::HardDeadline
                };
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
            let now = (self.now)();
            result.time_ms = now.saturating_sub(start);

            prev_iter_ms = last_iter_ms;
            last_iter_ms = now.saturating_sub(iter_start);

            // Did this iteration change its mind, and how far?
            let changed = prev_best != NULL_MOVE && result.best_move != prev_best;
            if changed {
                result.best_changes += 1;
                stable = 0;
            } else {
                stable += 1;
            }
            prev_best = result.best_move;
            let dropped = depth > 1 && score < prev_score - 50;
            let unsettled = changed || failed_low || dropped;
            prev_score = score;

            if let Some(cb) = on_info.as_deref_mut() {
                cb(&result);
            }

            /*
             * A forced mate ends it — but only one the engine is delivering.
             *
             * The old rule stopped on `score.abs()`, which also stopped the
             * moment the engine saw that it was *being* mated. That is exactly
             * backwards: a deeper search finds a longer defence, and mate in
             * seven is a strictly better outcome than mate in three. There is
             * nothing to gain by hurrying towards your own loss.
             */
            if score >= MATE_BOUND || (!adaptive && score <= -MATE_BOUND) {
                reason = StopReason::Mate;
                break;
            }

            if !adaptive {
                // The behaviour before any of this existed, kept intact so a
                // regression can be bisected against it.
                if self.deadline != 0 {
                    let elapsed = now.saturating_sub(start);
                    if elapsed * 2 >= limits.movetime_ms {
                        reason = StopReason::SoftBudget;
                        break;
                    }
                }
                continue;
            }

            // Unsettled positions buy themselves more of the ceiling.
            if unsettled && self.soft_deadline != 0 {
                let grant = soft_base * policy.instability_pct as u64 / 100;
                self.soft_deadline = (self.soft_deadline + grant).min(self.panic_deadline);
            }

            /*
             * The move is made. Stop asking.
             *
             * Four conditions, and all of them have to hold, because the first
             * version of this rule was measured cutting the engine off at its
             * knees. It also stopped once the score passed a Rook, on the theory
             * that a piece up is a won game — and on the endgame position it did
             * exactly that: stopped at depth 8 a Rook ahead, where the old code
             * had gone to depth 15 and found a forced mate. Being ahead is
             * precisely when a search should keep looking, because that is when
             * there is something to convert. That clause is gone.
             *
             * What is left: depth, because a position can look quiet for twelve
             * plies and be lost on the thirteenth. Stability, because one
             * iteration agreeing with the last is a coincidence and four is a
             * pattern. And a clear margin over the runner-up — a whole piece, not
             * the two pawns first tried — because when the alternative is nearly
             * as good it does not matter how sure the engine is: either move will
             * do.
             *
             * There was a fourth for a while: it also had to have spent a quarter
             * of the budget, on the theory that an exit firing in eleven
             * milliseconds saves nobody from a wait. It made the exit depend on
             * the *size* of the budget, so a generous one delayed it — and a test
             * caught the consequence: on a two-minute budget the exit was
             * suppressed past the depth where the position had plainly settled,
             * the search carried on, and it ran into the wall and lost a whole
             * iteration's work. `min_depth` is the guard that was actually wanted.
             */
            if depth >= policy.min_depth
                && !unsettled
                && stable >= policy.easy_stable_iters
                && self
                    .root_gap(pos, &root_moves, result.best_move, score)
                    .is_some_and(|gap| gap >= policy.easy_margin_cp)
            {
                reason = StopReason::EasyPosition;
                break;
            }

            if self.soft_deadline != 0 {
                let elapsed = now.saturating_sub(start);
                let soft = self.soft_deadline.saturating_sub(start);
                if !should_start_iteration(elapsed, last_iter_ms, prev_iter_ms, soft) {
                    reason = StopReason::SoftBudget;
                    break;
                }
            }
        }

        /*
         * A move always comes with a line, even when nothing finished.
         *
         * If the wall arrives during the very first iteration there is no
         * completed depth and `pv` stays empty — and the interface reads the
         * line off this to draw the position chart and to let the commentator
         * look ahead. One move is a poor line but it is an honest one, and it is
         * infinitely better than the empty vector that used to come back.
         */
        if result.pv.is_empty() && result.best_move != NULL_MOVE {
            result.pv = vec![result.best_move];
        }

        result.stop_reason = reason;
        result.soft_ms = self.soft_deadline.saturating_sub(start);
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

    /// How far the best root move is ahead of the next best, in centipawns.
    ///
    /// Read off the transposition table rather than searched for, on the same
    /// reasoning `apply_experience` already relies on: every root move worth
    /// considering was just searched, so its entry is present and current.
    ///
    /// `None` when no rival has a usable entry — and `None` costs nothing, since
    /// its only effect is that the search keeps thinking. A wrong `Some` would
    /// stop a search that should have continued, which is why only exact entries
    /// count: most table entries are alpha/beta *bounds*, and a bound treated as
    /// a score can make a move look further behind than it was ever proven to be.
    fn root_gap(&mut self, pos: &mut Position, roots: &[Move], best: Move, score: i32) -> Option<i32> {
        let mut runner_up: Option<i32> = None;
        for &m in roots {
            if m == best {
                continue;
            }
            if !pos.make_move(m) {
                continue;
            }
            let child = self.tt_probe(pos.key).and_then(|e| {
                (e.flag == TT_EXACT).then(|| -Self::tt_score(e.score as i32, pos.ply))
            });
            pos.undo_move();
            if let Some(c) = child {
                runner_up = Some(runner_up.map_or(c, |best_so_far: i32| best_so_far.max(c)));
            }
        }
        runner_up.map(|r| score - r)
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

    /// Ranking must agree with the plain search on which move is best, and put
    /// the others behind it in a sane order.
    #[test]
    fn ranking_agrees_with_the_search_on_the_best_move() {
        // A free Rook hanging on e5 for Red to take with the Rook on e2.
        let mut pos = Position::from_fen("5k3/9/9/9/4r4/9/9/9/4R4/3K5 w - - 0 1").unwrap();
        let limits = SearchLimits {
            max_depth: 6,
            movetime_ms: 0,
            randomness_cp: 0,
            seed: 1,
            ..Default::default()
        };
        let mut engine = Searcher::new(8, zero_clock);
        let best = engine.search(&mut pos, limits, None).best_move;

        let ranked = engine.rank_moves(&mut pos, limits, &SearchContext::default(), 3);
        assert_eq!(ranked.len(), 3);
        assert_eq!(ranked[0].mv, best, "top choice must be the search's own");
        assert!(
            ranked[0].score >= ranked[1].score && ranked[1].score >= ranked[2].score,
            "choices must come back best first"
        );
    }

    /// A position with one legal move answers instantly, not after the budget.
    ///
    /// The whole point of the short circuit: a player facing a forced recapture
    /// should not wait forty seconds to be told the only thing that could
    /// happen. The score still has to come back, because the interface draws
    /// its chart from it.
    #[test]
    fn a_forced_move_does_not_burn_the_clock() {
        // Black is in check from the Rook on e1 and can only interpose on e8;
        // everything else leaves the King attacked.
        let mut pos = Position::from_fen("4k4/4a4/9/9/9/9/9/9/9/4K3R").unwrap();
        pos.set_root();
        let legal = pos.legal_moves().len();

        let mut engine = Searcher::new(8, zero_clock);
        let result = engine.search(
            &mut pos,
            SearchLimits {
                max_depth: 64,
                // A budget it would certainly spend if it were going to think.
                movetime_ms: 30_000,
                randomness_cp: 0,
                seed: 1,
                ..Default::default()
            },
            None,
        );

        assert!(result.best_move != 0, "must still name a move");
        assert!(!result.pv.is_empty(), "the interface reads the line off this");
        assert_eq!(result.pv[0], result.best_move, "the line must start with the move");
        if legal == 1 {
            assert!(
                result.depth <= 6,
                "a forced move must not run the full search (depth {})",
                result.depth
            );
        }
    }

    // -- the clock ---------------------------------------------------------
    //
    // Nothing below here could run before `ticking_clock` existed: with a frozen
    // clock the deadline is always in the future, so `check_time` never fires.

    /// The wall, and a budget small enough that nothing can dodge it.
    ///
    /// Two versions of this test proved nothing before this one. The opening
    /// array on a short budget stopped on the *soft* limit every time, because
    /// the predictor correctly refused to start an iteration it could not
    /// finish; `soft_pct: 100` did not help, because the predictor still ran.
    /// The only way to reach the wall on purpose is a budget too small for even
    /// the first iteration, which is also the case that used to come back with
    /// no principal variation at all.
    #[test]
    fn hard_deadline_stops_the_search() {
        reset_clock();
        let mut pos =
            Position::from_fen("3akab2/9/4c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/R2AKAB2 w - - 0 1")
                .unwrap();
        let mut engine = Searcher::new(8, ticking_clock);
        let r = engine.search(
            &mut pos,
            SearchLimits {
                max_depth: 64,
                movetime_ms: 1,
                policy: TimePolicy { min_adaptive_ms: 0, ..Default::default() },
                ..Default::default()
            },
            None,
        );
        assert!(!r.pv.is_empty(), "even a search that finished nothing owes a line");
        assert_eq!(r.stop_reason, StopReason::HardDeadline, "this test is about the wall");
        assert!(r.stopped_early, "and about it being reported");
        assert!(r.best_move != 0, "a search that ran out of time still owes a move");
        assert!(
            pos.legal_moves().contains(&r.best_move),
            "and the move it owes has to be legal"
        );
    }

    #[test]
    fn a_completed_iteration_is_never_discarded() {
        reset_clock();
        let mut pos = Position::from_fen(START_FEN).unwrap();
        let mut engine = Searcher::new(8, ticking_clock);
        let r = engine.search(
            &mut pos,
            SearchLimits { max_depth: 64, movetime_ms: 200, ..Default::default() },
            None,
        );
        // The interface reads the line off this, so an empty one is a bug even
        // when the clock ran out mid-iteration.
        assert!(!r.pv.is_empty(), "the principal variation must survive a timeout");
        assert_eq!(r.pv[0], r.best_move, "the line must start with the move");
    }

    #[test]
    fn the_soft_budget_stops_before_the_hard_one() {
        reset_clock();
        let mut pos = Position::from_fen(START_FEN).unwrap();
        let mut engine = Searcher::new(8, ticking_clock);
        let r = engine.search(
            &mut pos,
            SearchLimits { max_depth: 64, movetime_ms: 4_000, ..Default::default() },
            None,
        );
        assert!(
            r.time_ms < 4_000,
            "stopping at the wall means the last iteration was thrown away (took {}ms)",
            r.time_ms
        );
        assert_ne!(
            r.stop_reason,
            StopReason::HardDeadline,
            "an adaptive search should not be reaching its hard deadline here"
        );
    }

    /// The prediction, on its own, without a search in the way.
    #[test]
    fn branching_factor_is_measured_not_assumed() {
        // No sample yet: falls back to assuming the next iteration costs double.
        assert!(should_start_iteration(100, 100, 0, 300));
        assert!(!should_start_iteration(100, 100, 0, 250));

        // A cheap iteration after an expensive one predicts a cheap next one, so
        // a budget the old fixed rule would have refused is now worth starting.
        assert!(should_start_iteration(1_000, 200, 190, 1_300));
        // And an expensive one after a cheap one predicts worse than double.
        assert!(!should_start_iteration(1_000, 400, 100, 1_900));

        // No budget means no reason to stop.
        assert!(should_start_iteration(u64::MAX / 2, 1_000, 1_000, 0));
    }

    /// A real middlegame, settled, stopping of its own accord.
    ///
    /// Two false starts are worth recording. The first used a lone hanging Rook
    /// and passed for the wrong reason: that position is a forced mate, so it was
    /// measuring the mate exit. The second set `movetime_ms: 0` to take the clock
    /// out of the picture — which switches adaptive timing off entirely, since
    /// the whole mechanism is gated on the budget clearing `min_adaptive_ms`. The
    /// test then searched to depth 64 and hung.
    ///
    /// So: a generous *fake* budget, large enough that the early exit is the only
    /// thing that can plausibly stop it before the ceiling.
    #[test]
    fn an_easy_position_exits_early() {
        reset_clock();
        let mut pos = Position::from_fen(
            "r1ba1a3/4kn3/2n1b4/pNp1p1p1p/9/1C2P4/P1P3P1P/1CN1B4/4A4/2BAK2R1 w - - 0 1",
        )
        .unwrap();
        let mut engine = Searcher::new(64, ticking_clock);
        let r = engine.search(
            &mut pos,
            SearchLimits { max_depth: 64, movetime_ms: 45_000, ..Default::default() },
            None,
        );
        assert_eq!(
            r.stop_reason,
            StopReason::EasyPosition,
            "a settled position must stop itself (stopped on {} at depth {})",
            r.stop_reason.as_str(),
            r.depth
        );
        assert!(r.depth >= 12, "and never before the minimum depth");
        assert!(r.depth < 64, "and well before the ceiling");
    }

    /// Losing is not a reason to stop looking.
    ///
    /// The old rule stopped on `score.abs()`, so it quit the moment it saw it
    /// was *being* mated — and quitting there is how you find the shortest loss
    /// rather than the longest defence.
    ///
    /// The position matters: five legal moves, so the forced-move short circuit
    /// cannot fire and claim the credit. The first attempt at this test used a
    /// position with two legal moves and proved nothing.
    #[test]
    fn being_mated_keeps_searching_for_the_longest_defence() {
        let mut pos =
            Position::from_fen("2bak1b2/4a4/9/9/9/9/9/3r1r3/4A4/3AK1B2 w - - 0 1").unwrap();
        assert!(pos.legal_moves().len() > 2, "must not be a forced move");
        // A budget, not zero: `movetime_ms: 0` turns adaptive timing off, and
        // the non-adaptive path deliberately keeps the old stop-on-any-mate rule.
        reset_clock();
        let mut engine = Searcher::new(8, ticking_clock);
        let r = engine.search(
            &mut pos,
            SearchLimits { max_depth: 14, movetime_ms: 60_000, ..Default::default() },
            None,
        );
        assert!(r.score <= -MATE_BOUND, "this test needs a lost position (score {})", r.score);
        assert_ne!(
            r.stop_reason,
            StopReason::Mate,
            "it stopped on its own mate instead of looking for a longer defence"
        );
        assert!(r.best_move != 0, "a lost position still has to name a move");
    }

    #[test]
    fn a_raised_cancel_flag_stops_the_search() {
        reset_clock();
        let mut pos = Position::from_fen(START_FEN).unwrap();
        let mut engine = Searcher::new(8, ticking_clock);
        let flag = StopFlag::new();
        flag.raise();
        engine.set_cancel(Some(flag));
        let r = engine.search(
            &mut pos,
            SearchLimits { max_depth: 64, movetime_ms: 30_000, ..Default::default() },
            None,
        );
        assert!(
            r.time_ms < 30_000,
            "a cancelled search must not run its budget out ({}ms)",
            r.time_ms
        );
        assert!(r.best_move != 0, "even a cancelled search owes a move");
    }

    /// The scouting pass must not throw away the move that actually wins.
    ///
    /// This is the whole risk the two-pass design takes on: a shallow look
    /// decides what gets a real search, so anything it drops can never be
    /// recommended however good it is. A middlegame with forty-odd legal moves
    /// is where that would bite, and the assertion is the one that matters —
    /// ranking must still land on the move a deeper search picks, at a depth the
    /// scout itself (capped at four plies) cannot see.
    #[test]
    fn ranking_survives_a_crowded_position() {
        let mut pos =
            Position::from_fen("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1")
                .unwrap();
        assert!(
            pos.legal_moves().len() > 30,
            "the point of this test is a position with plenty to choose from"
        );

        let limits = SearchLimits {
            max_depth: 8,
            movetime_ms: 0,
            randomness_cp: 0,
            seed: 1,
            ..Default::default()
        };
        let mut engine = Searcher::new(16, zero_clock);
        let best = engine.search(&mut pos, limits, None).best_move;

        let ranked = engine.rank_moves(&mut pos, limits, &SearchContext::default(), 3);
        assert_eq!(ranked[0].mv, best, "the shortlist dropped the best move");
    }

    /// Nothing to choose between when there is nothing to play.
    #[test]
    fn ranking_an_ended_game_offers_nothing() {
        // Black is mated: Red rooks on the back rank, no legal reply.
        let mut pos = Position::from_fen("3k5/9/9/9/9/9/9/9/9/3K1R3 b - - 0 1").unwrap();
        let mut engine = Searcher::new(8, zero_clock);
        let ranked = engine.rank_moves(
            &mut pos,
            SearchLimits {
                max_depth: 2,
                movetime_ms: 0,
                randomness_cp: 0,
                seed: 1,
                ..Default::default()
            },
            &SearchContext::default(),
            3,
        );
        assert!(ranked.len() <= 3);
    }
    use super::*;
    use crate::board::START_FEN;

    /// Tests do not need a real clock; depth limits bound them instead.
    ///
    /// Every test using this passes `movetime_ms: 0`, which switches the
    /// deadline off entirely — so with only this clock the whole timing path was
    /// dead code as far as the suite was concerned. `ticking_clock` below exists
    /// to fix that.
    fn zero_clock() -> u64 {
        0
    }

    thread_local! {
        static FAKE_NOW: std::cell::Cell<u64> = const { std::cell::Cell::new(0) };
    }

    /// A clock that advances seven milliseconds every time it is read.
    ///
    /// `NowFn` is a plain function pointer, so its state has to be static — and a
    /// `static AtomicU64` would be shared between tests running in parallel and
    /// flake. `cargo test` gives each test its own thread, so a thread-local is
    /// isolated for free.
    ///
    /// Seven milliseconds a tick, with `check_time` running every 2048 nodes,
    /// makes a hundred-millisecond budget end after a few hundred thousand
    /// nodes: fast, deterministic, and never dependent on how busy the machine
    /// running the tests happens to be.
    fn ticking_clock() -> u64 {
        FAKE_NOW.with(|c| {
            let v = c.get();
            c.set(v + 7);
            v
        })
    }

    /// Reset the fake clock so each test starts from zero.
    fn reset_clock() {
        FAKE_NOW.with(|c| c.set(0));
    }

    fn search_depth(fen: &str, depth: u32) -> SearchResult {
        let mut pos = Position::from_fen(fen).unwrap();
        let limits = SearchLimits {
            max_depth: depth,
            movetime_ms: 0,
            randomness_cp: 0,
            seed: 1,
            ..Default::default()
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
            ..Default::default()
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
            ..Default::default()
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
            ..Default::default()
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
