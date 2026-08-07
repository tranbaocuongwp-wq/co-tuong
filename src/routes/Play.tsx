/**
 * The playing screen.
 *
 * Deliberately just a board. Whose turn it is sits above it in one line, the
 * engine speaks through a single floating pill, and everything else — controls,
 * score sheet, captured pieces — is one tap away in the drawer. A five-second
 * "siêu khó" move is a long time to stare at a screen, so what is on it should
 * be the game.
 *
 * Beyond rendering it owns three things: autosaving the game after every move,
 * filing the finished game into history exactly once, and feeding the result
 * back to the engine's experience book.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { primeSounds, setSoundEnabled } from '../audio/sfx'
import { primeVoice, setVoiceMode, stopVoice } from '../audio/voice'
import { linesOf } from '../commentary/lines'
import { Board } from '../components/Board'
import { CommentaryFeed, type FeedEntry } from '../components/CommentaryFeed'
import { GameOverDialog } from '../components/GameOverDialog'
import { GameMenu } from '../components/GameMenu'
import { HintDialog } from '../components/HintDialog'
import { MatchInsight } from '../components/MatchInsight'
import { Icon } from '../components/Icon'
import { ThinkingToast } from '../components/ThinkingToast'
import { UpdateNotice } from '../components/UpdateNotice'
import { getEngineClient } from '../engine/client'
import type { HintInfo, Side } from '../engine/types'
import { DIFFICULTY_PRESETS, describeResult } from '../engine/types'
import { engineVersion } from '../engine/wasm'
import { useCommentary } from '../game/useCommentary'
import { ENGINE_MOVE_MS, MOVE_MS } from '../game/usePieceLayout'
import { useGame } from '../game/useGame'
import { useMediaQuery } from '../useMediaQuery'
import { useSettings } from '../settings'
import { getHistoryStore } from '../storage'
import { useAppUpdate } from '../update'
import type { Utterance } from '../audio/voice'
import type { AssistEntry, CommentaryEntry, GameRecord } from '../storage/types'
import { GAME_FORMAT, newGameId } from '../storage/types'

/** Key under which the experience book is persisted. */
const EXPERIENCE_KEY = 'engine.experience'

/**
 * Suggestions allowed per game.
 *
 * The engine will hand out a best move all day; a budget is what keeps the
 * hint button a lifeline rather than a way to have the computer play for you.
 * Ten is generous by design: a budget so tight that people ration it stops
 * being a safety net and becomes another thing to lose.
 */
const HINTS_PER_GAME = 10

/**
 * Take-backs allowed per game.
 *
 * Same reasoning as the hint budget: unlimited take-backs turn a loss into a
 * search for the one line that wins, and the game stops being a game.
 */
const UNDOS_PER_GAME = 10

/**
 * How long the player must be thinking before the commentator offers an opinion.
 *
 * Long enough that it reads as him filling a pause, not as the computer
 * prompting the moment a turn starts.
 */
const ADVICE_AFTER_MS = 7_000

/**
 * How long the hint search may run.
 *
 * Spent three ways now (see `rank_moves`): the engine's own search, which
 * anchors the list; a quick pass over every legal move to find the handful worth
 * thinking about; then everything left on those.
 *
 * Measured rather than guessed. Four seconds and two and a half seconds reach
 * the same depth and pick the same move — the anchor search converges well
 * before the budget runs out — so the extra second and a half was a second and a
 * half of the player watching a spinner for nothing.
 */
const HINT_MS = 2_500

/** How many entries the commentary feed keeps. Long enough to scroll back a while. */
const FEED_MAX = 60

/** How often he actually says something, once that pause has run. */
const ADVICE_CHANCE = 0.45

