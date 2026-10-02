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
- Admin (FR10, `backend/app/admin.py`): cả router `/admin` gắn `require_role(ADMIN)` ở mức router, không phụ thuộc từng endpoint nhớ thêm. Không tự đăng ký được admin qua API; dev có `quantri@example.com` từ `seed.py`, **production tạo tay bằng SQL** (`UPDATE users SET role='admin' WHERE email=…`) do người thực hiện làm.
- Khoá tài khoản (`users.is_blocked`) có hiệu lực ngay: `get_current_user` đọc lại user ở mỗi request nên access token còn hạn cũng bị 401, refresh bị 401, login 403. Admin không khoá được admin (tránh tự khoá mất quyền).

## Rate limiting
- Bắt buộc cho endpoint nhạy cảm: đăng nhập, đăng ký.

## Secrets
- Không commit secret/credential vào git. Quản lý qua biến môi trường `.env`.
- Biến cần thiết: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AI_SERVICE_URL`, `CORS_ORIGINS`.
- **Không tự động xử lý credential production.** Việc nhập secret và phê duyệt deploy lần đầu lên production cần xác nhận thủ công từ người thực hiện — agent không tự ý thực hiện bước này.

## Nguồn tham khảo
Chi tiết đầy đủ: `docs/PROJECT_PLAN.md` mục 4.5, 9.3.
