/**
 * What the computer says while it is thinking.
 *
 * A five-second wait needs company, not telemetry. "Nghĩ trước 11 nước · đang
 * cân bằng" is honest and completely uninteresting; a needling line in
 * character makes the same wait feel like sitting across from someone. The
 * search still reports its depth and score — that just drives *which* line is
 * chosen rather than being read out.
 *
 * The line changes every few seconds so a long think does not sit on one
 * sentence, and lines rotate without immediate repeats.
 */

import { memo, useEffect, useRef, useState } from 'react'

import type { SearchInfo } from '../engine/types'

export interface ThinkingToastProps {
  /** Only ever true while the computer owns the turn. */
  visible: boolean
  /** Live search progress. Chooses the mood; never shown as numbers. */
  progress: SearchInfo | null
  /** Overrides the commentary, e.g. while fetching a hint. */
  label?: string
}

/** How long each line stays before the next one. */
const ROTATE_MS = 3400

/**
 * How many recent lines to avoid repeating.
 *
 * Deliberately deep. The complaint that led to this pool being widened was not
 * "there are too few lines" but "I keep hearing the same one", and those are
 * different problems: with a shallow memory a wide pool still collides, because
 * a fair coin lands on the same face often enough to be noticed.
 */
const MEMORY = 24

/**
 * How long a think has to run before it is a *long* think.
 *
 * Past this the opponent starts acknowledging that it is taking its time, which
 * is what a person does. Sitting there producing fresh unrelated musings for
 * thirty seconds reads as a script; grumbling about how long this is taking
 * reads as someone actually stuck.
 */
const LONG_MS = 9_000

/**
 * The opponent muttering to itself while it thinks.
 *
 * Written in its own voice rather than as a status line, because that is what
 * the pill actually is: the player is watching someone opposite them decide,
 * and "Đang tính…" tells them nothing they had not already worked out from the
 * fact that nothing has moved.
 *
 * These are display-only, never spoken, so there is no recording cost and the
 * pool can be as wide as it likes — which is the entire reason it is this wide.
 * The commentator next door has his own voice and says a different kind of
 * thing: he is polite, he is addressing an audience, and he is fair to both
 * sides. This one is the opponent, talking to nobody, and it is allowed to be
 * gruff, sarcastic and a bit of a bad winner.
 */
