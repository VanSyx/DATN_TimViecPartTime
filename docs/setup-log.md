# Setup Log — nhật ký cài đặt môi trường & triển khai

Ghi lại mỗi bước cài đặt môi trường/công cụ ngay lúc làm (ảnh chụp màn hình lưu ở `docs/screenshots/`, đặt tên `NN-mo-ta-ngan.png`). Dùng làm tư liệu cho chương Cài đặt/Triển khai của báo cáo tốt nghiệp — xem quy tắc ở `CLAUDE.md` mục 5.

## Việc cần làm ngay: bù lại các bước đã bỏ lỡ (Tuần 1-2)

Các bước dưới đây đã hoàn thành trước khi có quy tắc này nên chưa có ảnh gốc theo đúng thời điểm làm. Không thể quay lại đúng khoảnh khắc, nhưng có thể bù bằng 2 cách — đánh dấu cách nào dùng cho từng dòng trong bảng bên dưới rồi điền:

- **Chụp lại trạng thái hiện tại**: với cấu hình vẫn còn sống (Docker Desktop, Render dashboard, GitHub repo settings...), mở lại và chụp ngay bây giờ — báo cáo ghi rõ "ảnh chụp cấu hình hiện tại" thay vì "ảnh chụp lúc cài đặt", vẫn hợp lệ vì hầu hết báo cáo đồ án chỉ cần minh chứng cấu hình đúng, không bắt buộc ảnh live từng bước.
- **Dẫn chứng bằng commit**: với việc chỉ xảy ra 1 lần và không có gì để chụp lại (vd. một lệnh cài đặt đã chạy xong), trích dẫn commit hash + ngày làm code diff trong repo làm bằng chứng thời điểm, ghi rõ trong cột Ghi chú.

| # | Ngày (ước tính) | Bước | Cách bù | Trạng thái |
|---|---|---|---|---|
| 1 | Tuần 1 | Cài Docker Desktop, chạy `docker compose up -d` lần đầu (db + backend) | Chụp lại `docker compose up -d` + `docker ps` hiện tại | ⬜ Chưa làm |
| 2 | Tuần 1 | Tạo GitHub repo, bật GitHub Actions | Chụp tab Actions hiện tại (lịch sử run vẫn còn) | ⬜ Chưa làm |
| 3 | Tuần 1 ngày 5 | Tạo Render Blueprint (`timviec-backend` + `timviec-db`), nhập secret lần đầu | Chụp Render dashboard hiện tại (service list, tab Environment che giá trị secret) | ⬜ Chưa làm |
| 4 | Tuần 1 ngày 5 | Tạo Render Static Site cho frontend (tạo tay, không qua Blueprint) | Chụp cấu hình Static Site hiện tại (Build Command, Publish Directory) | ⬜ Chưa làm |
| 5 | Tuần 2 | Alembic migration đầu tiên cho bảng `users` | Dẫn commit thêm file trong `backend/alembic/versions/` | ⬜ Chưa làm |
| 6 | Tuần 2 ngày 3-5 | Cài `slowapi`, `react-router-dom`; rebuild container backend | Dẫn commit `67c1434` (RBAC/rate limit/CORS + frontend skeleton) | ⬜ Chưa làm |

## Từ bây giờ: log các bước mới

| # | Ngày | Bước | Ảnh | Ghi chú |
|---|---|---|---|---|
| | | | | |
