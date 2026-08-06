/**
 * Decides what the commentator says, and when.
 *
 * Reads the same game state the board does and picks a situation from it. The
 * hard part is not choosing a line — it is choosing *when to stay quiet*.
 * Someone talking over every single move stops being company and becomes noise,
 * so ordinary moves are passed over and only the moments that would make a real
 * commentator lean forward get a remark.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { isVoiceBusy, onVoiceLine, speak, type VoicePriority } from '../audio/voice'
import type { Line, Situation } from '../commentary/lines'
import { pickLine } from '../commentary/lines'
import type { GameStatus, Piece, SearchInfo, Side, StatusInfo } from '../engine/types'

/** How many recent lines to avoid repeating. */
const MEMORY = 12

/** Quiet moves worth commenting on, as a fraction. */
const IDLE_CHANCE = 0.28

/** Below this many pieces the game is an endgame worth remarking on. */
const ENDGAME_PIECES = 14

/** Centipawns that count as "in real trouble". */
const TROUBLE = 350

/**
 * How far the assessment must move between turns before it is worth calling.
 *
 * A real commentator predicts when they have actually seen something change,
 * not on a timer. The engine's own evaluation swinging by more than a piece is
 * exactly that moment, so the prediction is grounded in something real rather
 * than sprinkled at random.
 */
const SWING = 180

/**
 * How long a silence may run before the commentator fills it.
 *
 * A player can sit on one move for a minute, and dead air for a minute is what
 * makes a broadcast feel switched off. So when nothing has been said for this
 * long the commentator reaches for something else to talk about — a scrap of
 * chess history, a memory of some roadside chess house — the way a real
 * commentator does while waiting for a hand to move.
 */
const FILLER_MS = 13_000

/** How often the silence is checked. Cheap, and never while something is playing. */
const FILLER_TICK_MS = 2500

/** How often filler reaches for an anecdote rather than a read of the position. */
const STORY_SHARE = 0.65

/** Evaluation past which the filler comments on who stands better. */
const LEANING = 120

export interface CommentaryInput {
  enabled: boolean
  status: StatusInfo
  pieces: Piece[]
  moveCount: number
  /** Whether the move just played took a piece, and who played it. */
  lastCapture: { by: Side } | null
  /** The engine's own last assessment; positive means the engine is ahead. */
  info: SearchInfo | null
  /** Which side the human plays, or null in a two-player game. */
  playerSide: Side | null
  isOver: boolean
}

