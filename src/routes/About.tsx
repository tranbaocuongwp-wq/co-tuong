/**
 * About, written for whoever is holding the phone.
 *
 * It used to explain alpha-beta search, transposition tables and a perft count.
 * Every one of those is true and none of them is for a player: they answer "how
 * was this built", when the questions someone opening this page actually has
 * are "is it any good", "does it cheat", and "where does my data go".
 *
 * ## A note on the author's story
 *
 * The section below says why the app exists and what it refuses to do. Every
 * sentence in it is checkable against this repository — offline play, no
 * account, no tracking, an engine that does not get extra help. What it
 * deliberately does *not* contain is biography: where the author learned chess,
 * who taught them, what they do for a living. Those are facts about a real
 * person and inventing them to make a nicer page would be a lie printed under
 * their name. They are the author's to write, and the text is right here to
 * edit.
 */

import { useEffect, useState } from 'react'
import { HardDrive, Heart, Shield, Swords, Volume2 } from 'lucide-react'

import { Author } from '../components/Author'
import { PieceIcon, PIECE_ORDER } from '../components/PieceIcon'
import { VersionPanel } from '../components/VersionPanel'
import { Card, CardTitle } from '../components/ui/card'
import { engineVersion, loadEngineWasm } from '../engine/wasm'

const RULES = [
  'Cản mã, chân tượng, ngòi pháo, tốt qua sông mới đi ngang.',
  'Hai Tướng không được nhìn thẳng mặt nhau.',
  'Hết nước đi là thua, không phải hoà.',
  'Chiếu và đuổi liên hoàn: lặp năm lần thì bên ép liên tục bị xử thua.',
  'Hoà khi sáu mươi nước không ai ăn quân, hoặc hai bên đều không đủ quân để thắng.',
]

export function AboutPage() {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    void loadEngineWasm().then(() => setVersion(engineVersion()))
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <header className="pt-1">
        <h1 className="text-xl font-bold">Giới thiệu</h1>
        <p className="text-sm text-ink-dim">Đệ Nhất Cờ Tướng — chơi được cả khi không có mạng.</p>
      </header>

      {/* The full set, as a signature. */}
      <div className="flex flex-wrap justify-center gap-1.5 py-1">
        {PIECE_ORDER.map((kind) => (
          <PieceIcon key={`r-${kind}`} kind={kind} side="r" size={30} />
        ))}
        {PIECE_ORDER.map((kind) => (
          <PieceIcon key={`b-${kind}`} kind={kind} side="b" size={30} />
        ))}
      </div>

      <Card>
        <CardTitle>
          <Heart size={15} /> Vì sao có ứng dụng này
        </CardTitle>
        <div className="flex flex-col gap-2.5 text-[0.92rem] leading-relaxed">
          <p>
            Cờ tướng là trò chơi của quán nước đầu ngõ, của cái bàn gỗ mòn lõm và đám người
            đứng xem nói to hơn cả người đang đánh. Nó không cần máy chủ, không cần tài khoản,
            không cần ai cho phép mới được chơi.
          </p>
          <p>
            Phần lớn ứng dụng cờ tướng bây giờ thì cần cả ba. Mở lên là đòi đăng nhập, mất mạng
            là ngồi nhìn, và cái máy thì đánh yếu nhưng lại hay được ưu ái.
          </p>
          <p>
            Ứng dụng này làm ngược lại: cài xong là chơi, không hỏi bạn là ai, và cái máy đánh
            đàng hoàng bằng đúng luật như bạn.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>
          <Swords size={15} /> Máy chơi cờ
        </CardTitle>
        <div className="flex flex-col gap-2 text-[0.92rem] leading-relaxed">
          <p>
            Máy không nhìn trộm và không được ưu ái gì. Ở mức Siêu khó nó nghĩ khoảng năm giây
            mỗi nước và tính trước hàng chục nước.
          </p>
          <p>
            Sau mỗi ván, nó nhớ lại những nước đã khiến nó thua để lần sau tránh. Càng chơi
            nhiều thì càng khó thắng.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>
          <Shield size={15} /> Luật chơi
        </CardTitle>
        <p className="mb-2 text-[0.92rem]">Đầy đủ luật cờ tướng, không cắt bớt cho dễ làm:</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.92rem] leading-relaxed">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>
          <Volume2 size={15} /> Bình luận viên
        </CardTitle>
        <p className="text-[0.92rem] leading-relaxed">
          Có người bình cờ theo suốt ván: gọi tên từng quân, gọi tên thế trận, đoán trước vài
          nước, và lúc rảnh thì kể chuyện quán cờ. Tắt tiếng thì lời bình chạy vào khung chat
          bên cạnh.
        </p>
      </Card>

      <Card>
        <CardTitle>
          <HardDrive size={15} /> Dữ liệu của bạn
        </CardTitle>
        <p className="text-[0.92rem] leading-relaxed">
          Ván cờ nằm trong máy bạn. Không tài khoản, không theo dõi, không gửi đi đâu cả. Chỉ
          khi bạn tự bấm chia sẻ thì một ván mới rời khỏi máy.
        </p>
      </Card>

      <VersionPanel release={version} />

      <footer className="flex flex-col items-center gap-1 py-3 text-sm text-ink-dim">
        <span>Làm bởi</span>
        <Author className="text-base font-medium text-ink" />
      </footer>
    </div>
  )
}
