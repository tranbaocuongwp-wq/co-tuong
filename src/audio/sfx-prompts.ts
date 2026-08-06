/**
 * What every sound effect in the game is a recording of.
 *
 * Kept here, in one list, because three things need to agree on it: the Worker
 * that generates the audio, the script that downloads it into the repository,
 * and the player that reaches for it by name. A copy in each would drift, and
 * the failure would be a silent board rather than an error.
 *
 * Prompts are written as physical descriptions rather than moods. The model
 * gives a far more usable sample from "wooden disc on a hardwood board" than
 * from "a nice move sound". Durations are short on purpose: these play on every
 * move, and anything with a tail is irritating by the tenth repetition.
 */

export interface SfxPrompt {
  id: string
  /** Requested length in seconds. The API's floor is 0.5. */
  seconds: number
  prompt: string
}

export const SFX_PROMPTS: SfxPrompt[] = [
  {
    id: 'move',
    seconds: 0.6,
    prompt:
      'A single crisp wooden click: a small polished wood disc placed firmly ' +
      'on a hardwood board. Dry, close-miked, no reverb, no music. One hit only.',
  },
  {
    id: 'capture',
    seconds: 0.9,
    prompt:
      'A wooden chess piece knocked aside by another and landing: one solid ' +
      'low wooden thud immediately followed by a lighter wooden clatter. ' +
      'Dry, close-miked, no reverb, no music.',
  },
  {
    id: 'select',
    // The API's floor is 0.5s; the tick itself is far shorter and the tail is
    // silence, which costs nothing.
    seconds: 0.5,
    prompt:
      'A very short, light wooden tick: a fingernail tapping a small wood ' +
      'disc. Quiet, dry, no reverb, no music. One tick only.',
  },
  {
    id: 'check',
    seconds: 1.6,
    prompt:
      'A hand-struck iron alarm gong: one sharp bright metallic strike with a ' +
      'short ringing decay, urgent, like a watchman raising the alarm. ' +
      'Traditional Chinese percussion. No music, no other instruments.',
  },
  {
    id: 'win',
    seconds: 2.2,
    prompt:
      'A short triumphant flourish on a traditional Chinese gong and small ' +
      'cymbal, rising and confident. Two seconds, ending cleanly.',
  },
  {
    id: 'loss',
    seconds: 2.2,
    prompt:
      'A single deep, sombre bronze gong struck once and allowed to fade. ' +
      'Low and final. No music.',
  },
  {
    id: 'draw',
    seconds: 1.8,
    prompt:
      'A soft neutral wood block struck twice, evenly, unhurried. Dry, no ' +
      'reverb, no music.',
  },

  /*
   * A capture, by what was taken.
   *
   * A Horse falling should not sound like a Pawn falling. Which piece came off
   * the board is the most interesting thing about a capture, and the ear picks
   * that up without the player having to look — so the sound carries it.
   *
   * The victim rather than the attacker: this is the sound of something being
   * struck, and it is the struck thing that cries out.
   *
   * Each still ends in wood on wood. Without that they stop belonging to the
   * same board and start sounding like a zoo.
   */
  {
    id: 'cap-h',
    seconds: 1.2,
    prompt:
      "A horse's short startled whinny, close and dry, immediately followed " +
      'by one solid wooden thud. No reverb, no music.',
  },
  {
    id: 'cap-e',
    seconds: 1.4,
    prompt:
      'A short low elephant trumpet call, close and dry, immediately followed ' +
      'by one heavy wooden thud. No reverb, no music.',
  },
  {
    id: 'cap-r',
    seconds: 1,
    prompt:
      'A heavy wooden cart wheel jolting to a stop, ending in one solid low ' +
      'wooden crash. Dry, close-miked, no reverb, no music.',
  },
  {
    id: 'cap-c',
    seconds: 1.2,
    prompt:
      'One short muffled cannon report, distant and dry, immediately followed ' +
      'by a wooden thud. No reverb, no music.',
  },
  {
    id: 'cap-a',
    seconds: 0.8,
    prompt:
      'A soft cloth rustle and one light wooden tap, quiet and dry. No ' +
      'reverb, no music.',
  },
  {
    id: 'cap-p',
    seconds: 0.7,
    prompt:
      'One light wooden tap followed by a small wooden clatter, quiet and ' +
      'dry. One hit only. No reverb, no music.',
  },
]

export const SFX_IDS: string[] = SFX_PROMPTS.map((s) => s.id)
