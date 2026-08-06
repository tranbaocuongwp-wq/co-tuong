//! WebAssembly bindings.
//!
//! Two exported types, mirroring how the app uses them:
//!
//! * [`Game`] owns a position *and its move history*, so repetition and the
//!   perpetual-check rule work — they cannot be decided from a FEN alone. The
//!   UI holds one of these on the main thread to answer "what is legal here?"
//!   instantly.
//! * [`Engine`] owns the search state (transposition table, opening book,
//!   experience). The web build runs one inside a Web Worker so thinking never
//!   blocks the interface.
//!
//! Everything that crosses this boundary is validated. The JavaScript side is
//! not trusted to send legal moves.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use xiangqi_engine::board::{Forcing, RepKind};
use xiangqi_engine::learn::Outcome;
use xiangqi_engine::notation::move_to_vietnamese;
use xiangqi_engine::types::{
    disp_col, disp_row, iccs_to_move, kind_of, move_to_iccs, mv_from, mv_to, side_of, Move, BLACK,
    EMPTY, RED,
};
use xiangqi_engine::{
    Book, Experience, Position, SearchContext, SearchLimits, Searcher, START_FEN,
};

/// Milliseconds for the search clock. WebAssembly has no `std::time`, so the
/// engine takes this as an injected function pointer.
fn wasm_now_ms() -> u64 {
    js_sys::Date::now() as u64
}

/// Route Rust panics to the browser console.
///
/// Without this a panic surfaces in JavaScript as `unreachable` with no file,
/// line or message — which tells you nothing about what actually went wrong.
/// Called from both exported constructors so it is installed however the module
/// is first used.
fn install_panic_hook() {
    use std::sync::Once;
    static ONCE: Once = Once::new();
    ONCE.call_once(console_error_panic_hook::set_once);
}

/// Install the panic hook explicitly; safe to call more than once.
#[wasm_bindgen(js_name = initDiagnostics)]
pub fn init_diagnostics() {
    install_panic_hook();
}

fn err(msg: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&msg.to_string())
}

fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(err)
}

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveInfo {
    /// Display row 0..9 (0 = Black's back rank) and column 0..8.
    pub from_row: usize,
    pub from_col: usize,
    pub to_row: usize,
    pub to_col: usize,
    pub iccs: String,
    /// Traditional Vietnamese notation, e.g. "Pháo 2 bình 5".
    pub text: String,
    pub capture: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PieceInfo {
    pub row: usize,
    pub col: usize,
    /// "r" for Red, "b" for Black.
    pub side: &'static str,
    /// One of "k", "a", "e", "h", "r", "c", "p".
    pub kind: &'static str,
    /// The Chinese character conventionally shown on the piece.
    pub glyph: &'static str,
}

/// What the last move did, in the terms a commentator speaks in.
///
/// Kinds are the same single letters `PieceInfo` uses, so the interface has one
/// vocabulary for pieces rather than two.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveReportInfo {
    /// Kind of the piece that moved.
    pub mover: &'static str,
    /// "r" or "b" - which side played it.
    pub side: &'static str,
    /// Kind taken, or null when the move took nothing.
    pub captured: Option<&'static str>,
    /// Whether the move left the opponent in check.
    pub gives_check: bool,
    /// Enemy kinds the moved piece can now profitably take, best first.
    pub threats: Vec<&'static str>,
    /// The moved piece is now on the far side of the river.
    pub crossed_river: bool,
    /// The move carried the piece into the enemy palace.
    pub into_palace: bool,
}

