# Use Case Diagram

> ✅ = bắt buộc cuối tuần 5 (mốc 70%, theo `docs/PROJECT_PLAN.md` mục 3.1). Còn lại = tuần 6-12.

```mermaid
flowchart LR
    JS((Job Seeker))
    EMP((Employer))
    ADM((Admin))

    JS --> UC1[Đăng ký / Đăng nhập ✅]
    JS --> UC2[Khai báo lịch rảnh interval ✅]
    JS --> UC3[Tìm/lọc job theo khu vực, khung giờ ✅]
    JS --> UC4[Xem gợi ý AI + lý do gợi ý ✅]
    JS --> UC5[Ứng tuyển job ✅]
    JS --> UC6[Theo dõi trạng thái đơn ✅]
    JS --> UC7[Đánh giá employer]
    JS --> UC8[Report / Block user]

    EMP --> UC1
    EMP --> UC9[Đăng / Sửa / Xóa tin tuyển dụng ✅]
    EMP --> UC10[Duyệt / Từ chối đơn ứng tuyển ✅]
    EMP --> UC11[Đánh giá job seeker]
    EMP --> UC8

    ADM --> UC1
    ADM --> UC12[Duyệt tin đăng]
    ADM --> UC13[Quản lý user]
    ADM --> UC14[Xử lý report]
```

## Ghi chú
- `UC1` (đăng ký/đăng nhập) dùng chung 3 role, phân quyền qua RBAC backend (`.claude/docs/security.md`).
- `UC4` (xem gợi ý AI) là use case trung tâm của đề tài — bắt buộc có breakdown điểm, không chỉ danh sách xếp hạng.
- Các use case không có nhãn ✅ (rating, report/block, admin) nằm trong `docs/PROJECT_PLAN.md` mục 2.2 — hoàn thiện tuần 6-12.
