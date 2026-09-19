# Database

PostgreSQL 15+. Extension bắt buộc: **PostGIS** (geo query), **pgvector** (semantic search — chỉ dùng từ tuần 6+ khi nâng cấp AI lên embedding; tuần 1-5 semantic dùng TF-IDF, không cần pgvector để hoạt động).

## Entities chính

| Entity | Nội dung | Cần từ |
|---|---|---|
| `users` | role (`job_seeker` / `employer` / `admin`), thông tin xác minh (SĐT/email), `description` (mô tả tự do của job seeker — đầu vào `semantic_score`) | Tuần 1-5 |
| `jobs` | địa chỉ (`street`/`ward`/`city`, hiển thị) + toạ độ chọn trên bản đồ (`lat`/`lng`, cột `location` geography sinh tự động), khung giờ cần, lương, mô tả tự do, vector embedding, `employer_id` | Tuần 1-5 (cột embedding chỉ dùng từ tuần 6+) |
| `availability_intervals` | lịch rảnh dạng interval thời gian thực của job seeker — **không phải ca cố định (sáng/chiều/tối)** | Tuần 1-5 |
| `applications` | trạng thái đơn ứng tuyển, liên kết user–job | Tuần 1-5 |
| `ratings` | đánh giá hai chiều (điểm + nhận xét) sau khi hoàn thành job | Tuần 6-12 |
| `reports` | báo cáo vi phạm, trạng thái xử lý bởi admin | Tuần 6-12 |
| `notifications` | thông báo in-app (đơn được duyệt, có gợi ý mới, report đã xử lý...) — FR9 | Tuần 6-12 |

## Ràng buộc quan trọng
- `availability_intervals` phải lưu dạng khoảng thời gian thực (start/end datetime hoặc time-of-day range), **không** dùng enum ca cố định — đây là điểm khác biệt cốt lõi so với job site thông thường, đừng đơn giản hóa lại thành enum.
- Cột vector embedding trên `jobs` chỉ có ý nghĩa sau khi pgvector được bật (tuần 6+); trước đó semantic score tính runtime bằng TF-IDF, không cần lưu vector trong DB.
- `ratings` tác động vào `trust_modifier` của công thức AI (xem `ai_scoring.md`) — mặc định trung lập (1.0) khi chưa có rating nào.
- Xác minh SĐT/email (FR8) dùng thẳng cột `verification_code`/`verification_code_expires_at` trên `users` — không cần entity OTP riêng, mã hết hạn thì sinh mã mới đè lên. **Các cột này cần ngay từ tuần 1-5** (cùng lúc tạo model `users`), tránh phải migrate schema lại ở tuần 6 khi tích hợp provider gửi mã thật.
- `notifications` sinh ra từ sự kiện nghiệp vụ (đơn được duyệt/từ chối, report được xử lý, có job mới khớp cao) — backend chính là nơi tạo record này, AI service không ghi trực tiếp vào bảng.

## Nguồn tham khảo
Chi tiết đầy đủ: `docs/PROJECT_PLAN.md` mục 4.3.