/// One option offered by the hint, with everything needed to explain it.
///
/// The score alone is not an explanation. What makes a move worth playing is
/// usually something concrete on the board — it takes a piece, it gives check,
/// it lines something up — and those are reported alongside so the interface
/// can say *why* rather than quoting a number at the player.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HintInfo {
    pub iccs: String,
    /// Traditional Vietnamese notation, e.g. "Pháo 2 bình 5".
    pub text: String,
    /// Centipawns from the player's point of view, after the expected reply.
    pub score: i32,
    /// Kind taken, or null.
    pub captured: Option<&'static str>,
    pub gives_check: bool,
    /// Enemy kinds this move would then threaten, best first.
    pub threats: Vec<&'static str>,
    /// The reply the engine expects, in notation. Empty if the move ends it.
    pub reply: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusInfo {
    /// "playing", "redWin", "blackWin" or "draw".
    pub status: &'static str,
    /// Why the game ended: "", "checkmate", "stalemate", "repetition",
    /// "perpetualCheck", "perpetualChase", "sixtyMove" or
    /// "insufficientMaterial".
    pub reason: &'static str,
    pub side_to_move: &'static str,
    pub in_check: bool,
    pub legal_move_count: usize,
    pub move_number: u32,
    pub halfmove: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchInfo {
    pub iccs: String,
    pub text: String,
    pub score: i32,
    pub depth: u32,
    /// f64 rather than u64: BigInt would cross into JavaScript otherwise.
    pub nodes: f64,
    pub time_ms: f64,
    pub pv: Vec<String>,
    pub from_book: bool,
    pub from_experience: bool,
    /// Set when the score is a forced mate; the value is the distance in plies.
    pub mate_in: Option<i32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SearchOptions {
    pub max_depth: u32,
    pub movetime_ms: u64,
    pub randomness_cp: i32,
    pub seed: f64,
    pub use_book: bool,
    pub use_experience: bool,
}

impl Default for SearchOptions {
    fn default() -> Self {
        SearchOptions {
            max_depth: 64,
            movetime_ms: 3_000,
            randomness_cp: 0,
            seed: 1.0,
            use_book: true,
            use_experience: true,
        }
    }
}

fn glyph_for(pc: u8) -> &'static str {
    let red = side_of(pc) == RED;
    match (kind_of(pc), red) {
        (0, true) => "帥",
        (0, false) => "將",
        (1, true) => "仕",
        (1, false) => "士",
        (2, true) => "相",
        (2, false) => "象",
        (3, true) => "傌",
        (3, false) => "馬",
        (4, true) => "俥",
        (4, false) => "車",
        (5, true) => "炮",
        (5, false) => "砲",
        (_, true) => "兵",
        (_, false) => "卒",
    }
}

/// Convert a search result into the shape the interface consumes.
///
/// `source` is the position the move is played *from*, needed to render the
/// move in Vietnamese notation.
fn describe_search(source: &Position, r: &xiangqi_engine::SearchResult) -> SearchInfo {
    let mate_in = if r.score.abs() >= xiangqi_engine::MATE_BOUND {
        let plies = xiangqi_engine::MATE_VALUE - r.score.abs();
        Some(if r.score > 0 { plies } else { -plies })
    } else {
        None
    };
    SearchInfo {
        iccs: move_to_iccs(r.best_move),
        text: move_to_vietnamese(source, r.best_move),
        score: r.score,
        depth: r.depth,
        nodes: r.nodes as f64,
        time_ms: r.time_ms as f64,
        pv: r.pv.iter().map(|m| move_to_iccs(*m)).collect(),
        from_book: r.from_book,
        from_experience: r.from_experience,
        mate_in,
    }
}

/// Why a repeated position was scored against one side.
fn forcing_reason(offence: Forcing) -> &'static str {
    match offence {
        Forcing::Check => "perpetualCheck",
        Forcing::Chase => "perpetualChase",
    }
}

/// Same letters as `kind_letter`, but for a bare kind rather than a piece.
fn kind_name(kind: u8) -> &'static str {
    match kind {
        0 => "k",
        1 => "a",
        2 => "e",
        3 => "h",
        4 => "r",
        5 => "c",
        _ => "p",
    }
}

