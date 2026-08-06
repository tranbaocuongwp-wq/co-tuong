/**
 * Decides what the commentator says, and when.
 *
 * He is an onlooker, not a participant: he never addresses anyone, and he names
 * sides by colour because he does not know or care which one the player picked.
 *
 * Each move gets up to two remarks, in order. First the **fact** — "Đỏ dùng Xe
 * ăn Pháo", built from the engine's own report so it is always true of the
 * board in front of the player. Then, sometimes, the **reaction** — what to
 * make of it. That pairing is what a broadcast sounds like, and the sequential
 * voice queue plays them back to back without either cutting the other off.
 *
 * The hard part is not choosing a line, it is choosing when to stay quiet. A
 * quiet move that takes nothing and threatens nothing is not news, and someone
 * talking through every one of them stops being company and becomes noise.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  isVoiceBusy,
  onVoiceLine,
  speak,
  speakWords,
  type Utterance,
  type VoicePriority,
} from '../audio/voice'
import type { Kind, MoveReport, SideLetter } from '../commentary/facts'
import { captureLine, checkLine, threatLine } from '../commentary/facts'
import { speakMove } from '../commentary/fragments'
import type { Line, Situation } from '../commentary/lines'
import { pickLine } from '../commentary/lines'
import type { GameStatus, Piece, SearchInfo, Side, StatusInfo } from '../engine/types'

/** How many recent lines to avoid repeating. */
const MEMORY = 12

/** Quiet moves that still earn a reaction, as a fraction. */
const IDLE_CHANCE = 0.22

/** Below this many pieces the game is an endgame worth remarking on. */
const ENDGAME_PIECES = 14

/** Centipawns past which one side is clearly better. */
const CLEAR = 250

/** Centipawns past which the assessment has moved enough to be worth calling. */
const SWING = 180

/**
 * How long a silence may run before the commentator fills it.
 *
 * A player can sit on one move for a minute, and a minute of dead air is a
 * broadcast that sounds switched off.
 */
const FILLER_MS = 13_000

/** How often the silence is checked. Cheap, and never while something is playing. */
const FILLER_TICK_MS = 2500

/** How often filler reaches for an anecdote rather than a read of the position. */
const STORY_SHARE = 0.65

export interface CommentaryInput {
  enabled: boolean
  status: StatusInfo
  pieces: Piece[]
  moveCount: number
  /** The engine's account of the move just played. */
  report: MoveReport | null
  /** The move just played, in Vietnamese notation: "Pháo 2 bình 5". */
  notation: string | null
  /** The engine's own last assessment, from its own side's point of view. */
  info: SearchInfo | null
  /** Which colour the engine plays, or null in a two-player game. */
  engineSide: Side | null
  isOver: boolean
  /** Called as each utterance is spoken, so the game can keep a record of it. */
  onSpoke?: (utterance: Utterance) => void
}

