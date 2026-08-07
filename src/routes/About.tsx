/**
 * The About page, written for whoever is holding the phone.
 *
 * It used to explain alpha-beta search, transposition tables, null-move pruning
 * and a perft count. Every one of those is true and none of them is for a
 * player: they answer "how was this built", when the only questions someone
 * opening this page actually has are "is it any good", "does it cheat", and
 * "where does my data go".
 *
 * The version is kept, because it is the one technical thing a player has a use
 * for — it is what they would tell someone if something went wrong.
 */

import { useEffect, useState } from 'react'

import { VersionPanel } from '../components/VersionPanel'
import { engineVersion, loadEngineWasm } from '../engine/wasm'

export function AboutPage() {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    void loadEngineWasm().then(() => setVersion(engineVersion()))
  }, [])

  return (
    <>
      <h1 className="page__title">Giới thiệu</h1>
      <p className="page__lede">Đệ Nhất Cờ Tướng — chơi được cả khi không có mạng.</p>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Máy chơi cờ</h2>
        <p style={{ marginTop: 0 }}>
          Máy đi cờ đàng hoàng, không nhìn trộm và không được ưu ái gì. Ở mức Siêu khó nó nghĩ
          khoảng năm giây mỗi nước và tính trước hàng chục nước.
        </p>
        <p style={{ marginBottom: 0 }}>
          Sau mỗi ván, máy nhớ lại những nước đã khiến nó thua để lần sau tránh. Càng chơi nhiều
          thì càng khó thắng.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Luật chơi</h2>
        <p style={{ marginTop: 0 }}>Đầy đủ luật cờ tướng, không cắt bớt cho dễ làm:</p>
        <ul style={{ marginBottom: 0 }}>
          <li>Cản mã, chân tượng, ngòi pháo, tốt qua sông mới đi ngang.</li>
          <li>Hai Tướng không được nhìn thẳng mặt nhau.</li>
          <li>Hết nước đi là thua, không phải hòa.</li>
          <li>Chiếu và đuổi liên hoàn: lặp năm lần thì bên ép liên tục bị xử thua.</li>
          <li>Hòa khi sáu mươi nước không ai ăn quân, hoặc khi hai bên đều không đủ quân để thắng.</li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Bình luận viên</h2>
        <p style={{ marginTop: 0, marginBottom: 0 }}>
          Có người bình cờ theo suốt ván, gọi tên từng quân và lúc rảnh thì kể chuyện quán cờ.
          Phần tiếng nói cần mạng để tải về lần đầu, tải rồi thì nghe lại được cả khi mất mạng.
          Tắt bật ngay trong ván.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Dữ liệu của bạn</h2>
        <p style={{ marginTop: 0, marginBottom: 0 }}>
          Ván cờ nằm trong máy bạn. Không tài khoản, không theo dõi, không gửi đi đâu cả. Chỉ khi
          bạn tự bấm chia sẻ thì một ván mới rời khỏi máy.
        </p>
      </div>

      <VersionPanel release={version} />

      <p className="muted" style={{ marginTop: 14 }}>
        Trần Bảo Cường
      </p>
    </>
  )
}
