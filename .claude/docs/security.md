# Security

## Auth
- JWT + refresh token cho phiên đăng nhập. Access token và refresh token ký bằng **hai secret khác nhau** (`JWT_SECRET` / `JWT_REFRESH_SECRET`), và mỗi token mang claim `type` (`access`/`refresh`) — chặn việc dùng refresh token thay access token.
- **Secret phải dài ≥ 32 byte** (HS256): PyJWT cảnh báo nếu ngắn hơn. Sinh bằng `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- Refresh token hiện **stateless** (không lưu DB) nên không thu hồi được trước hạn — chấp nhận trong scope tuần 1-5, thêm bảng `refresh_tokens` khi cần "đăng xuất mọi thiết bị".
- Password hashing: bcrypt hoặc argon2. Không tự nghĩ ra scheme hash khác.
- Mật khẩu giới hạn tối đa 72 byte ở tầng schema — bcrypt cắt cụt input dài hơn, không chặn ở boundary thì hash sai âm thầm.

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
