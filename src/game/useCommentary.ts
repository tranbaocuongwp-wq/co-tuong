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
  stopVoice,
  type Utterance,
  type VoicePriority,
} from '../audio/voice'
import { adviceLead, adviceReason } from '../commentary/advice'
import type { Kind, MoveReport, SideLetter } from '../commentary/facts'
import { foresightLine, readAhead } from '../commentary/foresight'
import {
  endgameLine,
  matchupLine,
  readEndgame,
  readMatchup,
  readShape,
  shapeLine,
} from '../commentary/shape'
import {
  actionOf,
  captureLine,
  checkLine,
  formationLine,
  kindOfNotation,
  moveLines,
  palaceLine,
  riverLine,
  threatLine,
} from '../commentary/facts'
import type { Line, Situation } from '../commentary/lines'
import { pickLine } from '../commentary/lines'
import type { GameStatus, HintInfo, Piece, SearchInfo, Side, StatusInfo } from '../engine/types'

/**
 * How many recent lines to avoid repeating.
 *
 * Deep on purpose. A pool of twelve with a memory of twelve is not "no repeats
 * for twelve lines" — it is no *immediate* repeats, and a fair pick still lands
 * on the same line often enough that a listener notices. The memory now runs
 * wider than most pools, so a situation genuinely exhausts its lines before any
 * of them comes round again.
 */
const MEMORY = 30

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
const FILLER_MS = 5_000

/** How often the silence is checked. Cheap, and never while something is playing. */
const FILLER_TICK_MS = 1200

/** How often filler reaches for an anecdote rather than a read of the position. */
const STORY_SHARE = 0.5

/**
 * How often a move gets the long view instead of a stock reaction.
 *
 * Low on purpose. Reading the engine's line out after every move would be both
 * exhausting and misleading: a principal variation is a best guess, and one
 * offered constantly starts to sound like a promise. Held back, it lands as the
 * thing a good pundit does once or twice a game -- look up from the move and say
 * where all of this is going.
 */
const FORESIGHT_CHANCE = 0.22

/** How often the commentator names the formation rather than reacting to a move. */
const SHAPE_CHANCE = 0.3

/**
 * Moves between two formation readings.
 *
 * The shape of a position changes slowly, so naming it every move would be
 * saying the same true thing over and over, which is exactly the complaint these
 * pools were widened to fix.
 */
