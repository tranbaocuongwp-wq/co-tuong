/**
 * The moment the game ends, said properly.
 *
 * It used to be a small card below the board saying "chiếu bí". Correct, and
 * completely inadequate for the thing it is reporting: the game just ended, and
 * on a phone that card could be off the bottom of the screen entirely. A player
 * would sit there wondering why the board had stopped responding.
 *
 * So it is a panel over the board, and it answers the three questions somebody
 * actually has at that moment, in that order: what happened, can I take that
 * back, and can I look at it again.
 *
 * The take-back is the important one. Losing to a single blunder and being
 * offered nothing but "Ván mới" is what makes people put a chess app down — the
 * game they wanted was the one they were already playing. So if they still have
 * take-backs in hand, the button is right there, and it is the primary action.
 */

import { Link } from 'react-router'

import { Icon } from './Icon'

export interface GameOverDialogProps {
  open: boolean
  /** "Chiếu bí", "Hoà cờ" … the reason, already in words. */
  headline: string
  /**
   * How it went for the player, or null in a two-player game where there is no
   * "you". Decides the tone, and nothing else.
   */
  outcome: 'win' | 'loss' | 'draw' | null
  /** Take-backs left. Zero hides the offer rather than showing a dead button. */
  undosLeft: number
  /** False when there is nothing to take back — a resignation on move one. */
  canUndo: boolean
  /** Where the replay lives, once the game has been filed. Null until then. */
  reviewHref: string | null
  onUndo: () => void
  onNewGame: () => void
  onClose: () => void
}

const TITLE: Record<'win' | 'loss' | 'draw', string> = {
  win: 'Bạn thắng rồi!',
  loss: 'Bạn thua ván này',
  draw: 'Hoà cờ',
}

const NOTE: Record<'win' | 'loss' | 'draw', string> = {
  win: 'Ván đấu khép lại đúng ý bạn.',
  loss: 'Còn lượt đi lại thì vẫn gỡ được — ván cờ chưa hẳn đã hết.',
  draw: 'Không ai hạ được ai. Cũng là một kết quả sòng phẳng.',
}

export function GameOverDialog({
  open,
  headline,
  outcome,
  undosLeft,
  canUndo,
  reviewHref,
  onUndo,
  onNewGame,
  onClose,
}: GameOverDialogProps) {
  if (!open) return null

  const offerUndo = canUndo && undosLeft > 0

  return (
    <div className="over" role="dialog" aria-modal="true" aria-label="Kết quả ván đấu">
      <div className="over__scrim" onClick={onClose} />
      <div className={`over__panel over__panel--${outcome ?? 'draw'}`}>
        <h2 className="over__title">{outcome ? TITLE[outcome] : headline}</h2>
        <p className="over__reason">{headline}</p>
        {outcome && <p className="over__note">{NOTE[outcome]}</p>}

        <div className="over__actions">
          {offerUndo && (
            <button type="button" className="btn btn--primary over__action" onClick={onUndo}>
              <Icon name="undo" size={17} /> Đi lại nước vừa rồi · còn {undosLeft}
            </button>
          )}
          {reviewHref ? (
            <Link className="btn over__action" to={reviewHref}>
              <Icon name="play" size={17} /> Xem lại ván này
            </Link>
          ) : (
            <span className="muted over__saving">Đang lưu ván để xem lại…</span>
          )}
          <button
            type="button"
            className={`btn over__action${offerUndo ? '' : ' btn--primary'}`}
            onClick={onNewGame}
          >
            <Icon name="new" size={17} /> Ván mới
          </button>
          <button type="button" className="btn over__action" onClick={onClose}>
            Xem lại bàn cờ
          </button>
        </div>
      </div>
    </div>
  )
}
