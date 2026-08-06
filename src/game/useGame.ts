/**
 * Game state.
 *
 * The authoritative position lives inside the WebAssembly `Game` object, not in
 * React state — that object is the only thing that knows the rules, including
 * history-dependent ones like repetition and perpetual check that a FEN cannot
 * express. React holds a *projection* of it, refreshed after every mutation.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { playMoveOutcome } from '../audio/sfx'
import type { MoveReport } from '../commentary/facts'
import { getEngineClient } from '../engine/client'
import type {
  Difficulty,
  EndReason,
  GameStatus,
  HintInfo,
  MoveInfo,
  Piece,
  SearchInfo,
  Side,
  StatusInfo,
} from '../engine/types'
import { DIFFICULTY_PRESETS } from '../engine/types'
import { loadEngineWasm, WasmGame } from '../engine/wasm'

export type GameMode = 'pve' | 'pvp'

export interface GameConfig {
  mode: GameMode
  /** Which side the human plays in `pve`. */
  playerSide: Side
  difficulty: Difficulty
}

export interface GameProjection {
  pieces: Piece[]
  legalMoves: MoveInfo[]
  status: StatusInfo
  movesIccs: string[]
  movesText: string[]
  fen: string
  startFen: string
}

export interface LastMove {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
}

/** Set when the move just played took a piece; cleared when it did not. */
export interface LastCapture {
  by: Side
}

const EMPTY_STATUS: StatusInfo = {
  status: 'playing',
  reason: '',
  sideToMove: 'r',
  inCheck: false,
  legalMoveCount: 0,
  moveNumber: 1,
  halfmove: 0,
}

/** A stable per-game seed so a replayed game makes the same book choices. */
function makeSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) + 1
}

