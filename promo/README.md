# Bộ ảnh quảng bá

10 tấm, **không tấm nào trùng nội dung**, và không tấm nào dùng từ kỹ thuật.
Tất cả nói về một chuyện: cái đầu bên kia bàn cờ giỏi tới mức nào.

## Vuông — 1200 × 1200

| Tệp | Nói gì |
|---|---|
| `vuong-1-nhin-truoc` | Nó đã nhìn thấy ván cờ kết thúc trước khi bạn chạm quân đầu tiên |
| `vuong-2-rut-kinh-nghiem` | Thắng nó một lần rồi thôi — nó ghi lại nước đã khiến nó thua |
| `vuong-3-doan-truoc` | Bạn còn phân vân, nó đã biết bạn đi đâu |
| `vuong-4-bon-muc` | Bốn mức, mức thấp nhất đã đủ toát mồ hôi |
| `vuong-5-cong-bang` | Không nhìn trộm, không ưu ái, chỉ giỏi hơn |

## 4:3 — 1600 × 1200

| Tệp | Nói gì |
|---|---|
| `bon-ba-1-binh-luan` | Có người ngồi cạnh bình từng nước cho bạn nghe |
| `bon-ba-2-goi-y` | Bí thì nó chỉ ba đường, và nói vì sao |
| `bon-ba-3-goi-ten-the` | Bạn bày thế nào, nó gọi đúng tên thế ấy |
| `bon-ba-4-ngoai-tuyen` | Không sóng, không tài khoản, vẫn có đối thủ |
| `bon-ba-5-doc-van-co` | Nó đọc cả ván, không chỉ nước vừa đi |

## Vì sao chữ không bị cắt

Lần dựng đầu tiên có một tiêu đề bị xén mất ở mép phải: `rsvg-convert` không tự
xuống dòng, và cỡ chữ thì đặt bằng mắt. Nay bề rộng từng dòng được đo bằng chính
bảng bước tiến của Arial, rồi tự thu nhỏ cho tới khi vừa khung. Không còn phải
đoán.

## Dựng lại

Nguồn nằm trong `/tmp/promo.py` lúc dựng; nội dung và bố cục đều ở đó. Muốn sửa
câu chữ thì sửa thẳng trong mảng nội dung rồi chạy lại — mọi tấm được sinh từ
cùng một bộ màu và cùng một quy tắc chữ.
