/**
 * Three moves worth considering, and why.
 *
 * The old hint handed over one move and said nothing. That tells a player what
 * to do and teaches them nothing — and when they are losing, it quietly implies
 * a rescue exists. Three options with reasons let them compare, which is the
 * only part of a hint anyone learns from.
 *
 * Nothing here computes anything. Every reason shown is something the engine
 * reported about the actual position: what the move takes, whether it checks,
 * what it would then be threatening, and what it expects in reply.
 *
 * ## Look before you leap
 *
 * Tapping an option used to play it straight away, which made the list a menu
 * of decisions rather than a set of ideas. Now the first tap *shows* it: the
 * sheet steps aside, an arrow appears on the board, and the squares that move
 * would put under pressure light up. Playing it is a second, deliberate tap.
 * That is the whole point of offering three — you cannot compare things you
 * cannot look at.
 */

import type { HintInfo, PieceKind } from '../engine/types'
import { Icon } from './Icon'

export interface HintDialogProps {
  open: boolean
  busy: boolean
  choices: HintInfo[]
  /** The option currently being shown on the board, if any. */
  previewing: string | null
  /** Show this option on the board. */
  onPreview: (iccs: string | null) => void
  /** Commit to it. */
  onPick: (iccs: string) => void
  onClose: () => void
}

const PIECE: Record<PieceKind, string> = {
  k: 'Tướng',
  a: 'Sĩ',
  e: 'Tượng',
  h: 'Mã',
  r: 'Xe',
  c: 'Pháo',
  p: 'Tốt',
}

/**
 * Centipawns past which the position is lost whatever is played.
 *
 * A hint that offers three moves in a hopeless position is dishonest by
 * omission: they are not three chances, they are three ways to lose. Saying so
 * is more use than pretending otherwise.
 */
const HOPELESS = -900

/** Roughly a piece down; worth warning about without calling the game over. */
const LOSING = -300

function reasons(choice: HintInfo): string[] {
  const out: string[] = []
  if (choice.captured) out.push(`Ăn ${PIECE[choice.captured]}`)
  if (choice.givesCheck) out.push('Chiếu tướng')
  if (choice.threats.length > 0) out.push(`Doạ ăn ${PIECE[choice.threats[0]]}`)
  if (choice.reply) out.push(`Máy sẽ đáp ${choice.reply}`)
  if (out.length === 0) out.push('Giữ thế, không để hở sườn')
  return out
}

/** The assessment in words. A number of centipawns means nothing to a player. */
function verdict(score: number): string {
  if (score >= 600) return 'Thắng rõ'
  if (score >= 200) return 'Hơn quân'
  if (score >= 60) return 'Nhỉnh hơn'
  if (score > -60) return 'Cân bằng'
  if (score > LOSING) return 'Hơi kém'
  if (score > HOPELESS) return 'Đang thua'
  return 'Rất khó'
}

export function HintDialog({
  open,
  busy,
  choices,
  previewing,
  onPreview,
  onPick,
  onClose,
}: HintDialogProps) {
  if (!open) return null

  const best = choices[0]
  const hopeless = !busy && choices.length > 0 && best.score <= HOPELESS

  return (
    <div
      // While an option is being shown the sheet slides down out of the way and
      // stops swallowing taps, so the board underneath is both visible and live.
      className={previewing ? 'sheet sheet--peek' : 'sheet'}
      role="dialog"
      aria-label="Gợi ý nước đi"
    >
      <div className="sheet__scrim" onClick={onClose} />
      <div className="sheet__panel">
        <div className="sheet__head">
          <h2 className="sheet__title">
            <Icon name="hint" size={17} /> Nên đi nước nào
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">
            <Icon name="close" size={18} />
          </button>
        </div>

        {busy && <p className="muted sheet__note">Đang cân nhắc từng nước…</p>}

        {!busy && choices.length === 0 && (
          <p className="muted sheet__note">Không còn nước nào để đi.</p>
        )}

        {hopeless && (
          <p className="sheet__warn">
            Thế cờ này có vẻ bế tắc rồi. Mấy nước dưới đây là đỡ nhất, chứ không gỡ được.
          </p>
        )}

        {!busy && choices.length > 0 && (
          <p className="muted sheet__note">Chạm để xem trước trên bàn cờ, chạm lần nữa để đi.</p>
        )}

        {!busy &&
          choices.map((choice, i) => {
            const shown = previewing === choice.iccs
            return (
              <div
                key={choice.iccs}
                className={[
                  'hint-card',
                  i === 0 ? 'hint-card--best' : '',
                  shown ? 'hint-card--shown' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className="hint-card__pick"
                  onClick={() => onPreview(shown ? null : choice.iccs)}
                  aria-pressed={shown}
                >
                  <span className="hint-card__rank">{i + 1}</span>
                  <span className="hint-card__body">
                    <span className="hint-card__move">{choice.text}</span>
                    <span className="hint-card__why">{reasons(choice).join(' · ')}</span>
                  </span>
                  <span className="hint-card__verdict">{verdict(choice.score)}</span>
                </button>
                {shown && (
                  <button
                    type="button"
                    className="btn btn--primary hint-card__go"
                    onClick={() => onPick(choice.iccs)}
                  >
                    Đi nước này
                  </button>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
