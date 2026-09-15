# ERD

> Nguồn entity: `.claude/docs/database.md`. `ratings`/`reports` chỉ cần từ tuần 6+ nhưng vẽ sẵn để ERD không phải sửa lại giữa chừng.

```mermaid
erDiagram
    USERS ||--o{ JOBS : "employer đăng"
    USERS ||--o{ AVAILABILITY_INTERVALS : "job seeker khai báo"
    USERS ||--o{ APPLICATIONS : "job seeker ứng tuyển"
    JOBS ||--o{ APPLICATIONS : "nhận đơn"
    APPLICATIONS ||--o| RATINGS : "sau khi hoàn thành"
    USERS ||--o{ REPORTS : "báo cáo / bị báo cáo"

    USERS {
        uuid id PK
        string role "job_seeker | employer | admin"
        string email
        string phone
        bool email_verified
        bool phone_verified
        geography location "PostGIS point"
    }
    JOBS {
        uuid id PK
        uuid employer_id FK
        string title
        text description
        geography location "PostGIS point"
        timestamptz time_start
        timestamptz time_end
        numeric salary
        string status "open | closed"
        vector embedding "tuần 6+, pgvector"
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
        string status "pending | accepted | rejected | completed"
        timestamptz created_at
    }
    RATINGS {
        uuid id PK
        uuid application_id FK
        uuid rater_id FK
        uuid ratee_id FK
        int score "1-5"
        text comment
    }
    REPORTS {
        uuid id PK
        uuid reporter_id FK
        uuid reported_id FK
        text reason
        string status "pending | resolved"
    }
```

## Ghi chú
- `AVAILABILITY_INTERVALS.start_time/end_time` là datetime thực, **không phải enum ca cố định** — đây là điểm khác biệt cốt lõi của đề tài (xem `.claude/docs/database.md`).
- `JOBS.embedding` chỉ dùng từ tuần 6+ khi nâng cấp semantic_score sang embedding; tuần 1-5 semantic tính runtime bằng TF-IDF, không lưu vector.
- `RATINGS` là 1 dòng cho 1 chiều đánh giá (rater→ratee); rating 2 chiều của 1 application = 2 row.