fn kind_letter(pc: u8) -> &'static str {
    match kind_of(pc) {
        0 => "k",
        1 => "a",
        2 => "e",
        3 => "h",
        4 => "r",
        5 => "c",
        _ => "p",
    }
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

/// A position plus the moves that produced it.
#[wasm_bindgen]
pub struct Game {
    pos: Position,
    start_fen: String,
    moves: Vec<Move>,
    /// How often a position must recur before the repetition rules decide it.
    repeat_limit: usize,
    /// Whether a repetition can lose the game, or only draw it.
    repeat_decisive: bool,
}

/**
 * How many repeats a game allows before the rules step in.
 *
 * The search still treats the very first repeat as decisive — it must, or it
 * would happily walk into a perpetual. A *game* is different: the competition
 * rules give a player room to repeat before a judge intervenes, and ending a
 * game the instant a position comes round twice punishes people for shuffling
 * while they think, with no warning and no way back.
 */
const DEFAULT_REPEAT_LIMIT: usize = 5;

#[wasm_bindgen]
impl Game {
    /// Start a new game from the initial array.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Game {
        install_panic_hook();
        Game {
            pos: Position::new(),
            start_fen: START_FEN.to_string(),
            moves: Vec::new(),
            repeat_limit: DEFAULT_REPEAT_LIMIT,
            repeat_decisive: true,
        }
    }

    /// Start from an arbitrary FEN, for puzzles and tests.
    #[wasm_bindgen(js_name = fromFen)]
    pub fn from_fen(fen: &str) -> Result<Game, JsValue> {
        install_panic_hook();
        let pos = Position::from_fen(fen).map_err(err)?;
        Ok(Game {
            pos,
            start_fen: fen.to_string(),
            moves: Vec::new(),
            repeat_limit: DEFAULT_REPEAT_LIMIT,
            repeat_decisive: true,
        })
    }

    /// Rebuild a game by replaying `moves` (space-separated ICCS) from
    /// `start_fen`. This is how a saved game is loaded and how the worker
    /// reconstructs the position the UI is looking at.
    #[wasm_bindgen(js_name = fromMoves)]
    pub fn from_moves(start_fen: &str, moves: &str) -> Result<Game, JsValue> {
        let mut game = Game::from_fen(start_fen)?;
        for token in moves.split_whitespace() {
            game.play(token)?;
        }
        Ok(game)
    }

    /// How the repetition rules apply to this game.
    ///
    /// `limit` is how often a position must recur before they bite; `decisive`
    /// says whether a repetition can lose the game or merely draw it. Turning
    /// `decisive` off does not remove the rule — a game still has to end — it
    /// stops the rule from picking a loser.
    #[wasm_bindgen(js_name = setRepetitionRule)]
    pub fn set_repetition_rule(&mut self, limit: usize, decisive: bool) {
        self.repeat_limit = limit.max(2);
        self.repeat_decisive = decisive;
    }

    /// The repetition verdict for this game, if the rules have anything to say.
    fn repetition_verdict(&mut self) -> Option<RepKind> {
        let kind = self.pos.repetition()?;
        if self.pos.repetition_occurrences() < self.repeat_limit {
            return None;
        }
        if !self.repeat_decisive {
            return Some(RepKind::Draw);
        }
        Some(kind)
    }

    /// Current position in FEN.
    pub fn fen(&self) -> String {
        self.pos.to_fen()
    }

    #[wasm_bindgen(js_name = startFen)]
    pub fn start_fen(&self) -> String {
        self.start_fen.clone()
    }

    /// The moves played so far, space-separated in ICCS.
    #[wasm_bindgen(js_name = movesIccs)]
    pub fn moves_iccs(&self) -> String {
        self.moves
            .iter()
            .map(|m| move_to_iccs(*m))
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// The moves played so far in Vietnamese notation.
    #[wasm_bindgen(js_name = movesText)]
    pub fn moves_text(&self) -> Result<JsValue, JsValue> {
        let text = xiangqi_engine::notation::game_to_vietnamese(&self.start_fen, &self.moves)
            .map_err(err)?;
        to_js(&text)
    }

    #[wasm_bindgen(js_name = moveCount)]
    pub fn move_count(&self) -> usize {
        self.moves.len()
    }

    /// Every piece on the board, for rendering.
    pub fn pieces(&self) -> Result<JsValue, JsValue> {
        let mut out = Vec::with_capacity(32);
        for s in xiangqi_engine::types::all_squares() {
            let pc = self.pos.board[s];
            if pc == EMPTY {
                continue;
            }
            out.push(PieceInfo {
                row: disp_row(s),
                col: disp_col(s),
                side: if side_of(pc) == RED { "r" } else { "b" },
                kind: kind_letter(pc),
                glyph: glyph_for(pc),
            });
        }
        to_js(&out)
    }

    /// Every legal move in the current position.
    #[wasm_bindgen(js_name = legalMoves)]
    pub fn legal_moves(&mut self) -> Result<JsValue, JsValue> {
        let moves = self.pos.legal_moves();
        let infos: Vec<MoveInfo> = moves.iter().map(|&m| self.describe(m)).collect();
        to_js(&infos)
    }

    fn describe(&self, m: Move) -> MoveInfo {
        let from = mv_from(m);
        let to = mv_to(m);
        MoveInfo {
            from_row: disp_row(from),
            from_col: disp_col(from),
            to_row: disp_row(to),
            to_col: disp_col(to),
            iccs: move_to_iccs(m),
            text: move_to_vietnamese(&self.pos, m),
            capture: self.pos.board[to] != EMPTY,
        }
    }

    /// Play a move given in ICCS. Returns the resulting status.
    ///
    /// Rejects anything not in the legal move list, so a bug or a tampered
    /// message in the UI cannot desynchronise the board from the rules.
    pub fn play(&mut self, iccs: &str) -> Result<JsValue, JsValue> {
        let mv = iccs_to_move(iccs).ok_or_else(|| err(format!("bad move '{iccs}'")))?;
        if !self.pos.make_move_checked(mv) {
            return Err(err(format!(
                "illegal move '{iccs}' in {}",
                self.pos.to_fen()
            )));
        }
        self.moves.push(mv);
        self.status()
    }

    /// What the last move did and what it now threatens.
    ///
    /// Returns null before the first move. This is what the commentator speaks
    /// from: it lets a line name the actual pieces on the board instead of
    /// saying something vague that would fit any position.
    #[wasm_bindgen(js_name = lastMoveReport)]
    pub fn last_move_report(&mut self) -> Result<JsValue, JsValue> {
        let Some(r) = self.pos.last_move_report() else {
            return Ok(JsValue::NULL);
        };
        to_js(&MoveReportInfo {
            mover: kind_name(r.mover),
            side: if r.mover_side == RED { "r" } else { "b" },
            captured: r.captured.map(kind_name),
            gives_check: r.gives_check,
            threats: r.threats.into_iter().map(kind_name).collect(),
            crossed_river: r.crossed_river,
            into_palace: r.into_palace,
        })
    }

    /// Take back the last move. Returns false when there is nothing to undo.
    pub fn undo(&mut self) -> bool {
        if self.moves.pop().is_some() {
            self.pos.undo_move();
            true
        } else {
            false
        }
    }

    /// Current game state, including why it ended if it has.
    pub fn status(&mut self) -> Result<JsValue, JsValue> {
        let side = self.pos.side;
        let in_check = self.pos.in_check();
        let legal = self.pos.legal_moves().len();

        // A side with no legal move loses in Xiangqi, whether or not it is in
        // check — there is no stalemate draw.
        let (status, reason) = if legal == 0 {
            let winner = if side == RED { "blackWin" } else { "redWin" };
            (winner, if in_check { "checkmate" } else { "stalemate" })
        } else if let Some(kind) = self.repetition_verdict() {
            match kind {
                RepKind::Draw => ("draw", "repetition"),
                // The perpetual checker loses.
                RepKind::WeLose(offence) => {
                    let w = if side == RED { "blackWin" } else { "redWin" };
                    (w, forcing_reason(offence))
                }
                RepKind::WeWin(offence) => {
                    let w = if side == RED { "redWin" } else { "blackWin" };
                    (w, forcing_reason(offence))
                }
            }
        } else if self.pos.is_material_draw() {
            ("draw", "insufficientMaterial")
        } else if self.pos.is_draw_by_halfmove() {
            ("draw", "sixtyMove")
        } else {
            ("playing", "")
        };

        to_js(&StatusInfo {
            status,
            reason,
            side_to_move: if side == RED { "r" } else { "b" },
            in_check,
            legal_move_count: legal,
            move_number: self.pos.move_num,
            halfmove: self.pos.halfmove,
        })
    }
}

