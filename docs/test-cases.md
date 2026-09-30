# Bộ test case kiểm thử thủ công — TimViecPartTime

Phạm vi: toàn bộ chức năng đã hoàn thành tới **2026-09-30** (Tuần 1–5 + giao diện mới Tuần 6, nhánh `feat/week6-ui`). Mục tiêu: chạy hết trước khi merge vào `main` (merge = deploy production), và làm tư liệu cho chương **Kiểm thử & đánh giá** của báo cáo.

Chức năng **chưa làm** nên **không** test: đánh giá sao (FR6), báo cáo/chặn người dùng (FR7), thông báo in-app (FR9), duyệt tin/khoá tài khoản bởi admin (FR10), gửi mã xác minh qua email thật, embedding.

---

## 0. Chuẩn bị

### 0.1 Môi trường local

```
docker compose up -d                          # db + backend :8000 + ai-service :8001
docker compose exec backend python seed.py    # dữ liệu mẫu, chạy lại để làm sạch sau mỗi vòng test
cd frontend && npm run dev                    # http://localhost:5173
```

- Trình duyệt: Edge hoặc Chrome bản mới, cửa sổ **1440×900** (kiểm thêm 1366×768 ở mục UI). Mở DevTools (F12) → tab **Console** để bắt lỗi JS, tab **Network** để xem request.
- Mã xác minh email (chưa gửi mail thật) đọc trong log: `docker compose logs backend | grep "Verification code"`.
- Chạy SQL: `docker compose exec db psql -U postgres -d timviec -c "<câu lệnh>"`.
- **Seed lại** (`python seed.py`) trước mỗi nhóm test có thay đổi dữ liệu, để kết quả mong đợi bên dưới đúng.
- Ngày giờ trong dữ liệu seed tính theo **ngày chạy seed** (vd "thứ 7 tới"), nên kết quả ghi theo thứ, không ghi ngày cố định.

### 0.2 Tài khoản mẫu (mật khẩu chung `matkhau123`)

| Email | Vai trò | Đặc điểm dùng để test |
|---|---|---|
| `lan.nguyen@example.com` | Tìm việc | Hai Bà Trưng (~Bạch Mai). Rảnh chiều T2–T6 13:30–17:30, T7/CN 07:00–20:00, **1 khoảng khai trùng** T7 08:00–10:00. Đơn: J1 *Chờ duyệt*, J7 *Đã nhận* |
| `hung.tran@example.com` | Tìm việc | Cầu Giấy, chỉ rảnh 05:30–10:00 mỗi ngày. Đơn: J3 *Đã nhận*, J4 *Chờ duyệt* |
| `hoa.le@example.com` | Tìm việc | Đống Đa, rảnh T2–T6 08:00–14:00. Đơn: J5 *Đã nhận*, J6 *Chờ duyệt* |
| `trang.pham@example.com` | Tìm việc | Thanh Xuân, rảnh tối T2–T6 18:30–22:00 + CN. Đơn: J2 *Chờ duyệt* |
| `tuananh.vu@example.com` | Tìm việc | Mô tả **gõ không dấu**, **chưa xác minh email**, **không có SĐT**. Đơn: J11 (tin đã đóng) *Chờ duyệt* |
| `nam.do@example.com` | Tìm việc | Đơn: J1 *Chờ duyệt*, J10 *Bị từ chối*, J3 *Đã hủy* |
| `vy.huynh@example.com` | Tìm việc | TP.HCM. Đơn: J8 *Chờ duyệt* |
| `duc.ngo@example.com` | Tìm việc | Đà Nẵng |
| `phuong.mai@example.com` | Tìm việc | **Chưa có mô tả, chưa có lịch rảnh, chưa có đơn** |
| `huong.dinh@example.com` | Đăng tin | J1 Dọn nhà sáng T7 (2 người nộp: lan, nam), J2 Trông bé tối T4 |
| `cafe.tuan@example.com` | Đăng tin | J3 (hung *Đã nhận*, nam *Đã hủy*), J4 |
| `nhahang.hangbac@example.com` | Đăng tin | J10 tiệc cưới CN, J11 **đã đóng** |
| `minh.hoang@example.com` | Đăng tin | J12 (không ai nộp), J13 **đang mở nhưng đã qua ngày làm** |
| `hai.cao@example.com` | Đăng tin | **Chưa đăng tin nào**, không có SĐT |

Tin mở và chưa kết thúc trong seed: **12** (J1–J10, J12, J14). J11 đã đóng, J13 đã qua giờ làm, cả hai **không được** hiện với người tìm việc.

### 0.3 Quy ước

- **UT (ưu tiên)**: **P1** = luồng chính / bảo mật, lỗi là **chặn merge**. **P2** = chức năng phụ / trạng thái lỗi. **P3** = giao diện, câu chữ.
- **KQ**: ghi `Đạt`, `Lỗi #<số bug>` hoặc `Bỏ qua (lý do)`.
- Các case đánh dấu **[HQ]** là test hồi quy cho 4 lỗi đã sửa ngày 2026-09-30.
- Câu chữ trong ngoặc kép là **chữ hiển thị chính xác** phải thấy trên màn hình.

---

## 1. Đăng ký (S2)

Tiền điều kiện: chưa đăng nhập, mở `/register`.

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| REG-01 | P1 | Đăng ký người tìm việc thành công | 1. Để mặc định thẻ "Tìm việc"<br>2. Email mới `test1@example.com`, mật khẩu `12345678`, SĐT `0905 123 456`<br>3. Bấm "Tạo tài khoản" | Nút hiện "Đang tạo…" có spinner. Chuyển sang `/verify?user_id=…&email=…`, màn hình ghi "Nhập mã 6 số đã gửi tới **test1@example.com**". Log backend có dòng `Verification code for test1@example.com: xxxxxx` | Đạt |
| REG-02 | P1 | Đăng ký người đăng tin | Chọn thẻ "Tuyển người", điền email mới, bấm "Tạo tài khoản" | Thẻ "Tuyển người" viền teal + icon ✓. Dòng gợi ý dưới SĐT đổi thành "Giúp người ứng tuyển liên lạc với bạn khi cần." Tạo thành công, sang trang xác minh | Đạt |
| REG-03 | P2 | Vai trò chọn sẵn từ link | Mở `/register?role=employer` | Thẻ "Tuyển người" đã được chọn sẵn | Đạt |
| REG-04 | P1 | Email đã tồn tại | Đăng ký với `lan.nguyen@example.com` | Ô email viền đỏ, hiện "Email này đã được đăng ký. **Đăng nhập bằng email này**". Bấm link → `/login` với ô email điền sẵn `lan.nguyen@example.com` | Đạt |
| REG-05 | P2 | Mật khẩu ngắn | Mật khẩu `1234567` (7 ký tự), bấm "Tạo tài khoản" | Trình duyệt chặn, không gửi request. Dòng "Ít nhất 8 ký tự" màu xám; gõ đủ 8 ký tự thì đổi sang xanh | Đạt |
| REG-06 | P2 | Mật khẩu dài quá | Dán chuỗi 80 ký tự | Ô chỉ nhận tối đa 72 ký tự (giới hạn của bcrypt) | Đạt |
| REG-07 | P2 | Email sai định dạng | `abc@`, `abc.com` | Trình duyệt báo lỗi định dạng, không gửi request | Đạt |
| REG-08 | P2 | Bỏ trống SĐT | Không nhập SĐT | Đăng ký thành công (SĐT tuỳ chọn) | Đạt |
| REG-09 | P3 | Giới hạn độ dài SĐT | Gõ 25 ký tự | Ô chỉ nhận 20 ký tự | Đạt |
| REG-10 | P2 | Hiện/ẩn mật khẩu | Bấm icon con mắt | Mật khẩu hiện dạng chữ, icon đổi; bấm lại thì ẩn | Đạt |
| REG-11 | P2 | Giới hạn tần suất | Gửi đăng ký 6 lần trong 1 phút (email khác nhau) | Lần thứ 6 báo lỗi 429, không tạo tài khoản. *Lưu ý đã biết: thông báo từ thư viện là tiếng Anh "Rate limit exceeded…"* | Đạt |
| REG-12 | P1 | Không tự đăng ký được admin | Swagger `http://localhost:8000/docs` → `POST /auth/register` với `"role": "admin"` | 422, không tạo tài khoản | Đạt |
| REG-13 | P3 | Điều hướng | Bấm "← Về trang chủ", "Đăng nhập", logo | Về đúng `/`, `/login`, `/` | Đạt |