export function PlayPage() {
  const { settings, update } = useSettings()
  const game = useGame({
    mode: settings.mode,
    playerSide: settings.playerSide,
    difficulty: settings.difficulty,
    perpetualRule: settings.perpetualRule,
  })

  const update_ = useAppUpdate()
  const [gameId, setGameId] = useState(newGameId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hint, setHint] = useState<HintInfo | null>(null)
  const [hintChoices, setHintChoices] = useState<HintInfo[]>([])
  const [hintOpen, setHintOpen] = useState(false)
  const [hintBusy, setHintBusy] = useState(false)
  /** The option currently being shown on the board, before it is committed to. */
  const [previewIccs, setPreviewIccs] = useState<string | null>(null)
  /** Whether the result panel is up. Dismissible, so the board can be looked at. */
  const [resultOpen, setResultOpen] = useState(false)
  /** A move the commentator may hold forth about while the player thinks. */
  const [advice, setAdvice] = useState<{ hint: HintInfo; side: Side; ply: number } | null>(null)
  const [hintsLeft, setHintsLeft] = useState(HINTS_PER_GAME)
  const [undosLeft, setUndosLeft] = useState(UNDOS_PER_GAME)
  /** Hints taken and moves taken back, kept with the game. */
  const assistsRef = useRef<AssistEntry[]>([])
  const [savedNote, setSavedNote] = useState<string | null>(null)
  /** Ensures a finished game is filed once, not once per re-render. */
  const filedRef = useRef<string | null>(null)
  /** Ensures the autosaved game is picked up once, on arrival. */
  const resumedRef = useRef(false)

  const { projection, status, isOver, thinking, progress, lastInfo } = game

  /**
   * Where there is room for a written feed beside the board.
   *
   * Same breakpoint as the position chart, and for the same reason: this is
   * exactly the shape of screen that has a spare column. On a phone the board
   * needs every pixel and there is nowhere to put it.
   */
  const roomForFeed = useMediaQuery('(min-width: 700px)')

  /**
   * Off, written, or spoken.
   *
   * Turning the sound off does not turn the commentator off when there is
   * somewhere to put his remarks — he keeps watching and keeps talking, just
   * into the feed instead of the speaker.
   */
  const voiceMode = settings.voice ? 'voice' : roomForFeed ? 'silent' : 'off'

  // The voice is a module singleton, like the synthesiser, so the preference is
  // pushed to it rather than threaded through every call site.
  useEffect(() => {
    setVoiceMode(voiceMode)
    if (voiceMode === 'voice') {
      // The opening remark should not be the one that waits on the network.
      primeVoice([...linesOf('greeting'), ...linesOf('opening')])
    }
  }, [voiceMode])

  // Leaving the board should not leave a voice talking over the next screen.
  useEffect(() => stopVoice, [])

  /**
   * What the commentator said, in order, for this game.
   *
   * A ref rather than state: it is written on every spoken line and read only
   * when the game is filed, so re-rendering the board for it would be work for
   * nothing.
   */
  const commentaryRef = useRef<CommentaryEntry[]>([])
  /** The same remarks, kept for the on-screen feed. Newest first. */
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const onSpoke = useCallback((utterance: Utterance) => {
    const ply = projectionRef.current
    commentaryRef.current.push({ ply, id: utterance.id, at: Date.now() })
    setFeed((current) => [
      // Keyed by arrival rather than by line: the same remark can legitimately
      // be made twice in a game, and two rows with one key is a React bug.
      { key: `${utterance.id}-${commentaryRef.current.length}`, text: utterance.text, ply },
      ...current.slice(0, FEED_MAX - 1),
    ])
  }, [])
  const projectionRef = useRef(0)
  projectionRef.current = projection.movesIccs.length

  const { spoken: spokenLine, reset: resetCommentary } = useCommentary({
    enabled: voiceMode !== 'off',
    status,
    pieces: projection.pieces,
    moveCount: projection.movesIccs.length,
    report: game.lastReport,
    notation: projection.movesText[projection.movesText.length - 1] ?? null,
    info: lastInfo,
    // Which colour the computer has. In a two-player game there is no engine
    // and so no assessment to speak about.
    engineSide: settings.mode === 'pvp' ? null : settings.playerSide === 'r' ? 'b' : 'r',
    isOver,
    advice,
    onSpoke,
  })

  // The synthesiser is a module singleton, so the preference is pushed to it
  // rather than threaded through every call site.
  useEffect(() => {
    setSoundEnabled(settings.sound)
  }, [settings.sound])

  // Fetch and decode the samples on the first touch of the board. That is both
  // the earliest a browser will allow audio to start and well before the first
  // move needs a sound.
  useEffect(() => {
    if (!settings.sound) return
    const prime = () => primeSounds()
    window.addEventListener('pointerdown', prime, { once: true })
    return () => window.removeEventListener('pointerdown', prime)
  }, [settings.sound])
  /*
   * Ask the engine what it would play, so the commentator has an opinion.
   *
   * Only while the player is actually thinking, only after they have been
   * thinking a while, and only sometimes: advice on every turn is nagging, and
   * advice offered instantly reads as the computer playing for them.
   *
   * The budget is a fraction of the hint's, because this is a remark rather
   * than counsel — and because it must never compete with the engine's own
   * search for the machine's move.
   */
  useEffect(() => {
    if (voiceMode === 'off' || isOver || thinking || game.engineToMove) return
    const ply = projection.movesIccs.length
    if (ply === 0) return
    const timer = setTimeout(() => {
      if (Math.random() > ADVICE_CHANCE) return
      void game.hints(1, 1_500).then(([best]) => {
        if (best) setAdvice({ hint: best, side: status.sideToMove, ply })
      })
    }, ADVICE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [
    voiceMode,
    isOver,
    thinking,
    game,
    game.engineToMove,
    projection.movesIccs.length,
    status.sideToMove,
  ])

  const preset = DIFFICULTY_PRESETS[settings.difficulty]

  const record = useMemo<GameRecord>(() => {
    const humanIsRed = settings.playerSide === 'r'
    return {
      format: GAME_FORMAT,
      id: gameId,
      createdAt: game.startedAt,
      endedAt: isOver ? Date.now() : null,
      mode: settings.mode,
      redPlayer: settings.mode === 'pvp' || humanIsRed ? 'human' : 'ai',
      blackPlayer: settings.mode === 'pvp' || !humanIsRed ? 'human' : 'ai',
      difficulty: settings.mode === 'pve' ? settings.difficulty : null,
      result: isOver ? status.status : 'unfinished',
      reason: status.reason,
      startFen: projection.startFen,
      moves: projection.movesIccs.join(' '),
      finalFen: projection.fen,
      moveCount: projection.movesIccs.length,
      durationMs: Date.now() - game.startedAt,
      appVersion: engineVersion(),
      shared: false,
      commentary: commentaryRef.current.slice(),
      assists: assistsRef.current.slice(),
    }
  }, [
    gameId,
    game.startedAt,
    isOver,
    settings.mode,
    settings.playerSide,
    settings.difficulty,
    status.status,
    status.reason,
    projection,
  ])

  // Autosave the game in progress so closing the app never loses it.
  useEffect(() => {
    if (!game.ready || isOver) return
    if (projection.movesIccs.length === 0) return
    let cancelled = false
    getHistoryStore()
      .then((store) => {
        if (!cancelled) return store.saveInProgress(record)
      })
      .catch(() => {
        /* autosave is best-effort */
      })
    return () => {
      cancelled = true
    }
  }, [game.ready, isOver, projection.movesIccs.length, record])

  // File the finished game and let the engine learn from it.
  useEffect(() => {
    if (!isOver || filedRef.current === gameId) return
    if (projection.movesIccs.length === 0) return
    filedRef.current = gameId

    void (async () => {
      const store = await getHistoryStore()
      await store.saveGame(record)
      await store.saveInProgress(null)
      setSavedNote('Đã lưu ván này vào lịch sử.')

      if (!settings.learnFromGames || settings.mode !== 'pve') return
      // Learn from the *engine's* own moves, graded by how it did. Learning
      // from the human's moves would teach it to imitate them, not beat them.
      const engineSide = settings.playerSide === 'r' ? 'b' : 'r'
      const engineWon =
        (engineSide === 'r' && status.status === 'redWin') ||
        (engineSide === 'b' && status.status === 'blackWin')
      const outcome = status.status === 'draw' ? 'draw' : engineWon ? 'win' : 'loss'

      try {
        const client = getEngineClient()
        await client.learn(record.startFen, record.moves, engineSide, outcome)
        const text = await client.experienceText()
        await store.setState(EXPERIENCE_KEY, text)
      } catch {
        // Learning is an enhancement; never let it break the end of a game.
      }
    })()
  }, [isOver, gameId, record, projection.movesIccs.length, settings, status.status])

  // Pick up an unfinished game. Without this the board is saved after every
  // move but never read back, so "Chơi tiếp" silently started a new game and
  // the previous one appeared to vanish.
  useEffect(() => {
    if (!game.ready || resumedRef.current) return
    resumedRef.current = true
    void (async () => {
      try {
        const store = await getHistoryStore()
        const saved = await store.getInProgress()
        if (!saved || !saved.moves.trim()) return
        if (game.restore(saved.startFen, saved.moves)) {
          // Keep the saved game's identity so finishing it updates the same
          // history entry rather than creating a second one.
          setGameId(saved.id)
        } else {
          // The save will not replay. Drop it and let the fresh board stand —
          // far better than stranding the player on an error they cannot clear.
          await store.saveInProgress(null)
        }
      } catch {
        // A corrupt autosave should cost the resume, not the app.
      }
    })()
  }, [game.ready, game.restore])

  // Restore the engine's saved experience once per session.
  useEffect(() => {
    if (!game.ready) return
    void (async () => {
      try {
        const store = await getHistoryStore()
        const text = await store.getState(EXPERIENCE_KEY)
        if (text) await getEngineClient().loadExperience(text)
      } catch {
        /* a missing experience book just means the engine starts fresh */
      }
    })()
  }, [game.ready])

  const onNewGame = useCallback(() => {
    game.reset()
    setGameId(newGameId())
    setHint(null)
    setHintChoices([])
    setHintOpen(false)
    setPreviewIccs(null)
    setResultOpen(false)
    setFeed([])
    setSavedNote(null)
    setMenuOpen(false)
    setHintsLeft(HINTS_PER_GAME)
    setUndosLeft(UNDOS_PER_GAME)
    assistsRef.current = []
    filedRef.current = null
    stopVoice()
    resetCommentary()
    commentaryRef.current = []
    // A new game replaces the autosave; otherwise reloading would resurrect the
    // abandoned one.
    void getHistoryStore().then((store) => store.saveInProgress(null))
    void getEngineClient().reset()
  }, [game, resetCommentary])

  const onHint = useCallback(async () => {
    if (hintsLeft <= 0) return
    setMenuOpen(false)
    setHint(null)
    setHintChoices([])
    setPreviewIccs(null)
    setHintOpen(true)
    setHintBusy(true)
    try {
      const choices = await game.hints(3, HINT_MS)
      setHintChoices(choices)
      // Only spend a hint when advice actually came back.
      if (choices.length > 0) {
        setHintsLeft((n) => n - 1)
        assistsRef.current.push({
          ply: projection.movesIccs.length,
          kind: 'hint',
          iccs: choices[0].iccs,
          at: Date.now(),
        })
      }
    } finally {
      setHintBusy(false)
    }
  }, [game, hintsLeft, projection.movesIccs.length])

  /**
   * Picking an option plays it.
   *
   * An earlier version only highlighted the move and left the player to enter
   * it themselves. That is a puzzle, not help: they had already decided by
   * choosing it, and making them do it twice adds nothing but a chance to
   * misclick.
   */
  const onPickHint = useCallback(
    (iccs: string) => {
      setHint(hintChoices.find((c) => c.iccs === iccs) ?? null)
      setHintOpen(false)
      setPreviewIccs(null)
      game.playMove(iccs)
    },
    [game, hintChoices]
  )

  /**
   * The option being considered, as squares on the board.
   *
   * The threatened squares come from the engine's own report of that move, so
   * the highlight points at pieces that really would be under attack — not at
   * every piece of the right kind. With two Cannons on the board, only one of
   * them is usually in danger, and lighting up both would be a lie told in
   * colour.
   */
  const previewSquares = useMemo(() => {
    if (!previewIccs) return null
    const choice = hintChoices.find((c) => c.iccs === previewIccs)
    const move = projection.legalMoves.find((m) => m.iccs === previewIccs)
    if (!choice || !move) return null
    return {
      fromRow: move.fromRow,
      fromCol: move.fromCol,
      toRow: move.toRow,
      toCol: move.toCol,
      targets: choice.threatSquares ?? [],
    }
  }, [previewIccs, hintChoices, projection.legalMoves])

  /*
   * Raise the result panel once, when the game ends.
   *
   * Once, not whenever `isOver` is true: the player is allowed to dismiss it and
   * look at the final position, and a panel that springs back up every render
   * would make that impossible.
   */
  const announcedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isOver) {
      announcedRef.current = null
      return
    }
    if (announcedRef.current === gameId) return
    announcedRef.current = gameId
    setResultOpen(true)
  }, [isOver, gameId])

  /**
   * Take back the losing move and carry on.
   *
   * Everything the end of the game set up has to be undone with it: the panel
   * goes, and the "already filed" guard is cleared so that when this game does
   * finish it is filed again under the same id, replacing the record of the loss
   * rather than leaving it as the last word.
   */
  const onUndoAfterEnd = useCallback(() => {
    if (undosLeft <= 0) return
    assistsRef.current.push({ ply: projection.movesIccs.length, kind: 'undo', at: Date.now() })
    setUndosLeft((n) => n - 1)
    setResultOpen(false)
    setSavedNote(null)
    filedRef.current = null
    game.undo()
  }, [game, undosLeft, projection.movesIccs.length])

  /**
   * Stable across renders, so the board can be memoised.
   *
   * An inline arrow here is a new function on every render, which defeats
   * `memo` on the board entirely — and the board is the one component in this
   * screen expensive enough to be worth memoising.
   */
  const playMove = game.playMove
  const onBoardMove = useCallback(
    (iccs: string) => {
      setHint(null)
      playMove(iccs)
    },
    // `game` itself is a fresh object literal on every render, so depending on
    // it would rebuild this callback every time and defeat the whole exercise.
    // `playMove` is the stable part.
    [playMove]
  )

  const hintSquares = useMemo(() => {
    if (!hint) return null
    const m = projection.legalMoves.find((x) => x.iccs === hint.iccs)
    return m ? { fromRow: m.fromRow, fromCol: m.fromCol, toRow: m.toRow, toCol: m.toCol } : null
  }, [hint, projection.legalMoves])

  if (game.error) {
    return <div className="banner banner--error">Không khởi động được engine: {game.error}</div>
  }

  if (!game.ready) {
    return <p className="muted">Đang tải engine…</p>
  }

  const humanControls = settings.mode === 'pvp' ? null : settings.playerSide

  /**
   * How the game went *for the player*, or null when both sides are human.
   *
   * The commentator names colours because he is an onlooker; the result panel is
   * talking to the person holding the phone, and "Đen thắng" is a strange thing
   * to read when you were Black.
   */
  const outcome: 'win' | 'loss' | 'draw' | null =
    settings.mode === 'pvp' || status.status === 'playing'
      ? status.status === 'draw'
        ? 'draw'
        : null
      : status.status === 'draw'
        ? 'draw'
        : (status.status === 'redWin') === (settings.playerSide === 'r')
          ? 'win'
          : 'loss'
  const boardDisabled = isOver || thinking || game.engineToMove

  // Reloading is free when the game is over, has not started, or is simply
  // waiting on the human. It is not free while the engine is mid-search.
  const safeToUpdate = isOver || projection.movesIccs.length === 0 || (!thinking && !game.engineToMove)

  return (
    <div className="stage">
      <UpdateNotice
        available={update_.available}
        kind={update_.kind}
        safeToApply={safeToUpdate}
        canAutoApply={update_.canAutoApply}
        onApply={update_.apply}
      />
      <div className="stage__bar">
        {/*
          Leaving a game in progress must be one tap, not a tap into a drawer.
          The autosave means nothing is lost by going, so the button does not
          need to warn or confirm — it just goes.
        */}
        <Link className="icon-btn icon-btn--menu" to="/" aria-label="Về trang chủ">
          <Icon name="home" size={19} />
        </Link>
        <span className="turn">
          <span className={`dot dot--${status.sideToMove}`} />
          {isOver ? (
            <strong>{describeResult(status.status, status.reason)}</strong>
          ) : (
            <>
              {status.sideToMove === 'r' ? 'Đỏ' : 'Đen'} đi
              {status.inCheck && <strong className="badge badge--alarm">Chiếu tướng!</strong>}
            </>
          )}
        </span>
        <button
          type="button"
          className="icon-btn icon-btn--menu"
          onClick={() => setMenuOpen(true)}
          aria-label="Mở bảng điều khiển"
        >
          <Icon name="menu" size={20} />
        </button>
      </div>

      <div className={status.inCheck && !isOver ? 'stage__board stage__board--check' : 'stage__board'}>
        <Board
          pieces={projection.pieces}
          legalMoves={projection.legalMoves}
          sideToMove={status.sideToMove}
          controllable={humanControls}
          onMove={onBoardMove}
          lastMove={game.lastMove}
          flipped={settings.flipped}
          inCheck={status.inCheck}
          disabled={boardDisabled}
          hint={settings.showHints ? hintSquares : null}
          preview={previewSquares}
          moveMs={
            // The computer's replies play out slowly enough to follow. The
            // player's own moves do not need it: they already know what moved.
            game.lastReport && game.lastReport.side !== settings.playerSide
              ? ENGINE_MOVE_MS
              : MOVE_MS
          }
        />

        {/*
          Inside the board rather than pinned to the window, so it lands on the
          river whatever the screen is doing — phone, tablet, held sideways.
        */}
        <ThinkingToast
          visible={thinking || hintBusy}
          progress={progress}
          label={hintBusy ? 'Đang tìm gợi ý' : undefined}
        />

        {/*
          Check, said loudly.
          
          A small grey badge in the status line was technically an announcement
          and practically invisible — a player concentrating on the board simply
          did not see it, and losing to a check you were never told about feels
          like the app cheated. This sits on the board itself, where the eyes
          already are.
        */}
        {status.inCheck && !isOver && (
          <div className="flare" role="alert">
            <span className="flare__text">
              {status.sideToMove === 'r' ? 'Đỏ' : 'Đen'} đang bị chiếu tướng
            </span>
          </div>
        )}
      </div>

      <MatchInsight
        info={lastInfo}
        engineSide={settings.mode === 'pvp' ? null : settings.playerSide === 'r' ? 'b' : 'r'}
        pieces={projection.pieces}
        moveCount={projection.movesIccs.length}
      />

      {settings.voice && !isOver && (
        <div className="commentary" role="status">
          <Icon name="speaker" size={15} />
          <span className="commentary__text">{spokenLine?.text ?? ''}</span>
        </div>
      )}

      {/*
        With the sound off but room to spare, the commentary becomes a feed.
        Same remarks, same pacing, no audio — see `CommentaryFeed`.
      */}
      {voiceMode === 'silent' && <CommentaryFeed entries={feed} />}

      {isOver && !resultOpen && (
        <div className="stage__end card">
          <strong>{describeResult(status.status, status.reason)}</strong>
          {savedNote && <div className="muted">{savedNote}</div>}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn--primary" onClick={() => setResultOpen(true)}>
              Kết quả
            </button>
            <Link className="btn" to="/history">
              Xem lịch sử
            </Link>
          </div>
        </div>
      )}

      <GameOverDialog
        open={isOver && resultOpen}
        headline={describeResult(status.status, status.reason)}
        outcome={outcome}
        undosLeft={undosLeft}
        canUndo={projection.movesIccs.length > 0}
        reviewHref={savedNote ? `/review/${gameId}` : null}
        onUndo={onUndoAfterEnd}
        onNewGame={onNewGame}
        onClose={() => setResultOpen(false)}
      />

      {hint && !isOver && (
        <p className="stage__hint muted">
          Gợi ý: <strong>{hint.text ?? hint.iccs}</strong> · còn {hintsLeft} lượt
        </p>
      )}

      <HintDialog
        open={hintOpen}
        busy={hintBusy}
        choices={hintChoices}
        previewing={previewIccs}
        onPreview={setPreviewIccs}
        onPick={onPickHint}
        onClose={() => {
          setHintOpen(false)
          setPreviewIccs(null)
        }}
      />

      <GameMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        moves={projection.movesText}
        pieces={projection.pieces}
        info={lastInfo}
        difficultyLabel={settings.mode === 'pve' ? preset.label : null}
        canUndo={projection.movesIccs.length > 0 && undosLeft > 0}
        isOver={isOver}
        busy={thinking || hintBusy}
        hintsLeft={hintsLeft}
        voiceOn={settings.voice}
        onToggleVoice={() => {
          const next = !settings.voice
          update({ voice: next })
          if (!next) stopVoice()
        }}
        onNewGame={onNewGame}
        undosLeft={undosLeft}
        onUndo={() => {
          if (undosLeft <= 0) return
          assistsRef.current.push({
            ply: projection.movesIccs.length,
            kind: 'undo',
            at: Date.now(),
          })
          setUndosLeft((n) => n - 1)
          game.undo()
          setMenuOpen(false)
        }}
        onHint={onHint}
        onFlip={() => update({ flipped: !settings.flipped })}
        onResign={() => {
          game.resign()
          setMenuOpen(false)
        }}
      />
    </div>
  )
}