impl Default for Game {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/// Search state that is worth keeping between moves — above all the
/// transposition table, which makes each successive search markedly faster.
#[wasm_bindgen]
pub struct Engine {
    searcher: Searcher,
    book: Book,
    experience: Experience,
}

#[wasm_bindgen]
impl Engine {
    /// `tt_mb` is the transposition-table budget in megabytes. 16 is a sensible
    /// default in a browser tab.
    #[wasm_bindgen(constructor)]
    pub fn new(tt_mb: usize) -> Engine {
        install_panic_hook();
        Engine {
            searcher: Searcher::new(tt_mb, wasm_now_ms),
            book: Book::new(),
            experience: Experience::new(),
        }
    }

    /// Forget everything learned and cached. Used when starting a fresh game
    /// at a different difficulty.
    pub fn reset(&mut self) {
        self.searcher.clear();
    }

    /// Load a previously saved experience table.
    #[wasm_bindgen(js_name = loadExperience)]
    pub fn load_experience(&mut self, text: &str) {
        self.experience = Experience::parse(text);
    }

    /// Serialize the experience table for the host to persist.
    #[wasm_bindgen(js_name = experienceText)]
    pub fn experience_text(&self) -> String {
        self.experience.serialize()
    }

    #[wasm_bindgen(js_name = experienceSize)]
    pub fn experience_size(&self) -> usize {
        self.experience.record_count()
    }