## 2. Xác minh email (S3)

Tiền điều kiện: vừa đăng ký xong ở REG-01 (đang ở `/verify`), lấy mã trong log backend.

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| VER-01 | P1 | Mã đúng | Gõ 6 số đúng, bấm "Xác minh" | Màn "Email đã được xác minh". Người tìm việc: câu "Bước tiếp theo: khai giờ rảnh…" + nút "Khai hồ sơ ngay". Người đăng tin: "Đăng tin ngay" | Đạt |
| VER-02 | P1 | Nút sau xác minh | Bấm "Khai hồ sơ ngay" → đăng nhập | Sau đăng nhập vào thẳng `/seeker/profile` (người đăng tin: `/employer/new`), email điền sẵn ở trang đăng nhập | Đạt |
| VER-03 | P1 | Mã sai | Gõ `000000` (sai) | 6 ô viền đỏ, hiện "Mã xác minh sai hoặc đã hết hạn". Gõ lại số khác thì hết đỏ | Đạt |
| VER-04 | P2 | Mã hết hạn | Đợi > 15 phút rồi nhập mã đúng | "Mã xác minh sai hoặc đã hết hạn" | Đạt |
| VER-05 | P2 | Chỉ nhận số | Gõ `12ab34` | Chỉ còn `1234`, chữ bị bỏ | Đạt |
| VER-06 | P2 | Dán mã | Copy `123456` rồi Ctrl+V vào ô | Điền đủ 6 ô | Đạt |
| VER-07 | P2 | Nút bị khoá khi chưa đủ | Gõ 5 số | Nút "Xác minh" bị khoá | Đạt |
| VER-08 | P2 | Thiếu user_id | Mở `/verify` không có tham số | Nút "Xác minh" luôn khoá; câu "Nhập mã 6 số đã gửi tới email của bạn" | Đạt |
| VER-09 | P2 | Xác minh lần 2 | Sau VER-01, quay lại link verify cũ, nhập lại mã | "Chưa có mã xác minh nào đang chờ" | Đạt |
| VER-10 | P1 | Bỏ qua xác minh | Bấm "Để sau, đăng nhập luôn →" rồi đăng nhập | Đăng nhập được bình thường. Trang Hồ sơ hiện badge "Chưa xác minh" | Đạt |

