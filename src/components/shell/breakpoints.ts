/**
 * The three sizes this app has, and the one orientation question.
 *
 * `700px` was already the app's real breakpoint — it decides whether the play
 * screen is one column or two (`styles.css`), whether a sheet is a sheet or a
 * centred dialog (`sheet.tsx`, six times), and whether the readings panel is
 * drawn at all (`Play.tsx`). It was written out by hand in every one of those
 * places, so moving it meant finding them all.
 *
 * Two axes rather than one, because width alone gets the board wrong. A phone
 * turned sideways is 812px wide and 375px tall: wide enough for two columns by
 * any width rule, and far too short to put anything under the board. Every
 * layout decision on the play screen has to ask both questions.
 */

/** Phone, held either way. One column, navigation at the bottom. */
export const COMPACT = '(max-width: 699px)'

/** Tablet, or a small window. A rail, and a panel that can be folded away. */
export const MEDIUM = '(min-width: 700px) and (max-width: 1023px)'

/** Desktop, or a tablet in landscape. Rail and panel both permanent. */
export const EXPANDED = '(min-width: 1024px)'

/** Anything at least 700px wide — medium and expanded together. */
export const ROOMY = '(min-width: 700px)'

/** Wider than tall. Decides whether the panel sits beside the board or under it. */
export const LANDSCAPE = '(orientation: landscape)'

export type ShellSize = 'compact' | 'medium' | 'expanded'