    /// Grade a finished game so future searches can learn from it.
    ///
    /// `outcome` is from `learner`'s point of view: "win", "loss" or "draw".
    /// `learner` is "r" or "b".
    pub fn learn(
        &mut self,
        start_fen: &str,
        moves: &str,
        learner: &str,
        outcome: &str,
    ) -> Result<usize, JsValue> {
        let side = if learner.eq_ignore_ascii_case("b") {
            BLACK
        } else {
            RED
        };
        let outcome = match outcome {
            "win" => Outcome::Win,
            "loss" => Outcome::Loss,
            "draw" => Outcome::Draw,
            other => return Err(err(format!("unknown outcome '{other}'"))),
        };
        let mut parsed = Vec::new();
        for token in moves.split_whitespace() {
            parsed.push(iccs_to_move(token).ok_or_else(|| err(format!("bad move '{token}'")))?);
        }
        self.experience
            .learn_game(start_fen, &parsed, side, outcome)
            .map_err(err)
    }

    /// Drop experience records backed by fewer than `min_games` games.
    #[wasm_bindgen(js_name = pruneExperience)]
    pub fn prune_experience(&mut self, min_games: u32) {
        self.experience.prune(min_games);
    }

    /// Choose a move for the side to move in `game`.
    ///
    /// `on_progress`, if given, is called once per completed iteration with the
    /// same shape as the final result. A "siêu khó" move takes five seconds;
    /// without this the interface can only show a spinner, which tells the
    /// player nothing about whether the engine is getting anywhere.
    pub fn search(
        &mut self,
        game: &Game,
        options: JsValue,
        on_progress: Option<js_sys::Function>,
    ) -> Result<JsValue, JsValue> {
        let opts: SearchOptions = if options.is_undefined() || options.is_null() {
            SearchOptions::default()
        } else {
            serde_wasm_bindgen::from_value(options).map_err(err)?
        };

        // Work on a copy so a search can never mutate the caller's game.
        let mut pos = game.pos.clone();
        let limits = SearchLimits {
            max_depth: opts.max_depth.clamp(1, 64),
            movetime_ms: opts.movetime_ms,
            randomness_cp: opts.randomness_cp.max(0),
            seed: opts.seed as u64,
        };
        let ctx = SearchContext {
            book: opts.use_book.then_some(&self.book),
            experience: opts.use_experience.then_some(&self.experience),
        };
        let source = &game.pos;
        let mut report = |partial: &xiangqi_engine::SearchResult| {
            if let Some(f) = &on_progress {
                if let Ok(payload) = to_js(&describe_search(source, partial)) {
                    // A throwing or detached callback must not abort the
                    // search that is already running.
                    let _ = f.call1(&JsValue::NULL, &payload);
                }
            }
        };
        let callback: Option<xiangqi_engine::InfoFn> = if on_progress.is_some() {
            Some(&mut report)
        } else {
            None
        };
        let r = self.searcher.search_with(&mut pos, limits, &ctx, callback);

        to_js(&describe_search(&game.pos, &r))
    }