const SHAPE_GAP = 6

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
  /**
   * A move the commentator may offer an opinion about, while the player thinks.
   *
   * Null most of the time: an opinion on every turn stops being an opinion.
   */
  advice: { hint: HintInfo; side: Side; ply: number } | null
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
  /** Ply of the last formation reading, and what it was, so it is not repeated. */
  const lastShapeRef = useRef({ ply: -SHAPE_GAP, name: '' })

  const {
    enabled,
    status,
    pieces,
    moveCount,
    report,
    notation,
    info,
    engineSide,
    isOver,
    advice,
    onSpoke,
  } = input

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

  /*
   * The result, and then nothing.
   *
   * The queue is cleared first so remarks about a position that no longer
   * exists cannot trail out over the result. A game that has just been lost is
   * exactly the wrong moment to still be chattering about the middlegame, and
   * tacking on more after the verdict makes the commentator sound like he did
   * not notice it was over.
   */
  useEffect(() => {
    if (!enabled || !isOver || endedRef.current) return
    endedRef.current = true
    stopVoice()
    say(resultSituation(status.status), 'critical')
  }, [enabled, isOver, status.status, say])

  // Everything that happens mid-game.
  useEffect(() => {
    if (!enabled || isOver) return
    if (moveCount === 0 || moveCount === lastMoveSeenRef.current) return
    lastMoveSeenRef.current = moveCount

    /*
     * 1. The move, described. Every move gets one — that is what a broadcast
     *    does, and it is the only thing a listener cannot get without looking
     *    at the board.
     */
    const fact = factFor(report, notation, recentRef.current)
    sayLine(fact, report?.givesCheck || report?.captured ? 'critical' : 'event')

    /*
     * The shape it made, named.
     *
     * Said as a second sentence rather than folded into the first: "pháo đầu"
     * is a different observation from "the cannon moved", and running them
     * together would bury the one a player actually learns from.
     */
    if (report?.formation) {
      sayLine(formationLine(report.side as SideLetter, report.formation), 'critical')
    }

    /*
     * The long view, read out of the engine's own principal variation.
     *
     * This is the only thing the commentator says that is not already on the
     * board, and it is the reason he is worth having: he is not describing the
     * move, he is describing where the move leads. Every word of it comes from
     * the line the engine actually intends to play, walked forward over the real
     * position -- see `foresight.ts`. Nothing here is invented.
     */
    if (info?.pv && info.pv.length > 2 && Math.random() < FORESIGHT_CHANCE) {
      sayLine(foresightLine(readAhead(pieces, status.sideToMove as SideLetter, info.pv)), 'event')
    }

    /*
     * What the whole army is doing, named.
     *
     * "Pháo đầu đối bình phong mã" says more about a position than any sentence
     * about a single piece can, and it is the vocabulary a player needs in order
     * to read a game rather than just watch one.
     */
    if (moveCount - lastShapeRef.current.ply >= SHAPE_GAP && Math.random() < SHAPE_CHANCE) {
      const said = sayShape(pieces, moveCount, lastShapeRef.current.name)
      if (said) {
        lastShapeRef.current = { ply: moveCount, name: said.name }
        sayLine(said.line, 'event')
      }
    }

    // 2. The reaction, when there is something to react to. The line above is
    //    already queued, so this lands after it rather than on top of it.
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

  /*
   * The commentator's own opinion, offered while the player is still deciding.
   *
   * Three utterances in a row — a lead-in, the move read out, and the reason —
   * which the queue plays back to back as one thought. Said once per position;
   * repeating it would turn a remark into nagging.
   */
  const advisedRef = useRef(-1)
  useEffect(() => {
    if (!enabled || isOver || !advice) return
    if (advisedRef.current === advice.ply) return
    advisedRef.current = advice.ply

    /*
     * The exact move is on screen; the voice describes it.
     *
     * Naming an arbitrary move aloud would mean stitching recorded words back
     * together, which is what made the old move-reading sound like a machine.
     * A sentence about the piece and the direction points at it well enough,
     * and the caption carries the precise notation for anyone who wants it.
     */
    const mover = kindOfNotation(advice.hint.text)
    if (!mover) return
    const said = moveLines(advice.side as SideLetter, mover, actionOf(advice.hint.text))
    if (said.length === 0) return

    sayLine(adviceLead(recentRef.current), 'idle')
    sayLine(said[Math.floor(Math.random() * said.length)], 'idle')
    sayLine(adviceReason(advice.hint), 'idle')
  }, [enabled, isOver, advice, sayLine])

  // Reset when a new game starts.
  const reset = useCallback(() => {
    lastMoveSeenRef.current = -1
    greetedRef.current = false
    endedRef.current = false
    prevScoreRef.current = null
    mateCalledRef.current = false
    recentRef.current = []
    lastShapeRef.current = { ply: -SHAPE_GAP, name: '' }
    advisedRef.current = -1
    lastSpokeRef.current = Date.now()
    setSpoken(null)
  }, [])

  return { spoken, reset }
}

/**
 * What to say about the move that was just played.
 *
 * Ordered by how much a watcher would care: taking a piece beats giving check,
 * beats reaching the palace door, beats crossing the river, beats lining
 * something up, beats simply describing the move. Only one is said — reading a
 * list of consequences at someone is not commentary.
 *
 * A quiet move still gets a sentence. Silence on ordinary moves is what made an
 * earlier version feel like it only woke up for captures.
 */
function factFor(
  report: MoveReport | null,
  notation: string | null,
  recent: readonly string[]
): Line | null {
  if (!report) return null
  const side = report.side as SideLetter
  const mover = report.mover as Kind

  if (report.captured) return captureLine(side, mover, report.captured as Kind)
  if (report.givesCheck) return checkLine(side, mover)
  if (report.intoPalace) return palaceLine(side, mover)
  if (report.crossedRiver && mover === 'p') return riverLine(side, mover)
  if (report.threats.length > 0) return threatLine(side, mover, report.threats[0] as Kind)

  // Plain move: describe it, preferring a phrasing not just used.
  const options = moveLines(side, mover, actionOf(notation ?? ''))
  if (options.length === 0) return null
  const fresh = options.filter((l) => !recent.includes(l.id))
  const pool = fresh.length > 0 ? fresh : options
  return pool[Math.floor(Math.random() * pool.length)]
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

/**
 * The best formation reading available, or null.
 *
 * A named pairing beats one side's shape, which beats a material reading: the
 * pairing tells a listener the most about what kind of game they are watching.
 * Whatever was said last time is skipped, so a slowly-changing position does not
 * produce the same observation twice.
 */
function sayShape(
  pieces: Piece[],
  moveCount: number,
  last: string
): { name: string; line: Line } | null {
  const matchup = readMatchup(pieces)
  if (matchup && matchup !== last) return { name: matchup, line: matchupLine(matchup) }

  for (const side of ['r', 'b'] as SideLetter[]) {
    const shape = readShape(pieces, side, moveCount)
    if (shape && `${side}:${shape}` !== last) {
      return { name: `${side}:${shape}`, line: shapeLine(side, shape) }
    }
  }

  for (const side of ['r', 'b'] as SideLetter[]) {
    const end = readEndgame(pieces, side)
    if (end && `${side}:${end}` !== last) {
      return { name: `${side}:${end}`, line: endgameLine(side, end) }
    }
  }

  return null
}

function resultSituation(status: GameStatus): Situation {
  if (status === 'redWin') return 'redWin'
  if (status === 'blackWin') return 'blackWin'
  return 'draw'
}
