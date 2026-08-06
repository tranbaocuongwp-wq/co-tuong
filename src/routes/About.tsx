import { useEffect, useState } from 'react'

import { getEngineClient } from '../engine/client'
import { engineVersion, loadEngineWasm } from '../engine/wasm'

export function AboutPage() {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    void loadEngineWasm().then(() => setVersion(engineVersion()))
  }, [])

  const engineKind = getEngineClient().kind

  return (
    <>
      <h1 className="page__title">Giới thiệu</h1>
      <p className="page__lede">
        Cờ Tướng — phần mềm nguồn mở, chạy hoàn toàn ngoại tuyến.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Engine</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Phiên bản {version} · đang chạy ở chế độ{' '}
          <strong>{engineKind === 'native' ? 'native (nhanh hơn)' : 'WebAssembly'}</strong>
        </p>
        <p>
          Luật cờ và bộ tìm kiếm được viết một lần bằng Rust, dùng chung cho cả bản máy tính lẫn
          bản web. Giao diện không tự cài đặt lại luật đi quân, nên không bao giờ có chuyện màn
          hình và engine hiểu luật khác nhau.
        </p>
        <p style={{ marginBottom: 0 }}>
          Bộ tìm kiếm dùng alpha-beta đào sâu dần, bảng chuyển vị, cắt tỉa null-move, giảm độ sâu
          nước muộn và tìm kiếm tĩnh. Luật đi quân được kiểm chứng bằng perft tới độ sâu 5
          (133.312.995 nút, khớp chính xác bảng tham chiếu).
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Luật được áp dụng</h2>
        <ul style={{ marginBottom: 0 }}>
          <li>Cản mã, chân tượng, ngòi pháo, tốt qua sông mới đi ngang.</li>
          <li>Luật tướng đối mặt (hai tướng không được nhìn thẳng nhau).</li>
          <li>Hết nước đi là thua, không phải hòa như cờ vua.</li>
          <li>Chiếu tướng liên hoàn: bên chiếu bị xử thua.</li>
          <li>Hòa khi 60 nước không ăn quân, hoặc khi không bên nào đủ quân chiếu hết.</li>
        </ul>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Quyền riêng tư</h2>
        <p style={{ marginBottom: 0 }}>
          Ứng dụng không gửi dữ liệu đi đâu cả. Không tài khoản, không theo dõi, không kết nối
          mạng khi chơi. Ván đấu chỉ rời khỏi máy khi chính bạn bấm xuất ra tệp JSON.
        </p>
      </div>
    </>
  )
}