    /// The best few moves for the side to move, best first, each with its
    /// reasons.
    ///
    /// This is what the hint offers. One move told the player what to do
    /// without saying why; three moves with scores and consequences let them
    /// compare, which is the only version of a hint anyone learns from.
    pub fn hints(&mut self, game: &Game, options: JsValue, count: usize) -> Result<JsValue, JsValue> {
        let opts: SearchOptions = if options.is_undefined() || options.is_null() {
            SearchOptions::default()
        } else {
            serde_wasm_bindgen::from_value(options).map_err(err)?
        };

        let mut pos = game.pos.clone();
        let limits = SearchLimits {
            max_depth: opts.max_depth.clamp(1, 64),
            movetime_ms: opts.movetime_ms,
            randomness_cp: 0,
            seed: opts.seed as u64,
        };
        let ctx = SearchContext {
            book: None,
            experience: opts.use_experience.then_some(&self.experience),
        };

        let ranked = self.searcher.rank_moves(&mut pos, limits, &ctx, count.clamp(1, 5));

        let mut out = Vec::with_capacity(ranked.len());
        for choice in ranked {
            // Notation has to be read off the position *before* the move, and
            // the consequences off the position after it.
            let text = move_to_vietnamese(&pos, choice.mv);
            if !pos.make_move(choice.mv) {
                continue;
            }
            let report = pos.last_move_report();
            let reply = if choice.reply == 0 {
                String::new()
            } else {
                move_to_vietnamese(&pos, choice.reply)
            };
            pos.undo_move();

            out.push(HintInfo {
                iccs: move_to_iccs(choice.mv),
                text,
                score: choice.score,
                captured: report.as_ref().and_then(|r| r.captured.map(kind_name)),
                gives_check: report.as_ref().is_some_and(|r| r.gives_check),
                threats: report
                    .as_ref()
                    .map(|r| r.threats.iter().copied().map(kind_name).collect())
                    .unwrap_or_default(),
                reply,
            });
        }

        to_js(&out)
    }
}

/// The initial array in FEN, so the UI need not hard-code it.
#[wasm_bindgen(js_name = startFen)]
pub fn start_fen() -> String {
    START_FEN.to_string()
}

/// Engine version, surfaced in the About screen and stored with saved games.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
