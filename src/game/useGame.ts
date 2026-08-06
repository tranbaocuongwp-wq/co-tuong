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
import { getEngineClient } from '../engine/client'
import type {
  Difficulty,
  EndReason,
  GameStatus,
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
        game.play(iccs)
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
    // Against the engine, take back the pair so the human is on move again.
    const steps = config.mode === 'pve' ? 2 : 1
    for (let i = 0; i < steps; i++) game.undo()
    setLastMove(null)
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
  const hint = useCallback(async (): Promise<SearchInfo | null> => {
    const game = gameRef.current
    if (!game || isOver) return null
    try {
      return await getEngineClient().search(game.startFen(), game.movesIccs(), {
        maxDepth: 64,
        movetimeMs: 1_000,
        useBook: false,
        useExperience: false,
        seed: seedRef.current,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [isOver])

  /** Rebuild a game from a saved move list, for "continue where I left off". */
  const restore = useCallback(
    (startFen: string, moves: string) => {
      try {
        searchTokenRef.current++
        gameRef.current = WasmGame.fromMoves(startFen, moves)
        setThinking(false)
        setManualEnd(null)
        setLastMove(null)
        setLastInfo(null)
        refresh()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
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
    hint,
    restore,
  }
}