export function useGame(config: GameConfig) {
  const gameRef = useRef<InstanceType<typeof WasmGame> | null>(null)
  const seedRef = useRef(makeSeed())
  const startedAtRef = useRef(Date.now())
  /** Guards against two searches overlapping after a fast undo or reset. */
  const searchTokenRef = useRef(0)

  const [ready, setReady] = useState(false)
  const [projection, setProjection] = useState<GameProjection>({
    pieces: [],
    legalMoves: [],
    status: EMPTY_STATUS,
    movesIccs: [],
    movesText: [],
    fen: '',
    startFen: '',
  })
  const [thinking, setThinking] = useState(false)
  const [lastInfo, setLastInfo] = useState<SearchInfo | null>(null)
  /** Live search progress, refreshed once per completed iteration. */
  const [progress, setProgress] = useState<SearchInfo | null>(null)
  const [lastMove, setLastMove] = useState<LastMove | null>(null)
  const [lastCapture, setLastCapture] = useState<LastCapture | null>(null)
  /**
   * The engine's own account of the move just played.
   *
   * Read straight from the engine rather than worked out here: which piece
   * moved, what it took, and what it now threatens are questions about the
   * rules, and the rules live in one place.
   */
  const [lastReport, setLastReport] = useState<MoveReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Set when the human resigns; the engine has no notion of resignation. */
  const [manualEnd, setManualEnd] = useState<{
    status: GameStatus
    reason: EndReason
  } | null>(null)

  const refresh = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    const iccs = game.movesIccs()
    setProjection({
      pieces: game.pieces() as Piece[],
      legalMoves: game.legalMoves() as MoveInfo[],
      status: game.status() as StatusInfo,
      movesIccs: iccs ? iccs.split(' ') : [],
      movesText: game.movesText() as string[],
      fen: game.fen(),
      startFen: game.startFen(),
    })
  }, [])

  // Create the game once the module is loaded.
  useEffect(() => {
    let cancelled = false
    loadEngineWasm()
      .then(() => {
        if (cancelled) return
        gameRef.current = new WasmGame()
        setReady(true)
        refresh()
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [refresh])

  const effectiveStatus: StatusInfo = manualEnd
    ? { ...projection.status, status: manualEnd.status, reason: manualEnd.reason }
    : projection.status

  const isOver = effectiveStatus.status !== 'playing'

  /** Whose turn it is, and whether the engine owns it. */
  const engineToMove =
    config.mode === 'pve' && !isOver && effectiveStatus.sideToMove !== config.playerSide

  const playMove = useCallback(
    (iccs: string): boolean => {
      const game = gameRef.current
      if (!game) return false
      try {
        const info = game.legalMoves().find((m: MoveInfo) => m.iccs === iccs) as
          | MoveInfo
          | undefined
        // Whose move this is has to be read before playing it.
        const mover = (game.status() as StatusInfo).sideToMove
        game.play(iccs)
        setLastCapture(info?.capture ? { by: mover } : null)
        const report = (game.lastMoveReport() as MoveReport | null) ?? null
        setLastReport(report)
        if (info) {
          setLastMove({
            fromRow: info.fromRow,
            fromCol: info.fromCol,
            toRow: info.toRow,
            toCol: info.toCol,
          })
        }

        // Read the outcome straight off the engine rather than waiting for the
        // React state to catch up — the sound should land with the move, not a
        // render later.
        const after = game.status() as StatusInfo
        const ended = after.status !== 'playing'
        const winner = after.status === 'redWin' ? 'r' : after.status === 'blackWin' ? 'b' : null
        const human = config.mode === 'pvp' ? null : config.playerSide
        playMoveOutcome({
          capture: info?.capture ?? false,
          victim: report?.captured ?? undefined,
          check: after.inCheck,
          ended,
          result: !ended
            ? undefined
            : winner === null
              ? 'draw'
              : human === null || winner === human
                ? 'win'
                : 'loss',
        })

        refresh()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return false
      }
    },
    [refresh, config.mode, config.playerSide]
  )

  // Let the engine move when it is its turn.
  useEffect(() => {
    if (!ready || !engineToMove || thinking) return
    const game = gameRef.current
    if (!game) return

    const token = ++searchTokenRef.current
    const preset = DIFFICULTY_PRESETS[config.difficulty]
    setThinking(true)
    setProgress(null)

    getEngineClient()
      .search(
        game.startFen(),
        game.movesIccs(),
        {
          ...preset.options,
          seed: seedRef.current + game.moveCount(),
        },
        (info) => {
          // Ignore progress from a search the game has already moved past.
          if (token === searchTokenRef.current) setProgress(info)
        }
      )
      .then((info) => {
        // Discard the answer if the game moved on while we were thinking —
        // after an undo or a new game, this move would apply to the wrong
        // position.
        if (token !== searchTokenRef.current) return
        setLastInfo(info)
        playMove(info.iccs)
      })
      .catch((e: unknown) => {
        if (token !== searchTokenRef.current) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (token === searchTokenRef.current) {
          setThinking(false)
          setProgress(null)
        }
      })
  }, [ready, engineToMove, thinking, config.difficulty, playMove])

  const undo = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    // Abandon any in-flight search: its result is about to be stale.
    searchTokenRef.current++
    setThinking(false)
    setManualEnd(null)
    /*
     * Go back to just before the human's own last move.
     *
     * Always taking back two plies was wrong: when the engine had not replied
     * yet — the human moves, then immediately changes their mind — it took back
     * their move *and* the engine's previous one, throwing away a whole move
     * pair and putting the board a full move further back than asked.
     *
     * So take one ply, and take a second only if that left the engine on move,
     * which means the ply just removed was the engine's reply rather than the
     * human's move.
     */
    game.undo()
    if (
      config.mode === 'pve' &&
      (game.status() as StatusInfo).sideToMove !== config.playerSide
    ) {
      game.undo()
    }
    setLastMove(null)
    setLastCapture(null)
    setLastReport(null)
    setLastInfo(null)
    refresh()
  }, [config.mode, refresh])

  const reset = useCallback(() => {
    searchTokenRef.current++
    seedRef.current = makeSeed()
    startedAtRef.current = Date.now()
    gameRef.current = new WasmGame()
    setThinking(false)
    setManualEnd(null)
    setLastMove(null)
    setLastCapture(null)
    setLastReport(null)
    setLastInfo(null)
    setError(null)
    refresh()
  }, [refresh])

  const resign = useCallback(() => {
    searchTokenRef.current++
    setThinking(false)
    const loser = config.mode === 'pve' ? config.playerSide : projection.status.sideToMove
    setManualEnd({
      status: loser === 'r' ? 'blackWin' : 'redWin',
      reason: 'resign',
    })
  }, [config.mode, config.playerSide, projection.status.sideToMove])

  /** Ask the engine for a suggestion without playing it. */
  /**
   * The best few moves for the player, best first, each with its reasons.
   *
   * Longer than the old single-move hint on purpose: this scores every legal
   * move separately, so the time buys a comparison rather than one more ply of
   * certainty about a move the player was going to be told to play anyway.
   */
  const hints = useCallback(
    async (count = 3, movetimeMs = 2_500): Promise<HintInfo[]> => {
    const game = gameRef.current
    if (!game || isOver) return []
    try {
      return await getEngineClient().hints(
        game.startFen(),
        game.movesIccs(),
        {
          maxDepth: 64,
          movetimeMs,
          useBook: false,
          useExperience: false,
          seed: seedRef.current,
        },
        count
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return []
    }
    },
    [isOver]
  )

  /**
   * Rebuild a game from a saved move list, for "continue where I left off".
   *
   * Returns false rather than raising: a save that will not replay — written by
   * an older build, or corrupted — must not strand the player on an error
   * screen with no way to start a new game. The caller discards it and plays on.
   */
  const restore = useCallback(
    (startFen: string, moves: string) => {
      try {
        searchTokenRef.current++
        gameRef.current = WasmGame.fromMoves(startFen, moves)
        setThinking(false)
        setManualEnd(null)
        setLastMove(null)
        setLastCapture(null)
        setLastReport(null)
    setLastReport(null)
        setLastInfo(null)
        refresh()
        return true
      } catch {
        return false
      }
    },
    [refresh]
  )

  return {
    ready,
    error,
    thinking,
    progress,
    lastInfo,
    lastCapture,
    lastReport,
    lastMove,
    projection,
    status: effectiveStatus,
    isOver,
    engineToMove,
    startedAt: startedAtRef.current,
    playMove,
    undo,
    reset,
    resign,
    hints,
    restore,
  }
}
