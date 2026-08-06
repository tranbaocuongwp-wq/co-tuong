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
 */

import type { HintInfo, PieceKind } from '../engine/types'
import { Icon } from './Icon'

export interface HintDialogProps {
  open: boolean
  busy: boolean
  choices: HintInfo[]
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

export function HintDialog({ open, busy, choices, onPick, onClose }: HintDialogProps) {
  if (!open) return null

  const best = choices[0]
  const hopeless = !busy && choices.length > 0 && best.score <= HOPELESS

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Gợi ý nước đi">
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

        {!busy &&
          choices.map((choice, i) => (
            <button
              key={choice.iccs}
              type="button"
              className={`hint-card${i === 0 ? ' hint-card--best' : ''}`}
              onClick={() => onPick(choice.iccs)}
            >
              <span className="hint-card__rank">{i + 1}</span>
              <span className="hint-card__body">
                <span className="hint-card__move">{choice.text}</span>
                <span className="hint-card__why">{reasons(choice).join(' · ')}</span>
              </span>
              <span className="hint-card__verdict">{verdict(choice.score)}</span>
            </button>
          ))}
      </div>
    </div>
  )
}
