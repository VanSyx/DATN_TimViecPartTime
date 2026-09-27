# Mockup thiết kế lại giao diện

Ảnh mockup theo `docs/design/ui-redesign-brief.md`.

**Bản đã duyệt (2026-09-27)** nằm trên Claude Design: https://claude.ai/design/p/d6598d59-620b-43d0-85b2-561def58d308 (S0–S12, component sheet, 2 luồng, wireframe W1–W4). Frontend đã code theo bản này; ảnh chụp app thật ở `docs/screenshots/week6/`.

Điểm khác so với mockup, do dữ liệu/backend hiện tại:
- Không có SĐT trong hồ sơ (S7) và nút "Gửi lại mã" (S3): `/auth/me` chưa trả SĐT, backend chưa có API gửi lại mã.
- Chưa có chuông thông báo trên thanh điều hướng (làm cùng W2).
- Chưa có ảnh minh hoạ: ô minh hoạ ở hero/trang tài khoản tạm dùng hình "giờ rảnh tuần này" dựng bằng CSS, empty state dùng icon.
- Chế độ AI dự phòng không hiện "~X phút đi lại" vì backend không trả `travel_minutes` khi fallback.

Tên file: `<mã màn>[-<trạng thái>].png`

- Mã màn: `S0`–`S12` (vẽ chi tiết), `W1`–`W4` (wireframe tuần 6-12), `tokens`, `components`, `flow-seeker`, `flow-employer`.
- Kích thước: chỉ desktop 1440×900 (không vẽ giao diện điện thoại).
- Ví dụ: `S4.png`, `S4-fallback.png`, `S4-nhac-ho-so.png`, `S10-chua-ghim.png`.

Trước khi duyệt, soát theo mục 7 của brief: không có tên/ảnh/danh mục giả, lịch rảnh không bị gom về ca cố định, có trạng thái AI dự phòng, tra địa chỉ có danh sách kết quả để chọn.