## 3. Đăng nhập, đăng xuất (S1)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| LOGIN-01 | P1 | Người tìm việc | Đăng nhập `lan.nguyen@example.com` | Vào `/seeker` "Gợi ý cho tôi". Menu: Gợi ý cho tôi / Tìm việc / Đơn ứng tuyển / Hồ sơ & lịch rảnh | Đạt |
| LOGIN-02 | P1 | Người đăng tin | Đăng nhập `huong.dinh@example.com` | Vào `/employer` "Tin đã đăng". Menu: Tin đã đăng / Đăng tin mới | Đạt |
| LOGIN-03 | P1 | Sai mật khẩu | `lan.nguyen@example.com` + `saimatkhau` | Ô mật khẩu viền đỏ, "Email hoặc mật khẩu không đúng" | Đạt |
| LOGIN-04 | P1 | Email không tồn tại | `khongco@example.com` | **Cùng** thông báo như LOGIN-03 (không lộ email nào có tài khoản) | Đạt |
| LOGIN-05 | P1 | Quá số lần thử | Đăng nhập sai liên tiếp 6 lần trong 1 phút | Lần thứ 6: banner vàng "Bạn đã thử quá nhiều lần", nút "Đăng nhập" bị khoá. Sau 60 giây banner tự tắt, đăng nhập đúng được | Đạt |
| LOGIN-06 | P1 | Tài khoản bị khoá | SQL `UPDATE users SET is_blocked=true WHERE email='vy.huynh@example.com';` rồi đăng nhập | "Tài khoản đã bị khóa". Seed lại sau khi test | Đạt |
| LOGIN-07 | P1 | Chưa xác minh vẫn đăng nhập được | `tuananh.vu@example.com` | Đăng nhập thành công | Đạt |
| LOGIN-08 | P1 | Quay lại đúng trang sau đăng nhập | Chưa đăng nhập, mở `/seeker/applications` | Chuyển sang `/login?next=%2Fseeker%2Fapplications`; đăng nhập xong vào lại đúng `/seeker/applications` | Đạt |
| LOGIN-09 | P1 | **[HQ]** Chặn chuyển hướng ra ngoài | Mở lần lượt `/login?next=//example.com` và `/login?next=/%5Cexample.com`, đăng nhập | Cả 2 trường hợp vẫn ở `localhost:5173`, vào trang chính của vai trò | Đạt |
| LOGIN-10 | P3 | Email điền sẵn | Mở `/login?email=a@b.com` | Ô email có sẵn `a@b.com` | Đạt |
| LOGIN-11 | P1 | Đăng xuất | Menu tài khoản (góc phải) → "Đăng xuất" | Về trang chủ khách. DevTools → Application → Local Storage không còn `access_token`/`refresh_token` | Đạt (sau khi sửa Bug #1) |
| LOGIN-12 | P1 | Sau đăng xuất không vào lại được | Sau LOGIN-11 bấm Back của trình duyệt về `/seeker` | Bị đưa về `/login?next=%2Fseeker` | Đạt (sau khi sửa Bug #1) |
| LOGIN-13 | P2 | Menu tài khoản | Bấm vào email ở góc phải | Hiện vai trò ("Người tìm việc"), link "Hồ sơ & lịch rảnh" (chỉ người tìm việc), "Đăng xuất" màu đỏ. Bấm 1 mục thì menu đóng | Đạt |

## 4. Phiên đăng nhập & phân quyền (bảo mật)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| SEC-01 | P1 | Tự làm mới phiên | Đăng nhập lan. DevTools → Local Storage → sửa `access_token` thành `abc`. Bấm sang "Đơn ứng tuyển" | Trang vẫn tải bình thường (tab Network: 1 request 401 → `POST /auth/refresh` 200 → gọi lại 200). `access_token` được thay mới | Đạt |
| SEC-02 | P1 | Phiên hết hẳn | Sửa cả `access_token` và `refresh_token` thành `abc`, nhấn F5 ở `/seeker` | Token bị xoá, chuyển về `/login?next=%2Fseeker` | Đạt |
| SEC-03 | P1 | Khách vào trang cần đăng nhập | Chưa đăng nhập, mở `/seeker`, `/seeker/profile`, `/employer`, `/employer/new`, `/admin` | Đều chuyển sang `/login?next=…` | Đạt |
| SEC-04 | P1 | Sai vai trò (giao diện) | Đăng nhập lan, mở `/employer/new`; đăng nhập huong, mở `/seeker` | Bị đưa về trang chính của vai trò mình (`/seeker`, `/employer`) | Đạt |
| SEC-05 | P1 | Sai vai trò (API) | Swagger → Authorize bằng token của lan → `POST /jobs` | 403 "Không có quyền truy cập" | Đạt |
| SEC-06 | P1 | Sai vai trò (API) | Token của huong → `GET /recommendations?lat=21&lng=105.8` | 403 | Đạt |
| SEC-07 | P1 | Không có token | Gọi `GET /applications/me` không kèm token | 401 hoặc 403, không trả dữ liệu | Đạt |
| SEC-08 | P1 | Sửa tin của người khác | Token của `cafe.tuan` → `PUT /jobs/{id của J1}` (J1 của huong) | 404 "Không tìm thấy tin tuyển dụng" (không lộ tin có tồn tại) | Đạt |
| SEC-09 | P1 | Xem đơn tin của người khác | Token của `cafe.tuan` → `GET /jobs/{id J1}/applications`; hoặc đăng nhập tuan mở `/employer/jobs/{id J1}` | API 404; giao diện hiện banner "Không tải được danh sách đơn" | Đạt |
| SEC-10 | P1 | Hủy đơn của người khác | Token của hung → `PATCH /applications/{id đơn của lan}` `{"status":"cancelled"}` | 404 | Đạt |
| SEC-11 | P1 | Người tìm việc tự duyệt đơn | Token của lan → `PATCH` đơn J1 của chính lan `{"status":"accepted"}` | 403 "Không có quyền chuyển đơn sang trạng thái này" | Đạt |
| SEC-12 | P1 | Người đăng tin tự hủy đơn | Token của huong → `PATCH` đơn của lan ở J1 `{"status":"cancelled"}` | 403 | Đạt |
| SEC-13 | P1 | Xoá lịch rảnh của người khác | Token của hung → `DELETE /availability/{id lịch của lan}` | 404 | Đạt |
| SEC-14 | P2 | Đường dẫn không tồn tại | Mở `/abc/xyz` | Về trang chủ `/` | Đạt |
| SEC-15 | P2 | Mật khẩu không lưu dạng rõ | SQL `SELECT email, password_hash FROM users LIMIT 3;` | Cột hash dạng `$2b$…` (bcrypt), không thấy `matkhau123`. Mã xác minh cũng lưu dạng hash | Đạt |

## 5. Trang chủ giới thiệu (S0, khách)

Tiền điều kiện: chưa đăng nhập, seed sạch.

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| HOME-01 | P1 | Đủ 10 khối | Mở `/`, cuộn hết trang | Theo thứ tự: header · hero + ô "Bạn ở đâu?" · Việc mới đăng · Loại việc thường gặp · Cách hoạt động · Gợi ý AI khác gì · An tâm khi làm việc · dải "Cần người giúp việc theo giờ?" · Câu hỏi thường gặp · footer | Đạt |
| HOME-02 | P1 | Việc mới đăng | Xem khối "Việc mới đăng" | Tối đa 6 thẻ, tin mới nhất trước. Badge "Đang có **12** việc mở" (với seed sạch; từ 100 tin trở lên hiện "100+"). **Không** có J11 "Rửa bát ca tối" và J13 "Tưới cây ban công" | Đạt |
| HOME-03 | P2 | Nội dung thẻ việc | Xem 1 thẻ | Tiêu đề, "Phường…, Tỉnh/TP" (không có quận/huyện), dạng `T7, 03/10 · 08:00–11:00`, tiền dạng `270.000 đ` + "cả buổi", nút "Ứng tuyển". **Không** có vòng % | Đạt |
| HOME-04 | P1 | Khách bấm Ứng tuyển | Bấm "Ứng tuyển" trên 1 thẻ | Hộp "Đăng nhập để ứng tuyển" ghi tên việc. "Đăng nhập" → `/login?next=%2F`, đăng nhập xong quay về đúng trang đang xem; "Tạo tài khoản mới" → `/register` | Đạt |
| HOME-05 | P1 | **[HQ]** Đóng hộp đăng nhập không đóng chi tiết việc | Bấm tiêu đề 1 thẻ (mở chi tiết) → "Ứng tuyển" → đóng hộp đăng nhập bằng nút X (rồi thử lại bằng Esc) | Chỉ hộp đăng nhập đóng, **modal chi tiết việc vẫn mở** | Đạt |
| HOME-06 | P1 | Tìm nhanh theo địa chỉ | Ô "Bạn ở đâu?" gõ `Bạch Mai, Hà Nội` → "Tìm việc quanh đây" | Hiện danh sách tối đa 5 kết quả + dòng "… kết quả · chỉ chính xác tới tên đường, chọn đúng kết quả của bạn". Chọn 1 kết quả → sang `/tim-viec?lat=…&lng=…&label=…` | Đạt |
| HOME-07 | P2 | Ô địa chỉ trống | Bấm "Tìm việc quanh đây" khi ô trống | "Hãy nhập địa chỉ trước khi tìm", không gọi mạng | Đạt |
| HOME-08 | P2 | Địa chỉ vô nghĩa | Gõ `xqzxqzxqz` | "Không tìm thấy địa chỉ này, hãy thử viết khác đi (vd chỉ tên đường + tỉnh/thành)" | Đạt |
| HOME-09 | P2 | Enter để tìm | Gõ địa chỉ rồi nhấn Enter | Giống bấm nút tìm | Đạt |
| HOME-10 | P2 | Dùng vị trí hiện tại | Bấm "Dùng vị trí hiện tại" → cho phép | Sang `/tim-viec` với label "Vị trí hiện tại của bạn" | Đạt |
| HOME-11 | P2 | Từ chối vị trí | Chặn quyền vị trí rồi bấm "Dùng vị trí hiện tại" | "Không lấy được vị trí hiện tại. Hãy cho phép trình duyệt truy cập vị trí, hoặc nhập địa chỉ." | Đạt |
| HOME-12 | P2 | Link tuyển người | "Bạn cần tuyển người? Đăng tin miễn phí →", "Đăng tin ngay", "Đăng tin đầu tiên" | Đều sang `/register?role=employer`, thẻ "Tuyển người" chọn sẵn | Đạt |
| HOME-13 | P2 | Link header cuộn trang | Bấm "Cách hoạt động", "Gợi ý AI", "Câu hỏi" | Cuộn tới đúng khối | Đạt |
| HOME-14 | P3 | Loại việc chỉ minh hoạ | Bấm các ô "Dọn dẹp nhà", "Trông trẻ"… | Không có gì xảy ra (không lọc theo ngành, đúng brief) | Đạt |
| HOME-15 | P2 | Tab Cách hoạt động | Chuyển "Người tìm việc" ↔ "Người đăng tin" | 3 bước đổi nội dung đúng vai trò | Đạt |
| HOME-16 | P2 | Ví dụ AI | Khối "Gợi ý AI khác gì" | Nhãn "Ví dụ minh hoạ", thẻ 83% "Rất phù hợp", 4 lý do. Bấm "Xem cách tính điểm" → 4 thanh + công thức "35% mô tả + 35% giờ rảnh + 20% khoảng cách + 10% tin cậy" | Đạt |
| HOME-17 | P2 | **[HQ]** Câu chữ về giờ rảnh | Đọc ý 2 khối AI và FAQ "Lịch rảnh khác ca làm cố định thế nào?" | Nói "được xếp lên trước" / "được điểm theo tỉ lệ". **Không** còn câu kiểu "chỉ được coi là hợp khi…" hay "phải nằm trọn" | Đạt |
| HOME-18 | P3 | FAQ | Bấm từng câu hỏi | Câu 1 mở sẵn; bấm để mở/đóng, mũi tên xoay | Đạt |
| HOME-19 | P2 | Footer | Bấm Tìm việc / Gợi ý cho tôi / Đăng ký / Đăng tin | `/tim-viec` · `/login?next=%2Fseeker` · `/register` · `/register?role=employer` | Đạt |
| HOME-20 | P1 | Đã đăng nhập vào trang chủ | Đăng nhập lan, bấm logo | Chuyển thẳng về `/seeker` (người đăng tin: `/employer`) | Đạt |
| HOME-21 | P2 | Chưa có việc nào | SQL `UPDATE jobs SET status='closed';` rồi mở `/` (seed lại sau đó) | Empty state "Chưa có việc nào đang mở" + 2 nút "Đăng ký tìm việc", "Đăng tin đầu tiên"; không có badge đếm | Đạt |
| HOME-22 | P3 | Đang tải | DevTools → Network → Slow 3G, tải lại | 3 thẻ khung xám (skeleton) trước khi có dữ liệu | Đạt |

## 6. Tìm việc (S5)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| SRCH-01 | P1 | Khách xem được | Chưa đăng nhập, mở `/tim-viec` | Banner xanh "Bạn đang xem với tư cách khách…" + link "Đăng nhập" (link giữ nguyên bộ lọc hiện tại qua `next`). Thấy 12 việc, "mới đăng trước" | Đạt |
| SRCH-02 | P1 | Lọc theo vị trí | Chọn vị trí Bạch Mai | URL có `lat,lng,label`. Việc sắp **gần → xa**, mỗi thẻ có "· x,xx km"; dòng đếm "N việc trong bán kính 5 km · gần nhất trước". Việc ở TP.HCM, Đà Nẵng biến mất | Đạt |
| SRCH-03 | P1 | Đổi bán kính | Chọn 2 km → 10 km | Số việc tăng khi bán kính tăng; mọi khoảng cách ≤ bán kính; URL có `r=` | Đạt |
| SRCH-04 | P2 | Bán kính khi chưa có vị trí | Chưa chọn vị trí, chọn ngày | Gợi ý "Chưa chọn vị trí nên bán kính chưa áp dụng." | Đạt |
| SRCH-05 | P1 | Lọc theo ngày | Chọn ngày = thứ 7 tới | Chỉ còn việc thứ 7 (J1, J8, J9, J14…). Ô giờ mở khoá, mặc định 06:00–22:00 | Đạt |
| SRCH-06 | P1 | Lọc khung giờ = **chồng lấp** | Ngày thứ 7, khung 10:00–12:00 | J1 (08:00–11:00) **vẫn hiện** vì chồng lấp 10:00–11:00. Việc 13:30–18:00 không hiện | Đạt |
| SRCH-07 | P2 | Ô giờ khoá khi chưa chọn ngày | Chưa chọn ngày | 2 ô giờ bị khoá, rê chuột thấy "Chọn ngày trước" | Đạt |
| SRCH-08 | P2 | Giờ kết thúc ≤ giờ bắt đầu | Khung 12:00–10:00 | "Giờ kết thúc phải sau giờ bắt đầu.", ô giờ đỏ, **không** gửi request | Đạt |
| SRCH-09 | P2 | Không chọn được ngày đã qua | Mở lịch ô Ngày | Không chọn được ngày trước hôm nay | Đạt |
| SRCH-10 | P2 | Không có kết quả | Ngày thứ 7, khung 22:00–23:00 | "Không có việc nào khớp bộ lọc" + nút "Bỏ lọc khung giờ" → bấm thì hết lọc ngày | Đạt |
| SRCH-11 | P2 | Ngoài vùng có việc | Vị trí `Vũng Tàu`, bán kính 5 km | "Chưa có việc nào trong bán kính 5 km" + "Mở rộng lên 10 km" | Đạt |
| SRCH-12 | P1 | Giữ bộ lọc qua F5 / chia sẻ link | Đặt vị trí + 10 km + ngày, nhấn F5; copy URL mở tab ẩn danh | Bộ lọc giữ nguyên, kết quả giống nhau | Đạt |
| SRCH-13 | P1 | Xem bản đồ | Bấm "Bản đồ" | Bên trái danh sách, bên phải bản đồ OSM có **nền bản đồ** (không xám trơn); ghim hiện tiền công; chấm xanh "Bạn ở đây"; bản đồ tự thu phóng vừa các ghim. URL có `view=map` | Đạt |
| SRCH-14 | P2 | Chọn việc trên bản đồ | Bấm 1 ghim; rồi bấm 1 dòng ở danh sách | Ghim được chọn đổi màu cam đậm; dòng tương ứng tô teal; thẻ nhỏ hiện ở dưới bản đồ với "Chi tiết" và "Ứng tuyển" | Đạt (xem quan sát O1) |
| SRCH-15 | P2 | Quay lại danh sách | Bấm "Danh sách" | Về lưới thẻ; `view` bị xoá khỏi URL | Đạt |
| SRCH-16 | P1 | **[HQ]** Người tìm việc thấy sẵn trạng thái đơn | Đăng nhập lan, `/tim-viec` | Thẻ J1 hiện "Đã ứng tuyển · Chờ duyệt", J7 hiện badge "Đã nhận", **không** có nút Ứng tuyển. Các việc khác có nút | Đạt (sau khi sửa Bug #2) |
| SRCH-17 | P2 | Người đăng tin mở trang tìm việc | Đăng nhập huong, gõ `/tim-viec` | Xem được, **không** có nút Ứng tuyển | Đạt |
| SRCH-18 | P2 | Mất kết nối backend | `docker compose stop backend`, tải lại (xong thì `start` lại) | Banner đỏ "Không tải được danh sách việc" | Đạt |

## 7. Chi tiết việc (S6, modal)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| DET-01 | P1 | Nội dung | Mở chi tiết J1 từ `/tim-viec` có vị trí | Badge "Đang mở", tiêu đề; ô Thời gian (`T7, dd/mm`, `08:00–11:00 · 3 giờ`), Tiền công (`270.000 đ`, "cho cả buổi"), Khoảng cách ("từ vị trí bạn chọn"); địa chỉ đủ 3 phần; bản đồ nhỏ có ghim cam đúng chỗ; mô tả đầy đủ, giữ xuống dòng | Đạt |
| DET-02 | P2 | Không có ô khoảng cách | Mở chi tiết khi chưa chọn vị trí | Chỉ 2 ô Thời gian, Tiền công | Đạt |
| DET-03 | P1 | Mở từ trang Gợi ý | Mở chi tiết từ `/seeker` | Có thêm khối "Vì sao gợi ý việc này" (vòng %, 4 lý do, bảng cách tính); ô khoảng cách ghi "~N phút đi lại" | Đạt |
| DET-04 | P1 | Tin đã kết thúc | Đăng nhập tuananh → "Đơn ứng tuyển" → "Xem việc" ở J11 | Badge khoá "Đã kết thúc"; chân modal "Tin đã kết thúc — không nhận thêm đơn ứng tuyển." | Đạt |
| DET-05 | P2 | Các cách đóng | Nút X, nút "Đóng", phím Esc, bấm ra nền tối | Cả 4 cách đều đóng modal | Đạt |
| DET-06 | P1 | Chặn ứng tuyển tin đã kết thúc (API) | Token lan → `POST /applications` với id J13 (đã qua giờ) rồi J11 (đã đóng) | 400 "Công việc này đã kết thúc" / "Tin tuyển dụng đã đóng" | Đạt |

## 8. Gợi ý cho tôi (S4) — màn quan trọng nhất

Tiền điều kiện: seed sạch. Vị trí test chính: **Bạch Mai, Hà Nội** (gần nhà lan).

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| RECO-01 | P1 | Lần đầu chọn vị trí | Đăng nhập lan (DevTools xoá key `reco_place:*` nếu có) | Hộp "Bạn muốn tìm việc quanh đâu?"; nút "Xem gợi ý" khoá tới khi chọn được vị trí; bán kính mặc định 5 km; khung trái "Chọn một địa chỉ ở trên để xem việc phù hợp quanh bạn." | Đạt |
| RECO-02 | P1 | Xem gợi ý | Tìm `Bạch Mai, Hà Nội`, chọn kết quả, bấm "Xem gợi ý" | Hộp chọn thu gọn thành 1 dòng góc phải "📍 <địa chỉ> \| Bán kính 5 km [Đổi]". Dòng "N việc trong bán kính 5 km · xếp theo mức phù hợp" | Đạt |
| RECO-03 | P1 | Nhớ vị trí theo tài khoản | F5; đăng xuất rồi đăng nhập lại lan; sau đó đăng nhập hung | lan: không phải chọn lại. hung: được hỏi chọn vị trí (không dùng vị trí của lan) | Đạt |
| RECO-04 | P2 | Đổi vị trí | Bấm "Đổi" → "Huỷ"; rồi "Đổi" → chọn 10 km → "Xem gợi ý" | Huỷ: giữ nguyên. Lưu: danh sách tải lại theo 10 km | Đạt |
| RECO-05 | P1 | Sắp xếp | Xem danh sách | % giảm dần từ trên xuống | Đạt |
| RECO-06 | P1 | Nội dung thẻ AI | Xem thẻ đầu | Vòng %, nhãn (≥70% "Rất phù hợp", 50–69% "Khá phù hợp", <50% "Ít phù hợp"); địa chỉ; tiền; thanh thời gian 6h–22h có khối teal (giờ rảnh) + khối đen (giờ làm); 4 lý do; thẻ **đầu tiên** mở sẵn "Cách tính điểm", thẻ sau thì đóng | Đạt |
| RECO-07 | P1 | Công thức điểm đúng | Mở "Xem cách tính điểm" ở 3 thẻ, lấy 4 số % | `Tổng ≈ 0,35×Mô tả + 0,35×Giờ rảnh + 0,2×Khoảng cách + 0,1×Tin cậy` (lệch ≤ 1% do làm tròn). Tin cậy luôn 100% màu xám + "Chưa có đánh giá" | Đạt |
| RECO-08 | P1 | Điểm khoảng cách | So cột Khoảng cách với km | `Điểm = 1 − km ÷ bán kính` (vd 1 km / 5 km → 80%). Dòng ghi "x km / bán kính 5 km" | Đạt |
| RECO-09 | P1 | Lý do "Nằm trọn" | lan, việc cuối tuần trong 07:00–20:00 (vd J7, J10) | "✓ Nằm trọn trong giờ rảnh của bạn (đã tính N phút đi lại)", thanh Giờ rảnh 100% · "Nằm trọn" | Đạt |
| RECO-10 | P1 | Lý do "Một phần" | Đăng nhập trang (rảnh tối từ 18:30), vị trí Thanh Xuân, 10 km, xem J2 (18:00–21:30) | Icon đồng hồ vàng "Trùng một phần giờ rảnh của bạn (x% thời gian, đã tính đi lại)"; thanh thời gian thấy khối giờ làm lấn ra ngoài khối rảnh | Đạt |
| RECO-11 | P1 | Lý do "Ngoài giờ" | lan xem J2 (tối T4, lan không rảnh tối) | "✗ Ngoài giờ rảnh của bạn", Giờ rảnh 0% | Đạt |
| RECO-12 | P1 | Thời gian đi lại | Đối chiếu km và phút | Phút ≈ km ÷ 20 km/h × 60, tối thiểu 1 (vd 0,5 km → ~2 phút) | Đạt |
| RECO-13 | P2 | Câu khớp mô tả | Xem cột Mô tả | ≥30% "Khớp tốt với mô tả của bạn"; 10–29% "Có liên quan tới…"; <10% "Ít liên quan tới…" | Đạt |
| RECO-14 | P1 | Mô tả gõ không dấu | Đăng nhập tuananh ("don nha, khuan do…"), vị trí Ngọc Hà/Ba Đình, 10 km | J1 "Dọn nhà sáng thứ 7" có điểm Mô tả > 0 (khớp được dù không dấu) | Đạt |
| RECO-15 | P1 | Nhắc khai hồ sơ | Đăng nhập phuong, chọn vị trí | Banner xanh "Bạn chưa khai lịch rảnh sắp tới và mô tả bản thân" + nút "Cập nhật hồ sơ" (→ `/seeker/profile`) + nút X ẩn banner. Mọi việc đều "Ngoài giờ rảnh" | Đạt |
| RECO-16 | P2 | Nhắc thiếu 1 thứ | phuong khai 1 khoảng rảnh (mục 9) rồi quay lại | Banner chỉ còn "Bạn chưa khai mô tả bản thân" | Đạt |
| RECO-17 | P1 | **[HQ]** Trạng thái đơn hiện sẵn | lan xem danh sách | J1: "Đã ứng tuyển · Chờ duyệt"; J7: badge "Đã nhận". Không cần bấm mới biết | Đạt |
| RECO-18 | P1 | Ứng tuyển | Bấm "Ứng tuyển" ở 1 việc chưa nộp | Nút "Đang gửi…" → đổi thành "Đã ứng tuyển · Chờ duyệt"; toast "Đã gửi đơn ứng tuyển" có link "Đơn ứng tuyển". F5 vẫn giữ trạng thái | Đạt |
| RECO-19 | P1 | **[HQ]** Ứng tuyển trong modal | Mở "Xem chi tiết" 1 việc khác → "Ứng tuyển" trong modal → đóng modal | Modal đổi sang "Đã ứng tuyển · Chờ duyệt"; thẻ ngoài danh sách cũng đổi theo | Đạt (sau khi sửa Bug #2) |
| RECO-20 | P2 | Nộp trùng từ tab khác | Mở 2 tab `/seeker`, ứng tuyển cùng 1 việc ở tab 1 rồi tab 2 | Tab 2: toast đỏ "Bạn đã ứng tuyển việc này"; sau đó hiện đúng trạng thái thật | Đạt |
| RECO-21 | P2 | Không có việc trong bán kính | Đổi vị trí sang `Vũng Tàu`, 2 km | "Chưa có việc nào trong bán kính 2 km" + "Mở rộng lên 10 km" (bấm → bán kính 10) + "Đổi vị trí" | Đạt |
| RECO-22 | P1 | AI dự phòng | `docker compose stop ai-service`, tải lại `/seeker` | Banner vàng "AI tạm thời không phản hồi — đang xếp theo khoảng cách". Thẻ không có vòng %, chỉ ô "x km"; không có thanh thời gian/lý do; chân thẻ "Chưa có điểm phù hợp khi AI tạm dừng"; dòng đếm "…xếp theo khoảng cách, gần nhất trước"; sắp gần → xa | Đạt |
| RECO-23 | P1 | Khôi phục sau dự phòng | `docker compose start ai-service`, đợi `/health` 200, bấm "Thử lại" trên banner | Về chế độ AI, có % và lý do | Đạt |
| RECO-24 | P2 | Backend lỗi | `docker compose stop backend`, bấm "Đổi" → "Xem gợi ý" | Banner đỏ "Không tải được gợi ý" + "Thử lại" | Đạt |
| RECO-25 | P2 | Cột bên phải | Xem "Lịch rảnh sắp tới" và "Mô tả của bạn" | Tối đa 5 ngày tới, không có ngày đã qua; lan ngày T7 hiện cả 2 khoảng "07:00–20:00, 08:00–10:00". Mô tả đúng nội dung đã lưu; phuong: "Chưa có mô tả." "Sửa" → trang Hồ sơ | Đạt |
| RECO-26 | P3 | Đang tải | Network Slow 3G | Dòng "Đang tìm việc hợp với giờ rảnh của bạn…" + 2 thẻ khung xám | Đạt |
| RECO-27 | P2 | Việc ở thành phố khác | duc (Đà Nẵng), vị trí Hải Châu Đà Nẵng | Thấy J9 "Trông 2 bé chiều thứ 7", không thấy việc Hà Nội | Đạt |

## 9. Hồ sơ & lịch rảnh (S7)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| PROF-01 | P2 | Chưa khai gì | Đăng nhập phuong → "Hồ sơ & lịch rảnh" | Empty state "Bạn chưa khai giờ rảnh nào" + 3 bước hướng dẫn. **[HQ]** Câu "AI ưu tiên việc nằm trọn trong giờ bạn rảnh. Chưa khai thì mọi việc đều bị tính là ngoài giờ rảnh." | Đạt |
| PROF-02 | P1 | Thêm khoảng rảnh | "Thêm khoảng rảnh" → ngày mai → giờ `07:15`–`11:40` → "Lưu khoảng rảnh" | Toast "Đã lưu lịch rảnh" kèm `T?, dd/mm · 07:15–11:40`; timeline 0–24h hiện khối **đúng 07:15–11:40** (không bị làm tròn về ca) | Đạt |
| PROF-03 | P2 | Nút điền nhanh | Bấm "Sáng 7–11", "Chiều 13–17", "Tối 18–21" | Ô giờ điền sẵn đúng giờ, vẫn sửa tay được; khung xem trước di chuyển theo | Đạt |
| PROF-04 | P1 | Giờ kết thúc ≤ bắt đầu | 11:00–07:00 | "Giờ kết thúc phải sau giờ bắt đầu. Khoảng rảnh qua nửa đêm thì tách thành 2 khoảng."; nút Lưu khoá | Đạt |
| PROF-05 | P1 | Khoảng đã qua | Ngày hôm nay, giờ kết thúc sớm hơn giờ hiện tại | "Khoảng rảnh này đã qua, hãy chọn giờ trong tương lai.", không lưu | Đạt |
| PROF-06 | P2 | Không chọn ngày quá khứ | Mở lịch | Không chọn được ngày trước hôm nay | Đạt |
| PROF-07 | P2 | Thêm vào ngày có sẵn | Bấm nút "+" cuối hàng 1 ngày | Modal mở với ngày đó điền sẵn | Đạt |
| PROF-08 | P2 | Khoảng chồng nhau | lan: xem ngày T7 | 2 khối chồng nhau đều hiện (07:00–20:00 và 08:00–10:00); hệ thống chấp nhận | Đạt |
| PROF-09 | P1 | Xoá khoảng rảnh | Rê chuột lên 1 khối → bấm X đỏ | Toast "Đã xoá khoảng rảnh"; khối biến mất; ngày không còn khoảng nào thì mất hàng | Đạt |
| PROF-10 | P2 | Xoá bằng bàn phím | Tab tới nút X của khối | Nút X hiện khi được focus, Enter xoá được | Đạt |
| PROF-11 | P2 | Không hiện khoảng đã qua | SQL thêm 1 khoảng hôm qua cho lan | Không hiện trên trang | Đạt |
| PROF-12 | P2 | Đóng modal | Huỷ / X / Esc / bấm nền | Đóng, không lưu | Đạt |
| PROF-13 | P1 | Lưu mô tả | Sửa mô tả → "Lưu mô tả" | Toast "Đã lưu mô tả"; F5 vẫn còn; trang Gợi ý dùng mô tả mới (điểm Mô tả thay đổi) | Đạt |
| PROF-14 | P2 | Giới hạn 2000 ký tự | Dán 2100 ký tự | Chỉ nhận 2000; bộ đếm "2000/2000" | Đạt |
| PROF-15 | P2 | Xoá trắng mô tả | Xoá hết → Lưu | Lưu được; trang Gợi ý hiện nhắc "…mô tả bản thân" | Đạt |
| PROF-16 | P3 | Liên hệ | Xem khối "Liên hệ" với lan và tuananh | lan: badge xanh "Đã xác minh"; tuananh: badge vàng "Chưa xác minh" | Đạt |
| PROF-17 | P3 | **[HQ]** Câu hướng dẫn dưới lịch | Có ít nhất 1 khoảng rảnh | "Việc nằm trọn trong giờ rảnh (đã tính thời gian đi lại) được điểm giờ rảnh cao nhất, trùng một phần thì được điểm theo tỉ lệ…" | Đạt |

## 10. Đơn ứng tuyển của tôi (S8)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| APP-01 | P1 | Danh sách + tab | Đăng nhập nam → "Đơn ứng tuyển" | Tab có số đếm: Tất cả 3 · Chờ duyệt 1 · Đã nhận 0 · Khác 2. Mới nhất trước | Đạt |
| APP-02 | P2 | Lọc theo tab | Bấm từng tab | "Khác" gồm Bị từ chối + Đã hủy; tab rỗng hiện "Không có đơn nào ở mục này." | Đạt |
| APP-03 | P2 | Ghi chú theo trạng thái | Xem từng đơn | Chờ duyệt: "Đang chờ người đăng tin xem đơn." · Bị từ chối: "Đơn không được nhận lần này…" · Đã hủy: "Bạn đã hủy đơn này." Đơn từ chối/hủy mờ hơn | Đạt |
| APP-04 | P1 | Đơn đã nhận | Đăng nhập lan | J7 badge "Đã nhận", chữ xanh "Người đăng tin đã nhận bạn. Nhớ đến đúng giờ: CN, dd/mm lúc 07:30." | Đạt |
| APP-05 | P1 | Hủy đơn | lan → J1 → "Hủy đơn" → "Hủy đơn" | Modal "Hủy đơn ứng tuyển?". Sau khi xác nhận: toast "Đã hủy đơn", modal đóng, J1 thành "Đã hủy", số đếm cập nhật | Đạt |
| APP-06 | P2 | Giữ đơn | "Hủy đơn" → "Giữ đơn" | Modal đóng, đơn vẫn Chờ duyệt | Đạt |
| APP-07 | P1 | Chỉ hủy được đơn chờ duyệt | Xem đơn Đã nhận / Bị từ chối | Không có nút "Hủy đơn" | Đạt |
| APP-08 | P1 | Ứng tuyển lại sau khi hủy | Sau APP-05 vào "Gợi ý cho tôi" | J1 có lại nút "Ứng tuyển"; nộp lại được; danh sách đơn có cả đơn cũ (Đã hủy) và đơn mới (Chờ duyệt) | Đạt |
| APP-09 | P1 | Không nộp lại được khi bị từ chối | Token nam → `POST /applications` J10 | 409 "Bạn đã ứng tuyển job này" | Đạt |
| APP-10 | P1 | Tranh chấp hủy/nhận | Tab 1: lan mở "Đơn ứng tuyển". Tab 2: huong nhận lan ở J1. Quay lại tab 1 bấm "Hủy đơn" (chưa F5) | Toast đỏ "Đơn không còn ở trạng thái chờ duyệt"; F5 thấy "Đã nhận" | Đạt |
| APP-11 | P2 | Xem việc | Bấm "Xem việc" | Modal chi tiết, **không** có nút Ứng tuyển | Đạt |
| APP-12 | P2 | Chưa có đơn | Đăng nhập phuong | "Bạn chưa ứng tuyển việc nào" + nút "Xem gợi ý cho tôi" | Đạt |

## 11. Người đăng tin — Tin đã đăng (S9)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| EMP-01 | P1 | Danh sách | Đăng nhập huong | Có J1, J2 (tin tạo sau nằm trên); mỗi tin có tiêu đề, badge "Đang mở", giờ, địa chỉ đầy đủ, tiền; nút "Đóng tin", "Sửa", "Xem đơn"; nút cam "Đăng tin mới" nổi bật | Đạt |
| EMP-02 | P2 | Tin đã qua giờ làm | Đăng nhập minh | J13 ghi "Đã qua giờ làm — tin không còn hiện với người tìm việc." | Đạt |
| EMP-03 | P2 | Tin đã đóng | Đăng nhập nhahang | J11 badge "Đã đóng", **chỉ** có "Xem đơn" (không có Đóng tin, Sửa) | Đạt |
| EMP-04 | P1 | Đóng tin | huong → J2 → "Đóng tin" → "Đóng tin" | Modal "Đóng tin này?" nói rõ đơn cũ vẫn giữ. Sau xác nhận: toast "Đã đóng tin", badge "Đã đóng". J2 biến mất khỏi `/tim-viec` và trang gợi ý; đơn của trang ở J2 vẫn còn | Đạt |
| EMP-05 | P2 | Giữ tin | "Đóng tin" → "Giữ tin" | Không đổi gì | Đạt |
| EMP-06 | P2 | Chưa có tin | Đăng nhập hai | "Bạn chưa đăng tin nào" + nút "Đăng tin đầu tiên" | Đạt |
| EMP-07 | P3 | Badge chờ duyệt / bị từ chối | SQL đổi `status` 1 tin của huong thành `pending_approval`, rồi `rejected` | Badge "Chờ duyệt" (vàng) / "Bị từ chối" (đỏ) kèm ghi chú tương ứng (chưa có luồng admin thật — chỉ kiểm hiển thị) | Đạt |

## 12. Đăng / sửa tin (S10)

Tiền điều kiện: đăng nhập huong, "Đăng tin mới".

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| FORM-01 | P1 | Đăng tin thành công | Điền đủ 3 mục, ngày mai 14:00–17:00, tiền 240000, ghim vị trí → "Đăng tin" | Toast "Đã đăng tin"; về `/employer`, tin mới ở đầu, badge "Đang mở" | Đạt |
| FORM-02 | P1 | Tin mới tới được người tìm việc | Sau FORM-01, đăng nhập lan, vị trí gần chỗ ghim | Tin xuất hiện ở `/tim-viec` và trang Gợi ý, giờ hiện **đúng 14:00–17:00** (không lệch múi giờ) | Đạt |
| FORM-03 | P1 | Chưa ghim vị trí | Chặn quyền vị trí, điền đủ nhưng không ghim → "Đăng tin" | Banner đỏ "Còn 1 mục cần sửa trước khi đăng: chưa ghim vị trí trên bản đồ (mục 2)." + "Tới mục đó"; trang cuộn tới mục 2; dưới bản đồ "Bạn cần ghim vị trí để người tìm việc biết khoảng cách tới nhà bạn." | Đạt |
| FORM-04 | P1 | Tự ghim bằng GPS | Cho phép vị trí, mở form | Bản đồ zoom tới vị trí, có ghim + "Kéo ghim tới đúng cửa nhà"; dòng "Toạ độ đã chọn: …" | Đạt |
| FORM-05 | P2 | Từ chối GPS | Chặn vị trí, mở form | Bản đồ toàn Việt Nam, lớp phủ "Chưa ghim vị trí…", **không** báo lỗi | Đạt |
| FORM-06 | P1 | Bấm / kéo ghim | Bấm 1 điểm trên bản đồ; kéo ghim sang chỗ khác | Ghim tới đúng chỗ; toạ độ cập nhật sau mỗi thao tác | Đạt |
| FORM-07 | P1 | Định vị theo địa chỉ | Điền `Đội Cấn` / `Phường Ngọc Hà` / `Hà Nội` → "Định vị trên bản đồ" | Danh sách kết quả; chọn 1 kết quả → ghim nhảy tới, dòng đó ghi "Đã chọn". **Không** tự ghim theo kết quả đầu | Đạt |
| FORM-08 | P2 | Định vị khi chưa có địa chỉ | Để trống 3 ô địa chỉ → "Định vị trên bản đồ" | "Hãy nhập địa chỉ ở trên trước khi định vị" | Đạt |
| FORM-09 | P1 | Giờ sai | Giờ kết thúc 08:00, bắt đầu 11:00 → "Đăng tin" | Lỗi "Giờ kết thúc phải sau giờ bắt đầu (11:00). Một tin chỉ gồm một khung giờ trong cùng ngày."; banner "giờ làm chưa hợp lệ (mục 3)" | Đạt |
| FORM-10 | P1 | Buổi làm đã qua | Ngày hôm nay, giờ kết thúc đã qua | "Buổi làm này đã qua — hãy chọn ngày giờ trong tương lai.", không gửi được | Đạt |
| FORM-11 | P2 | Độ dài buổi làm | 08:00–11:30 | "Buổi làm dài 3,5 giờ" | Đạt |
| FORM-12 | P1 | Trường bắt buộc | Bỏ trống lần lượt tiêu đề, mô tả, số nhà, phường, tỉnh/TP, ngày, tiền | Trình duyệt báo thiếu, không gửi. Tiêu đề < 3 ký tự, địa chỉ < 2 ký tự cũng bị chặn | Đạt |
| FORM-13 | P2 | Tiền công | Nhập `-1000`; `250500`; `0` | Âm và lẻ bước 1.000 bị trình duyệt chặn; `0` được chấp nhận (backend cho ≥ 0) | Đạt |
| FORM-14 | P2 | Xem trước | Gõ dần tiêu đề, phường, tỉnh, ngày giờ, tiền | Thẻ "Xem trước" bên phải cập nhật ngay; khi trống hiện chữ gợi ý "Tiêu đề công việc", "Chưa chọn ngày giờ", `0 đ` | Đạt |
| FORM-15 | P1 | Sửa tin | "Tin đã đăng" → J1 → "Sửa" | Form điền sẵn mọi trường, ghim đúng chỗ (zoom gần); đổi tiền → "Lưu thay đổi" → toast "Đã lưu thay đổi", danh sách hiện số mới | Đạt |
| FORM-16 | P2 | Chuyển giữa sửa và tạo mới | Đang ở form Sửa J1, bấm menu "Đăng tin mới" | Form trống hoàn toàn (không mang dữ liệu J1) | Đạt |
| FORM-17 | P1 | Sửa tin người khác qua URL | Đăng nhập tuan, mở `/employer/jobs/<id J1>/edit` | "Không tìm thấy tin" + nút "← Tin đã đăng" | Đạt |
| FORM-18 | P2 | Huỷ | Bấm "Huỷ" / "← Tin đã đăng" | Về `/employer`, không lưu | Đạt |
| FORM-19 | P3 | Lỗi từ server | Swagger `POST /jobs` với `salary` = 3000000000 | 422. *Đã biết: thông báo validation của backend là tiếng Anh* | Đạt |

## 13. Đơn ứng tuyển của một tin (S11)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| APPL-01 | P1 | Danh sách ứng viên | huong → J1 → "Xem đơn" | Đầu trang: tiêu đề, badge, giờ, địa chỉ, tiền, nút "Sửa tin". 2 ứng viên lan, nam: avatar chữ cái đầu email, email (link mailto), SĐT (link gọi), "Ứng tuyển dd/mm, hh:mm", badge "Chờ duyệt", nút "Từ chối" + "Nhận" | Đạt |
| APPL-02 | P1 | Nhận | Bấm "Nhận" ở lan | Toast "Đã nhận lan.nguyen@example.com"; dòng lan nền xanh nhạt, badge "Đã nhận", "Hãy gọi để hẹn giờ và chỉ đường tới nhà."; nút thay bằng "Đã xử lý dd/mm, hh:mm" | Đạt |
| APPL-03 | P1 | Người tìm việc thấy kết quả | Đăng nhập lan → "Đơn ứng tuyển" | J1 "Đã nhận" | Đạt |
| APPL-04 | P1 | Từ chối | Bấm "Từ chối" ở nam | Toast "Đã từ chối nam.do@example.com"; dòng mờ, badge "Bị từ chối"; nam thấy "Bị từ chối" | Đạt |
| APPL-05 | P2 | Đơn đã hủy | tuan → J3 | Đơn nam: badge "Đã hủy", "Người ứng tuyển đã hủy", không có nút | Đạt |
| APPL-06 | P2 | Ứng viên không có SĐT | nhahang → J11 (đơn của tuananh) | "Chưa có số điện thoại" | Đạt |
| APPL-07 | P2 | Chưa ai ứng tuyển | minh → J12 | "Chưa có ai ứng tuyển" + câu nhắc có ngày giờ của tin | Đạt |
| APPL-08 | P1 | Xử lý đơn đã bị hủy | Tab 1: huong mở đơn J1. Tab 2: lan hủy đơn J1. Tab 1 bấm "Nhận" (chưa F5) | Toast đỏ "Đơn không còn ở trạng thái chờ duyệt" | Đạt |
| APPL-09 | P2 | Chống bấm 2 lần | Bấm "Nhận" liên tục | Nút khoá + spinner trong lúc gửi, chỉ 1 request | Đạt |
| APPL-10 | P3 | Nhận nhiều người cho 1 tin | Nhận cả lan và nam ở J1 | Hệ thống cho phép (chưa có giới hạn số người) — ghi nhận hành vi | Đạt |

## 14. Quản trị (S12)

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| ADM-01 | P2 | Trang khung quản trị | SQL `UPDATE users SET role='admin' WHERE email='hai.cao@example.com';`, đăng nhập hai | Vào `/admin`: tiêu đề "Duyệt tin", nhãn "Quản trị viên", thông báo chức năng sẽ có ở các tuần sau. Menu chỉ có "Duyệt tin". Seed lại sau khi test | Đạt |
| ADM-02 | P2 | Admin vào trang vai trò khác | Mở `/seeker`, `/employer` | Bị đưa về `/admin` | Đạt |

## 15. Giao diện chung & phi chức năng

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| UI-01 | P1 | Không lỗi Console | Đi hết các luồng chính với DevTools mở | Tab Console không có lỗi đỏ | Đạt |
| UI-02 | P2 | Laptop phổ thông | Cửa sổ 1366×768, xem mọi trang | Không vỡ bố cục, không chữ đè nhau, không thanh cuộn ngang | Đạt |
| UI-03 | P2 | Menu đang chọn | Chuyển qua các mục menu | Mục hiện tại nền teal nhạt, chữ đậm | Đạt |
| UI-04 | P2 | Toast | Làm 1 thao tác có toast | Hiện góc trên phải, tự tắt sau ~5 giây, bấm X tắt ngay | Đạt |
| UI-05 | P2 | Bàn phím | Dùng Tab/Shift+Tab/Enter/Space trên form đăng ký, đăng nhập, đăng tin | Đi được hết các ô và nút theo thứ tự hợp lý, thấy rõ viền focus; chọn được thẻ vai trò bằng bàn phím | Đạt |
| UI-06 | P3 | Chữ & màu | Kiểm bằng mắt | Font Be Vietnam Pro, chữ thân ≥ 16px, ô nhập/nút cao ≥ 40px; trạng thái luôn có chữ + icon (không chỉ màu) | Đạt |
| UI-07 | P3 | Tiêu đề tab & favicon | Nhìn tab trình duyệt | "TimViecPartTime — Việc làm thêm vừa với giờ rảnh", favicon đồng hồ teal | Đạt |
| UI-08 | P2 | Nút Back/Forward | Đổi bộ lọc ở `/tim-viec`, qua trang khác, bấm Back | Quay lại đúng trang và bộ lọc | Đạt |
| UI-09 | P2 | Định dạng | Soát toàn app | Ngày `T7, 03/10 · 08:00–11:00`; tiền `250.000 đ`; km dùng dấu phẩy `0,51 km` | Đạt |
| UI-10 | P3 | Menu tài khoản | Mở menu rồi bấm ra ngoài | *Đã biết: menu không tự đóng khi bấm ra ngoài* — ghi nhận | Đạt |

## 16. Kiểm thử tự động (bắt buộc xanh trước khi merge)

| ID | UT | Lệnh | Kết quả mong đợi | KQ |
|---|---|---|---|---|
| AUTO-01 | P1 | `cd backend && .venv/Scripts/python -m pytest` (db đang chạy) | Tất cả pass (44 test) | Đạt |
| AUTO-02 | P1 | `cd ai-service && .venv/Scripts/python -m pytest` | Tất cả pass (21 test) | Đạt |
| AUTO-03 | P1 | `cd frontend && npm run build` | Build thành công (cảnh báo bundle > 500 kB chấp nhận được) | Đạt |
| AUTO-04 | P1 | `cd frontend && npm run lint` | 0 lỗi (cảnh báo chấp nhận được) | Đạt |
| AUTO-05 | P1 | Mở PR `feat/week6-ui` → `main` | GitHub Actions xanh | Đạt (CI trên main, commit f37e738) |

## 17. Smoke test production (ngay sau khi merge)

Merge = deploy. Production **không có dữ liệu seed**, dùng tài khoản test riêng và xoá tin test sau khi xong.

| ID | UT | Tình huống | Các bước | Kết quả mong đợi | KQ |
|---|---|---|---|---|---|
| PROD-01 | P1 | Service sống | Mở `https://timviec-backend.onrender.com/health` và `/health` của `timviec-ai` (đợi service thức, có thể 30–50 giây) | `{"status":"ok"}` | Đạt |
| PROD-02 | P1 | Giao diện mới đã lên | Mở `https://datn-timviecparttime.onrender.com` | Thấy trang chủ S0 mới, không lỗi Console | Đạt |
| PROD-03 | P1 | Tải lại ở đường dẫn sâu | Mở thẳng `…/tim-viec` và `…/seeker/profile`, nhấn F5 | Không bị 404 (Static Site cần rule Rewrite `/*` → `/index.html`) | Đạt |
| PROD-04 | P1 | CORS | Đăng ký 1 tài khoản test trên production | Thành công, tab Console không có lỗi CORS | Đạt |
| PROD-05 | P1 | Luồng chính | Tài khoản người đăng tin test đăng 1 tin → tài khoản người tìm việc test khai lịch rảnh, xem gợi ý, ứng tuyển → người đăng tin nhận | Đi hết không lỗi | Đạt |
| PROD-06 | P1 | AI thật, không phải dự phòng | Trang Gợi ý sau khi đã đặt `AI_SERVICE_URL` | Có vòng % và lý do, **không** có banner "AI tạm thời không phản hồi". Nếu còn banner: kiểm biến `AI_SERVICE_URL` trên `timviec-backend` | Lỗi #3 |
| PROD-07 | P2 | Dọn dẹp | Đóng tin test | Tin không còn hiện với người khác | Đạt |

---

## 18. Mẫu báo lỗi

```
Bug #<số> — <tiêu đề ngắn>
Test case: <ID>          Mức độ: Nghiêm trọng / Cao / Trung bình / Thấp
Môi trường: local | production — trình duyệt, kích thước cửa sổ
Tài khoản: <email>
Các bước tái hiện: 1. … 2. … 3. …
Kết quả mong đợi: …
Kết quả thực tế: …
Bằng chứng: ảnh chụp / log Console / request trong tab Network
```

## 19. Tổng hợp & điều kiện merge

| Nhóm | Số TC | Đạt | Lỗi | Bỏ qua |
|---|---|---|---|---|
| 1. Đăng ký | 13 | 13 | 0 | 0 |
| 2. Xác minh email | 10 | 10 | 0 | 0 |
| 3. Đăng nhập | 13 | 13 | 0 | 0 |
| 4. Phân quyền | 15 | 15 | 0 | 0 |
| 5. Trang chủ | 22 | 22 | 0 | 0 |
| 6. Tìm việc | 18 | 18 | 0 | 0 |
| 7. Chi tiết việc | 6 | 6 | 0 | 0 |
| 8. Gợi ý cho tôi | 27 | 27 | 0 | 0 |
| 9. Hồ sơ & lịch rảnh | 17 | 17 | 0 | 0 |
| 10. Đơn ứng tuyển | 12 | 12 | 0 | 0 |
| 11. Tin đã đăng | 7 | 7 | 0 | 0 |
| 12. Đăng / sửa tin | 19 | 19 | 0 | 0 |
| 13. Đơn của một tin | 10 | 10 | 0 | 0 |
| 14. Quản trị | 2 | 2 | 0 | 0 |
| 15. Giao diện chung | 10 | 10 | 0 | 0 |
| 16. Tự động | 5 | 5 | 0 | 0 |
| 17. Production | 7 | 6 | 1 | 0 |
| **Tổng** | **213** | **212** | **1** | **0** |

## 20. Kết quả chạy 2026-09-30 (trước khi merge `feat/week6-ui`)

- **Cách chạy**: mục 1–15 tự động hoá bằng `playwright-core` điều khiển Edge headless (1440×900, múi giờ Asia/Ho_Chi_Minh, quyền vị trí đặt tại Bạch Mai), cài ngoài dự án như setup-log #15. Mục 16 chạy lệnh trực tiếp. Dữ liệu seed lại trước mỗi nhóm.
- **Kết quả**: mục 1–16 đạt **206/206** (AUTO-05 = CI trên `main` sau merge). Mục 17 (production, sau merge `f37e738`): **6/7**, PROD-06 lỗi do cấu hình (Bug #3). Sau khi sửa lỗi đã chạy lại toàn bộ 201 case mục 1–15 trên bản code cuối: 201/201 đạt, không có lỗi Console.
- Mục 17 để lại trên production 2 tài khoản test `qa-prod-1790765974015-emp@example.org`, `qa-prod-1790765974015-seek@example.org` (chưa có API xoá tài khoản); tin test đã đóng.
- Mã xác minh ở mục 2 được đặt qua DB (hash bcrypt) thay vì đọc log, vì log Docker Desktop bị luân chuyển; luồng đọc log đã kiểm riêng ở REG-01.

| Bug | Case phát hiện | Mức độ | Mô tả | Xử lý |
|---|---|---|---|---|
| #1 | LOGIN-11 | Cao | Bấm "Đăng xuất" về `/` rồi bị đẩy tiếp sang `/login?next=%2Fseeker`, vì trang đang mở (RequireRole) thấy mất user trước khi điều hướng xong | `logout()` xoá token rồi tải lại trang chủ (`window.location.assign('/')`) |
| #3 | PROD-06 | Cao | Trang gợi ý trên production luôn ở chế độ AI dự phòng dù `timviec-ai` `/health` 200: `timviec-backend` chưa có biến `AI_SERVICE_URL` nên gọi mặc định `localhost:8001` | **Chưa xử lý** — người thực hiện đặt `AI_SERVICE_URL=https://timviec-ai.onrender.com` trên Render (chụp màn hình vào setup-log), rồi chạy lại PROD-06 |
| #2 | SRCH-16 | Trung bình | Nhãn "Đã ứng tuyển · Chờ duyệt" trong thẻ gọn 3 cột đẩy tiền công xuống 2 dòng và tràn ra ngoài thẻ; popup bản đồ cũng tràn | Cho hàng dưới thẻ và cụm nút popup tự xuống dòng (`flex-wrap`) |

| Quan sát | Mô tả | Đề xuất |
|---|---|---|
| O1 | 2 tin cùng địa chỉ (J1, J2) thì ghim tiền công trên bản đồ chồng lên nhau, ghim dưới không bấm được | Vẫn chọn được qua danh sách bên trái; gom ghim trùng toạ độ nếu cần |
| O2 | Ở 1366×768, nhãn "Khoảng cách · 20%" trong bảng cách tính điểm xuống 2 dòng | Chỉ thẩm mỹ, không ảnh hưởng đọc số |

**Được merge khi**: 100% case **P1** ở mục 1–16 đạt; không còn bug mức Nghiêm trọng/Cao; bug P2/P3 còn mở đã được ghi lại và chấp nhận. Mục 17 chạy **sau** khi merge; nếu PROD-02 → PROD-05 lỗi thì revert commit merge trên `main`.
