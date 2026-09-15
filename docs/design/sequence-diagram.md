# Sequence Diagram — Luồng gợi ý AI (luồng trung tâm)

> Nguồn contract: `.claude/docs/architecture.md`. Đây là luồng quan trọng nhất để chứng minh giá trị đề tài, nên chọn vẽ chi tiết thay vì tất cả luồng CRUD (đăng ký, đăng tin... là CRUD chuẩn, không cần sequence diagram riêng).

```mermaid
sequenceDiagram
    actor U as Job Seeker
    participant FE as Frontend
    participant BE as Backend chính
    participant AI as AI Service
    participant DB as PostgreSQL

    U->>FE: Mở trang "Gợi ý cho tôi"
    FE->>BE: GET /recommendations
    BE->>DB: Lấy availability_intervals + location của user
    BE->>DB: Lấy danh sách jobs ứng viên (lọc geo/status=open trước)
    BE->>AI: POST /score { user, jobs[] }

    alt AI service phản hồi bình thường
        AI->>AI: Tính semantic + time_feasibility + geo + trust cho từng job
        AI-->>BE: [{ job_id, final_score, breakdown }]
    else AI service down / timeout
        BE->>BE: Fallback: xếp hạng theo geo_score + content-based cơ bản
        Note over BE: Không throw lỗi cho user — luôn trả được danh sách
    end

    BE-->>FE: Danh sách job đã xếp hạng + breakdown (hoặc fallback)
    FE-->>U: Hiển thị list + lý do gợi ý (explainable AI)
```

## Ghi chú
- Breakdown luôn phải có trong response — kể cả nhánh fallback (breakdown khi đó chỉ có geo, không có semantic/time/trust, và cần đánh dấu rõ `source: fallback` để FE hiển thị đúng, không giả vờ là kết quả AI đầy đủ).
- Luồng này ứng với FR4 (`docs/PROJECT_PLAN.md` mục 3.1), bắt buộc chạy được bằng TF-IDF ở mốc tuần 5.
