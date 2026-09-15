# ERD

> Nguồn entity: `.claude/docs/database.md`. Vẽ đủ 7 entity (kể cả các entity chỉ cần từ tuần 6+) để ERD không phải sửa lại giữa chừng dự án — map đúng 1:1 với FR1-FR10 (`docs/PROJECT_PLAN.md` mục 3.1).

```mermaid
erDiagram
    USERS ||--o{ JOBS : "employer đăng"
    USERS ||--o{ AVAILABILITY_INTERVALS : "job seeker khai báo"
    USERS ||--o{ APPLICATIONS : "job seeker ứng tuyển"
    JOBS ||--o{ APPLICATIONS : "nhận đơn"
    APPLICATIONS ||--o{ RATINGS : "sau khi hoàn thành (2 dòng/1 đơn)"
    USERS ||--o{ RATINGS : "rater / ratee"
    USERS ||--o{ REPORTS : "báo cáo / bị báo cáo"
    USERS ||--o{ NOTIFICATIONS : "nhận thông báo"

    USERS {
        uuid id PK
        string role "job_seeker | employer | admin"
        string email
        string phone
        string password_hash
        bool email_verified
        bool phone_verified
        string verification_code "hashed, FR8"
        timestamptz verification_code_expires_at
        bool is_blocked "FR7/FR10 - admin block"
        geography location "PostGIS point"
        timestamptz created_at
    }
    JOBS {
        uuid id PK
        uuid employer_id FK
        string title
        text description
        string street "số nhà, tên đường (hiển thị)"
        string ward "phường/xã (hiển thị)"
        string city "tỉnh/thành phố (hiển thị)"
        float lat "chọn trên bản đồ (Leaflet/OSM)"
        float lng
        geography location "PostGIS point, sinh tự động từ lat/lng"
        timestamptz time_start
        timestamptz time_end
        numeric salary
        string status "pending_approval | open | closed | rejected"
        vector embedding "tuần 6+, pgvector"
        timestamptz created_at
    }
    AVAILABILITY_INTERVALS {
        uuid id PK
        uuid job_seeker_id FK
        timestamptz start_time
        timestamptz end_time
    }
    APPLICATIONS {
        uuid id PK
        uuid job_id FK
        uuid job_seeker_id FK
        string status "pending | accepted | rejected | completed | cancelled"
        timestamptz created_at
        timestamptz updated_at
    }
    RATINGS {
        uuid id PK
        uuid application_id FK
        uuid rater_id FK
        uuid ratee_id FK
        int score "1-5"
        text comment
        timestamptz created_at
    }
    REPORTS {
        uuid id PK
        uuid reporter_id FK
        uuid reported_id FK
        text reason
        string status "pending | resolved | dismissed"
        timestamptz created_at
        timestamptz resolved_at
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        string type "application_status | new_recommendation | report_resolved | job_approved"
        string message
        uuid related_id "job_id / application_id / report_id, nullable"
        bool is_read
        timestamptz created_at
    }
```

## Ghi chú
- `AVAILABILITY_INTERVALS.start_time/end_time` là datetime thực, **không phải enum ca cố định** — đây là điểm khác biệt cốt lõi của đề tài (xem `.claude/docs/database.md`).
- `JOBS.embedding` chỉ dùng từ tuần 6+ khi nâng cấp semantic_score sang embedding; tuần 1-5 semantic tính runtime bằng TF-IDF, không lưu vector.
- `JOBS.status = pending_approval` là trạng thái khởi tạo nếu Admin phải duyệt tin trước khi hiển thị công khai (FR10/UC12); nếu tuần 1-5 chưa làm kịp UC12, mặc định `status = open` ngay khi đăng — không block luồng chính.
- `RATINGS` là 1 dòng cho 1 chiều đánh giá (rater→ratee); rating 2 chiều của 1 application = 2 row.
- `USERS.verification_code` dùng chung cho cả xác minh email lẫn SĐT (2 lần gọi, không cần 2 cột riêng) — mã hết hạn (`verification_code_expires_at`) thì sinh mã mới đè lên, không cần bảng OTP riêng.
- `NOTIFICATIONS.related_id` trỏ tới entity liên quan tùy `type` (job/application/report) — không dùng FK cứng vì tham chiếu đa bảng, validate ở tầng application.