export function useCommentary(input: CommentaryInput) {
  /** The line currently being said — driven by the voice, not by this hook. */
  const [spoken, setSpoken] = useState<Line | null>(null)
  const recentRef = useRef<string[]>([])
  const lastMoveSeenRef = useRef(-1)
  const greetedRef = useRef(false)
  const endedRef = useRef(false)
  const prevScoreRef = useRef<number | null>(null)
  const mateCalledRef = useRef(false)
  /** When the commentator last had the microphone, for measuring the silence. */
  const lastSpokeRef = useRef(0)

  // The caption follows the microphone. Setting it here instead would show a
  // line while a different one was still being spoken.
  useEffect(
    () =>
      onVoiceLine((line) => {
        setSpoken(line)
        // Both ends of a line restart the silence clock: starting one means the
        // filler must not fire, and finishing one is when the silence begins.
        lastSpokeRef.current = Date.now()
      }),
    []
  )

  const say = useCallback((situation: Situation, priority: VoicePriority) => {
    const line = pickLine(situation, recentRef.current)
    if (!line) return
    recentRef.current = [line.id, ...recentRef.current].slice(0, MEMORY)
    speak(line, priority)
  }, [])

  const { enabled, status, pieces, moveCount, lastCapture, info, playerSide, isOver } = input

  // Take a seat as the game begins.
  useEffect(() => {
    if (!enabled || greetedRef.current) return
    if (moveCount > 0) {
      // Joined a game already in progress; no point announcing the start.
      greetedRef.current = true
      return
    }
    greetedRef.current = true
    say('greeting', 'event')
  }, [enabled, moveCount, say])

  // The result, which always gets said.
  useEffect(() => {
    if (!enabled || !isOver || endedRef.current) return
    endedRef.current = true
    say(resultSituation(status.status, playerSide), 'critical')
  }, [enabled, isOver, status.status, playerSide, say])

  // Everything that happens mid-game.
  useEffect(() => {
    if (!enabled || isOver) return
    if (moveCount === 0 || moveCount === lastMoveSeenRef.current) return
    lastMoveSeenRef.current = moveCount

    // The player's king is in check, or the computer's — either is worth a word.
    if (status.inCheck) {
      const humanInCheck = playerSide !== null && status.sideToMove === playerSide
      say(humanInCheck ? 'playerCheck' : 'engineCheck', 'critical')
      return
    }

    if (status.reason === 'repetition' || status.reason === 'perpetualCheck') {
      say('repetition', 'event')
      return
    }

    // A forced mate is the strongest thing a commentator can announce, and it
    // only gets announced once.
    if (info?.mateIn !== null && info?.mateIn !== undefined && !mateCalledRef.current) {
      mateCalledRef.current = true
      say('foreseeMate', 'critical')
      return
    }

    if (lastCapture) {
      const byHuman = playerSide !== null && lastCapture.by === playerSide
      say(byHuman ? 'playerCapture' : 'engineCapture', 'event')
      return
    }

    // The assessment has moved sharply: call what it means.
    if (info) {
      const prev = prevScoreRef.current
      prevScoreRef.current = info.score
      if (prev !== null && Math.abs(info.score - prev) >= SWING) {
        say('prediction', 'event')
        return
      }
    }

    // The opening, once.
    if (moveCount <= 4) {
      say('opening', 'idle')
      return
    }

    // A position that has turned decisively.
    if (info && Math.abs(info.score) > TROUBLE) {
      const engineAhead = info.score > 0
      const humanLosing = playerSide !== null && engineAhead
      say(humanLosing ? 'playerLosing' : 'engineLosing', 'event')
      return
    }

    if (pieces.length <= ENDGAME_PIECES) {
      say('endgame', 'idle')
      return
    }

    // Otherwise, mostly say nothing. A commentator who fills every silence is
    // exhausting; the occasional unprompted remark is what makes them feel
    // present rather than scripted.
    if (Math.random() < IDLE_CHANCE) say('thinking', 'idle')
  }, [enabled, isOver, moveCount, status, lastCapture, info, pieces.length, playerSide, say])

  /*
   * Keep the room warm.
   *
   * This is the only part of the commentary not driven by a move, because the
   * thing it reacts to is the *absence* of one. It never interrupts and never
   * queues behind anything — it speaks only into real silence.
   */
  useEffect(() => {
    if (!enabled || isOver) return
    const tick = setInterval(() => {
      if (isVoiceBusy()) return
      if (Date.now() - lastSpokeRef.current < FILLER_MS) return
      // Claim the slot before the audio is even fetched, so a slow network
      // cannot let a second filler fire on top of the first.
      lastSpokeRef.current = Date.now()
      say(fillerSituation(info), 'idle')
    }, FILLER_TICK_MS)
    return () => clearInterval(tick)
  }, [enabled, isOver, info, say])

  // Reset when a new game starts.
  const reset = useCallback(() => {
    lastMoveSeenRef.current = -1
    greetedRef.current = false
    endedRef.current = false
    prevScoreRef.current = null
    mateCalledRef.current = false
    recentRef.current = []
    lastSpokeRef.current = Date.now()
    setSpoken(null)
  }, [])

  return { spoken, reset }
}

/**
 * What to talk about when nothing is happening.
 *
 * Mostly anecdotes, but not always: a filler that never mentions the board
 * stops sounding like commentary and starts sounding like a radio left on. The
 * occasional read of who stands better keeps it tied to the game in front of it.
 */
function fillerSituation(info: SearchInfo | null): Situation {
  if (Math.random() < STORY_SHARE) return 'story'
  if (info && info.mateIn !== null && info.mateIn !== undefined) return 'thinkingMate'
  if (info && info.score > LEANING) return 'thinkingAhead'
  if (info && info.score < -LEANING) return 'thinkingBehind'
  return 'thinking'
}

function resultSituation(status: GameStatus, playerSide: Side | null): Situation {
  if (status === 'draw') return 'draw'
  if (playerSide === null) return 'draw'
  const humanWon =
    (playerSide === 'r' && status === 'redWin') || (playerSide === 'b' && status === 'blackWin')
  return humanWon ? 'playerWin' : 'playerLose'
}