export function useCommentary(input: CommentaryInput) {
  /** The line currently being said — driven by the voice, not by this hook. */
  const [spoken, setSpoken] = useState<Utterance | null>(null)
  const recentRef = useRef<string[]>([])
  const lastMoveSeenRef = useRef(-1)
  const greetedRef = useRef(false)
  const endedRef = useRef(false)
  const prevScoreRef = useRef<number | null>(null)
  const mateCalledRef = useRef(false)
  /** When the commentator last had the microphone, for measuring the silence. */
  const lastSpokeRef = useRef(0)

  const { enabled, status, pieces, moveCount, report, notation, info, engineSide, isOver, onSpoke } =
    input

  const onSpokeRef = useRef(onSpoke)
  onSpokeRef.current = onSpoke

  // The caption follows the microphone. Setting it here instead would show a
  // line while a different one was still being spoken.
  useEffect(
    () =>
      onVoiceLine((line) => {
        setSpoken(line)
        // Both ends of a line restart the silence clock: starting one means the
        // filler must not fire, and finishing one is when the silence begins.
        lastSpokeRef.current = Date.now()
        if (line) onSpokeRef.current?.(line)
      }),
    []
  )

  const sayLine = useCallback((line: Line | null, priority: VoicePriority) => {
    if (!line) return
    recentRef.current = [line.id, ...recentRef.current].slice(0, MEMORY)
    speak(line, priority)
  }, [])

  const say = useCallback(
    (situation: Situation, priority: VoicePriority) => {
      sayLine(pickLine(situation, recentRef.current), priority)
    },
    [sayLine]
  )

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
    say(resultSituation(status.status), 'critical')
  }, [enabled, isOver, status.status, say])

  // Everything that happens mid-game.
  useEffect(() => {
    if (!enabled || isOver) return
    if (moveCount === 0 || moveCount === lastMoveSeenRef.current) return
    lastMoveSeenRef.current = moveCount

    /*
     * 1. The move itself, read out: "Đỏ: Pháo 2 bình 5".
     *
     * This is the line that makes it commentary. Everything else here is an
     * opinion about the position; this is the one thing a listener cannot get
     * any other way without looking at the board.
     */
    if (notation && report) {
      const words = speakMove(notation, report.side as SideLetter)
      if (words) {
        speakWords(`${report.side === 'r' ? 'Đỏ' : 'Đen'}: ${notation}`, words, 'event')
      }
    }

    // 2. The fact. What that move did, in the pieces' own names.
    const fact = factFor(report)
    sayLine(fact, report?.givesCheck || report?.captured ? 'critical' : 'event')

    // 3. The reaction, when there is something to react to. The two above are
    //    already queued, so this lands after them rather than on top of them.
    let swung = false
    if (info) {
      const prev = prevScoreRef.current
      prevScoreRef.current = info.score
      swung = prev !== null && Math.abs(info.score - prev) >= SWING
    }

    if (info?.mateIn !== null && info?.mateIn !== undefined && !mateCalledRef.current) {
      mateCalledRef.current = true
      say('foreseeMate', 'critical')
      return
    }

    if (status.reason === 'repetition' || status.reason === 'perpetualCheck') {
      say('repetition', 'event')
      return
    }

    if (swung) {
      say('prediction', 'event')
      return
    }

    if (moveCount <= 4) {
      say('opening', 'idle')
      return
    }

    // A position that has turned decisively, named by colour.
    const leader = leaderSituation(info, engineSide)
    if (leader) {
      say(leader, 'event')
      return
    }

    if (pieces.length <= ENDGAME_PIECES) {
      say('endgame', 'idle')
      return
    }

    // Otherwise mostly nothing. A fact was very likely already said, and a
    // commentator who fills every silence is exhausting.
    if (!fact && Math.random() < IDLE_CHANCE) say('thinking', 'idle')
  }, [
    enabled,
    isOver,
    moveCount,
    status,
    report,
    notation,
    info,
    pieces.length,
    engineSide,
    say,
    sayLine,
  ])

  /*
   * Keep the room warm.
   *
   * The only part of the commentary not driven by a move, because what it
   * reacts to is the *absence* of one. It never interrupts and never queues
   * behind anything — it speaks only into real silence.
   */
  useEffect(() => {
    if (!enabled || isOver) return
    const tick = setInterval(() => {
      if (isVoiceBusy()) return
      if (Date.now() - lastSpokeRef.current < FILLER_MS) return
      // Claim the slot before the audio is even fetched, so a slow network
      // cannot let a second filler fire on top of the first.
      lastSpokeRef.current = Date.now()
      say(fillerSituation(info, engineSide), 'idle')
    }, FILLER_TICK_MS)
    return () => clearInterval(tick)
  }, [enabled, isOver, info, engineSide, say])

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
 * The concrete remark for a move, or null when the move was quiet.
 *
 * Order is by how much a watcher would care: taking a piece beats giving check
 * beats lining one up. Only one is said — reading a list at someone is not
 * commentary.
 */
function factFor(report: MoveReport | null): Line | null {
  if (!report) return null
  const side = report.side as SideLetter
  const mover = report.mover as Kind
  if (report.captured) return captureLine(side, mover, report.captured as Kind)
  if (report.givesCheck) return checkLine(side, mover)
  if (report.threats.length > 0) return threatLine(side, mover, report.threats[0] as Kind)
  return null
}

/**
 * Which colour stands clearly better, if either does.
 *
 * The engine scores from its own side's point of view, so the score has to be
 * turned into a colour before it can be spoken about. Without an engine in the
 * game there is no assessment to report.
 */
function leaderSituation(info: SearchInfo | null, engineSide: Side | null): Situation | null {
  if (!info || engineSide === null) return null
  if (Math.abs(info.score) <= CLEAR) return null
  const engineAhead = info.score > 0
  const aheadSide = engineAhead ? engineSide : engineSide === 'r' ? 'b' : 'r'
  return aheadSide === 'r' ? 'redAhead' : 'blackAhead'
}

/**
 * What to talk about when nothing is happening.
 *
 * Mostly anecdotes, but not always: filler that never mentions the board stops
 * sounding like commentary and starts sounding like a radio left on.
 */
function fillerSituation(info: SearchInfo | null, engineSide: Side | null): Situation {
  if (Math.random() < STORY_SHARE) return 'story'
  return leaderSituation(info, engineSide) ?? (info ? 'balanced' : 'thinking')
}

function resultSituation(status: GameStatus): Situation {
  if (status === 'redWin') return 'redWin'
  if (status === 'blackWin') return 'blackWin'
  return 'draw'
}