const MUTTERS = {
  neutral: [
    'Ăn hay không ăn… hỏi thì dễ, trả lời mới khó.',
    'Hừm. Nước này nhìn ngon mà chắc có gai.',
    'Ba đường đi, đường nào cũng thấy mùi bẫy.',
    'Đi con này thì hắn phản, đi con kia thì ta hớ. Hay ho thật.',
    'Chậc… ai bày ra cái thế này vậy.',
    'Con Xe kia đứng đấy chướng cả mắt.',
    'Nếu ta ăn, hắn chiếu. Nếu ta không ăn, hắn cũng chiếu. Công bằng ghê.',
    'Từ từ. Vội một cái là mất cả buổi tối.',
    'Thế này quen quen… mà quên mất lần trước ta thắng hay thua.',
    'Đi đâu bây giờ. Bàn cờ rộng thế mà chẳng có chỗ nào tử tế.',
    'Ừ thì cũng được… chắc thế… có lẽ.',
    'Hắn định gì đây? Hay là hắn chẳng định gì cả?',
    'Nước này hay đấy. Tiếc là của hắn.',
    'Ta mà đi thế này, mai người ta đem ra làm ví dụ. Ví dụ xấu.',
    'Nghĩ kỹ vào. Nghĩ kỹ rồi vẫn sai thì tính sau.',
    'Ba mươi hai quân, con nào cũng đang vướng chân con nào.',
    'Đổi hay không đổi. Đổi thì nhẹ, mà nhẹ quá lại thành trống.',
    'Con Tốt kia trông vô hại phết. Vô hại kiểu đáng ngờ.',
    'Hắn để hở chỗ này. Hoặc hắn cố tình để hở chỗ này.',
    'Ta thấy một nước hay. Rồi thấy nó dở. Rồi lại thấy hay.',
    'Nói chung là chưa nghĩ ra. Cứ nhìn thêm tí nữa.',
    'Tuyến giữa đông quá, chen vào chắc gãy chân.',
    'Hay là cứ đi bừa? … Thôi, không nên.',
    'Nước này đẹp. Mà đẹp thì có ăn được đâu.',
    'Hắn chờ ta hớ, ta chờ hắn hớ. Ai lì hơn thì thắng.',
    'Lại còn con Mã kẹt chân kia nữa. Phiền.',
    'Trông thì yên, mà bên dưới là cả một ổ.',
    'Được. Chốt nước này. … Khoan đã.',
    'Thêm một nhịp nữa thôi, để ta soi cho kỹ.',
    'Sao con nào cũng đang bận giữ con nào thế này.',
    'Nếu ta là hắn thì ta đã đi khác rồi. May mà ta không phải hắn.',
    'Thế này sách có dạy. Tiếc là ta không đọc sách.',
    'Ăn con Tốt cho vui? … Vui được đúng hai nước.',
    'Chỗ kia thoáng quá. Thoáng quá cũng đáng ngờ.',
    'Đừng tham. Đừng tham. Ừ thì hơi tham một tí.',
    'Nước nào cũng có giá của nó. Vấn đề là giá bao nhiêu.',
    'Khoan… hình như ta bỏ sót một đường.',
    'Tính tới đây thì mọi thứ lại rối lên.',
    'Có khi nước xấu nhất lại là nước an toàn nhất.',
    'Thôi được rồi. Ta quyết đây.',
  ],
  ahead: [
    'Ổn rồi. Từ đây chỉ cần đừng làm gì dại.',
    'Siết từ từ thôi. Việc gì phải vội.',
    'Hắn hết bài rồi. Nhìn cái thế là biết.',
    'Còn mỗi việc dọn dẹp cho gọn.',
    'Đang hơn mà còn tham thì đúng là tự chuốc.',
    'Cứ đổi hết quân đi. Càng ít càng dễ.',
    'Hắn vẫn đang tìm cửa. Không có cửa nào đâu.',
    'Ta đi nhanh cũng được. Nhưng để hắn ngồi nghĩ thêm cũng vui.',
    'Đến đoạn này thì cần kỹ thuật thôi, không cần thông minh nữa.',
    'Cẩn thận khúc cuối. Bao nhiêu ván hỏng đúng ở chỗ này.',
    'Thế này mà thua thì ta xin bỏ nghề.',
    'Nhẹ nhàng. Đi chắc. Đừng phá cái đang tốt.',
    'Hắn còn chống được vài nước. Cứ để hắn chống.',
    'Ta tính xong từ nãy rồi, giờ ngồi đây cho phải phép thôi.',
    'Không cần đòn đẹp. Cần đòn chắc.',
    'Con Xe này một mình nó là đủ.',
    'Giờ ta chỉ sợ mỗi chính mình.',
    'Xong rồi. Mà hắn chưa biết.',
  ],
  behind: [
    'Rắc rối. Rất rắc rối.',
    'Phải tìm ra cái gì đó, không thì đi đứt.',
    'Hừ. Nước vừa rồi ta hớ thật.',
    'Còn một chỗ rối… cầu cho hắn đừng nhìn ra.',
    'Thôi, liều. Đằng nào cũng hỏng thì liều còn hơn.',
    'Đừng đổi quân nữa. Đổi nữa là hết.',
    'Cần một cái bẫy. Bất kỳ cái bẫy nào.',
    'Đáng lẽ nãy đừng có tham con đó.',
    'Còn nước còn tát. Mà nước cũng chẳng còn mấy.',
    'Kéo dài ra. Người ta hay sai lúc tưởng đã thắng.',
    'Ta đang thua. Ừ thì đang thua. Nhưng chưa thua.',
    'Giá mà nãy ta nghĩ thêm ba giây.',
    'Thế này cứu được không… chắc không. Nhưng cứ thử.',
    'Rối tung lên đi. Rối thì hắn cũng dễ sai.',
    'Không được để hắn đổi hết quân.',
    'Đi chắc là chết chắc. Phải đi liều.',
    'Hắn chỉ cần không sai là xong. Vậy thì phải làm cho hắn sai.',
    'Tệ thật. Nhưng chưa tệ đến mức bỏ bàn.',
  ],
  mate: [
    'Thấy đường rồi. Từ đây đếm ngược.',
    'Xong. Không cần tính thêm nữa.',
    'Ba nước. Hoặc bốn, nếu hắn cố kéo.',
    'Lưới giăng xong rồi. Chỉ còn kéo.',
    'Hắn đi đâu cũng vào đúng chỗ ta muốn.',
    'Từ giờ ta đi nhanh cho đỡ mất thì giờ.',
    'Không có cửa nào cả. Ta kiểm ba lần rồi.',
    'Đến đoạn ta thích nhất đây.',
    'Cứ đi đi. Đường nào cũng về một chỗ.',
    'Chốt. Không đổi ý nữa.',
  ],
  trapped: [
    'Chết thật…',
    'Đường nào cũng chết. Thôi chọn cái đỡ khó coi.',
    'Đỡ được nước này thì đỡ… mà đỡ kiểu gì.',
    'Hắn tính từ lúc nào thế nhỉ.',
    'Thôi rồi. Ta nhìn ra hơi muộn.',
    'Còn cách nào không… không có.',
    'Kéo thêm được nước nào hay nước ấy.',
    'Ván này ta thua từ mấy nước trước rồi.',
    'Đúng chỗ ta lo nhất. Mà ta vẫn để hở.',
    'Được rồi. Hắn đánh hay. Công nhận.',
  ],
  /** Mixed in once a think has dragged on, whatever the score says. */
  long: [
    'Ừ thì ta nghĩ hơi lâu. Thế cờ nó khó chứ ai muốn.',
    'Đừng sốt ruột. Nghĩ kỹ là tôn trọng đối thủ đấy.',
    'Ta vẫn ở đây. Vẫn đang tính.',
    'Thế này mà đi nhanh thì mới là láo.',
    'Sắp xong. Sắp thôi. Chắc vậy.',
    'Nhiều biến quá, đếm mãi chưa hết.',
    'Thêm chút nữa, ta gần ra rồi.',
    'Nghĩ lâu không phải vì dốt. Là vì cẩn thận. Chắc thế.',
    'Ai bày ra cái thế rối thế này không biết.',
    'Còn hai đường nữa thôi, để ta soi nốt.',
    'Trà nguội mất rồi.',
    'Đợi tí. Đợi tí nữa.',
  ],
}

