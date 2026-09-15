# Security

## Auth
- JWT + refresh token cho phiên đăng nhập.
- Password hashing: bcrypt hoặc argon2. Không tự nghĩ ra scheme hash khác.

## RBAC
- 3 role: `job_seeker`, `employer`, `admin`.
- **Enforce ở tầng backend, không chỉ ẩn/hiện phần tử UI.** Một request gọi trực tiếp API (bỏ qua UI) vẫn phải bị chặn đúng theo role.

## Rate limiting
- Bắt buộc cho endpoint nhạy cảm: đăng nhập, đăng ký.

## Secrets
- Không commit secret/credential vào git. Quản lý qua biến môi trường `.env`.
- Biến cần thiết: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AI_SERVICE_URL`, `EMBEDDING_MODEL_PATH`, `CORS_ORIGINS`.
- **Không tự động xử lý credential production.** Việc nhập secret và phê duyệt deploy lần đầu lên production cần xác nhận thủ công từ người thực hiện — agent không tự ý thực hiện bước này.

## Nguồn tham khảo
Chi tiết đầy đủ: `docs/PROJECT_PLAN.md` mục 4.5, 9.3.