/**
 * Which pool fits what the search is currently reporting.
 *
 * A long think widens the pool rather than replacing it: the opponent is still
 * winning or still stuck, it has just been at it a while, so both kinds of
 * remark are in character at once.
 */
function muttersFor(progress: SearchInfo | null, longThink: boolean): string[] {
  const base = (() => {
    if (!progress) return MUTTERS.neutral
    if (progress.mateIn !== null && progress.mateIn !== undefined) {
      return progress.mateIn > 0 ? MUTTERS.mate : MUTTERS.trapped
    }
    if (progress.score > 250) return MUTTERS.ahead
    if (progress.score < -250) return MUTTERS.behind
    return MUTTERS.neutral
  })()
  return longThink ? [...base, ...MUTTERS.long] : base
}

function ThinkingToastView({ visible, progress, label }: ThinkingToastProps) {
  const [line, setLine] = useState<{ id: string; text: string } | null>(null)
  const recentRef = useRef<string[]>([])
  /*
   * The search keeps reporting while a think runs, and re-running the effect on
   * every report would restart the timer and stop the line ever changing. A ref
   * lets the mood follow the search without the effect depending on it.
   */
  const progressRef = useRef(progress)
  progressRef.current = progress

  useEffect(() => {
    if (!visible || label) {
      setLine(null)
      return
    }

    const startedAt = Date.now()

    const next = () => {
      setLine((current) => {
        const pool = muttersFor(progressRef.current, Date.now() - startedAt >= LONG_MS)
        const fresh = pool.filter((m) => !recentRef.current.includes(m))
        const from = fresh.length > 0 ? fresh : pool
        const chosen = from[Math.floor(Math.random() * from.length)]
        if (!chosen) return current
        recentRef.current = [chosen, ...recentRef.current].slice(0, MEMORY)
        return { id: chosen, text: chosen }
      })
    }

    next()
    const timer = setInterval(next, ROTATE_MS)
    return () => clearInterval(timer)
  }, [visible, label])

  if (!visible) return null

  return (
    <div className="toast-layer" aria-live="polite">
      <div className="toast toast--busy">
        <span className="toast__glow" aria-hidden="true" />
        <span className="toast__body">
          <span className="toast__dot" aria-hidden="true" />
          <span className="toast__text" key={line?.id ?? label}>
            {label ?? line?.text ?? 'Hừm…'}
          </span>
        </span>
      </div>
    </div>
  )
}

/**
 * Held steady unless its own inputs move.
 *
 * It runs its own timer; nothing outside it decides when its words change.
 */
export const ThinkingToast = memo(ThinkingToastView)
