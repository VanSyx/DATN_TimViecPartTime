# Brief thiết kế lại giao diện — TimViecPartTime

Soạn 2026-09-24, cập nhật 2026-09-27 (thêm trang chủ giới thiệu ở mục 5.1; **chỉ thiết kế cho laptop / máy tính, bỏ giao diện điện thoại**). Tài liệu này dùng để giao cho agent/người thiết kế vẽ **mockup ảnh / Figma**. Sau khi mockup được duyệt, frontend sẽ được code lại bằng **React (Vite) + TailwindCSS v4** (đã cài 2026-09-27, stack chốt ở `docs/PROJECT_PLAN.md` mục 4.2), nên màu, chữ và kích thước nên bám theo thang của Tailwind (mục 3).

**Giao diện hiện tại** (chỉ để tham khảo, không phải hướng mới): `docs/screenshots/week5/`. Nên xem `01-recommend-ai-breakdown.png` (trang gợi ý), `05-employer-form-dang-tin.png` (form đăng tin) và `07-seeker-mo-ta-lich-ranh.png` (lịch rảnh).

---

## 1. Sản phẩm trong 30 giây

Web kết nối **người tìm việc part-time dạng helper** (dọn nhà, trông trẻ, nấu ăn, phụ quán, chăm người già…) với **hộ gia đình / cơ sở nhỏ** cần người theo giờ. Điểm khác biệt: **AI gợi ý việc theo giờ rảnh thật + khoảng cách + mức khớp mô tả, và giải thích vì sao gợi ý**. Ngôn ngữ: tiếng Việt, xưng "bạn". Tên sản phẩm: **TimViecPartTime**. Có thể đề xuất 1-2 phương án logo chữ, nhưng giữ nguyên tên này.

**Ba vai trò**: người tìm việc (job seeker), người đăng tin (employer), quản trị viên (admin).

**Nhân vật tham chiếu** (lấy từ dữ liệu mẫu):
- **Lan**, sinh viên năm 2, rảnh các buổi chiều trong tuần và cả ngày cuối tuần.
- **Cô Hòa**, 52 tuổi, đã nghỉ hưu, không làm buổi tối, không đi xa quá 5 km, cần chữ to và thao tác đơn giản.
- **Anh Hùng**, tài xế xe ôm công nghệ, chỉ rảnh 5h30–10h sáng.
- **Chị Hương** (chủ nhà 3 tầng, có mèo) và **anh Tuấn** (quán cafe nhỏ, đăng lẻ từng ca): người đăng tin.

## 2. Nguyên tắc thiết kế

1. **Tin cậy trước tiên**: người lạ đến làm tại nhà, nên giao diện phải sạch, rõ ràng, trạng thái minh bạch, không dùng dark pattern.
2. **Thời gian là trung tâm**: giờ làm và giờ rảnh phải nhìn là hiểu ngay (dạng timeline/khối giờ, không phải chuỗi ngày giờ dài).
3. **AI giải thích bằng lời**: mỗi gợi ý có 3–4 lý do ngắn kèm icon. Số liệu chi tiết nằm trong phần "Xem cách tính điểm".
4. **Chỉ thiết kế cho laptop / máy tính**: khung chuẩn 1440×900, bố cục không vỡ ở 1366×768 (laptop phổ thông). **Không làm giao diện điện thoại.** Nút và ô nhập cao ≥ 40px, chữ trong ô nhập ≥ 16px.
5. **Thân thiện với người lớn tuổi**: chữ thân ≥ 16px, độ tương phản WCAG AA, trạng thái luôn có **chữ + icon** (không chỉ phân biệt bằng màu).

## 3. Hệ thống thiết kế (khớp thang Tailwind)

**Phong cách: ấm áp, gần gũi.**

- **Màu** (tên palette mặc định của Tailwind):
  - Primary: `teal-600 #0D9488` (hover `teal-700 #0F766E`), nền nhạt `teal-50`.
  - Accent / CTA chính (Ứng tuyển, Đăng tin): `orange-500 #F97316` (hover `orange-600`).
  - Nền trang `stone-50 #FAFAF9`, bề mặt thẻ trắng, viền `stone-200`, chữ chính `stone-900`, chữ phụ `stone-500`.
  - Trạng thái: thành công `green-600`, cảnh báo `amber-500` (nền `amber-50`), lỗi `red-600`, thông tin `sky-600`.
  - Dark mode: không bắt buộc. Nếu vẽ thì chỉ 1-2 màn (nền `stone-900`, bề mặt `stone-800`).
- **Font**: **Be Vietnam Pro** (Google Fonts, thiết kế riêng cho tiếng Việt). Cỡ chữ 14 / 16 (thân) / 18 / 20 / 24 / 30. Tiêu đề semibold, thân regular.
- **Bo góc** 12px cho thẻ, 10px cho nút/ô nhập, bo tròn hẳn cho badge/chip. **Bóng đổ** mềm, 1 cấp (`shadow-sm`, khi hover `shadow-md`). **Lưới** 4px. Nội dung rộng tối đa 1120px, căn giữa.
- **Icon**: nét outline 1.5px, kiểu Lucide. **Minh hoạ**: phẳng, người thật làm việc nhà, tông teal/cam, dùng cho trang giới thiệu và empty state.

## 4. Component dùng chung (vẽ thành 1 trang component sheet)

- **Button**: primary (cam), secondary (viền teal), ghost, danger; có trạng thái loading và disabled.
- **Input, Textarea, Select**, ô **OTP 6 số**.
- **Badge trạng thái đơn**: Chờ duyệt / Đã nhận / Bị từ chối / Đã hủy. **Badge trạng thái tin**: Đang mở / Đã đóng / Chờ duyệt / Bị từ chối.
- **JobCard**: bản gọn cho danh sách và bản đầy đủ khi mở ra.
- **MatchScore**: vòng tròn %.
- **ScoreBreakdown**: lý do bằng lời, cộng phần mở rộng có 4 thanh điểm và công thức `35% mô tả + 35% giờ rảnh + 20% khoảng cách + 10% tin cậy`.
- **LocationPicker**: ô địa chỉ, nút "Định vị trên bản đồ", nút "Dùng vị trí hiện tại", **danh sách kết quả để chọn**, bản đồ có ghim kéo được, dòng toạ độ đã chọn.
- **AvailabilityEditor**: xem màn S7.
- **Banner** (thông tin / cảnh báo / AI dự phòng), **Toast**, **EmptyState**, **Skeleton loading**.
- **AppShell**: thanh điều hướng ngang ở trên cùng. Chừa chỗ cho chuông thông báo (W2).
- **Modal**.

## 5. Màn hình, vẽ chi tiết

Mỗi màn vẽ 1 kích thước: **desktop 1440×900**.

| # | Màn hình | Nội dung bắt buộc | Trạng thái cần vẽ |
|---|---|---|---|
| S0 | **Trang chủ giới thiệu** (`/` khi chưa đăng nhập, **chi tiết ở mục 5.1**) | 10 khối: header, hero + ô tìm nhanh, việc mới đăng, loại việc thường gặp, cách hoạt động, gợi ý AI khác gì, an tâm khi làm việc, dải cho người đăng tin, câu hỏi thường gặp, footer | Đang tải "Việc mới đăng"; chưa có việc nào đang mở |
| S1 | Đăng nhập | Email, mật khẩu, link đăng ký | Sai mật khẩu; bị chặn tạm vì "quá nhiều lần thử" |
| S2 | Đăng ký | Chọn vai trò bằng **2 thẻ lớn** (Tìm việc / Tuyển người), email, mật khẩu ≥ 8 ký tự, SĐT (tuỳ chọn) | Email đã tồn tại |
| S3 | Xác minh email | 6 ô OTP, link "Để sau, đăng nhập luôn" (chưa xác minh vẫn đăng nhập được) | Thành công; mã sai hoặc hết hạn |
| S4 | **Gợi ý cho tôi** (màn quan trọng nhất, nên là trang chủ của người tìm việc) | Chọn vị trí + bán kính (sau lần đầu thì thu gọn thành 1 dòng), danh sách JobCard có MatchScore + 3–4 lý do + nút Ứng tuyển | Đang tải (skeleton); **nhắc khai hồ sơ** khi thiếu mô tả hoặc lịch rảnh sắp tới; **banner AI dự phòng** ("AI tạm thời không phản hồi — đang xếp theo khoảng cách", không có breakdown); không có việc trong bán kính; đã ứng tuyển; lỗi "Bạn đã ứng tuyển việc này" |
| S5 | Tìm việc | Bộ lọc: vị trí, bán kính, khung giờ; **chuyển qua lại giữa Danh sách và Bản đồ** (ghim các việc trên bản đồ) | Không có kết quả; đang tải; **khách chưa đăng nhập** (header của S0, bấm Ứng tuyển → Đăng nhập) |
| S6 | Chi tiết việc (modal, chỉ dùng dữ liệu đã có) | Tiêu đề, địa chỉ + bản đồ nhỏ, ngày giờ, tiền công, mô tả đầy đủ, breakdown (khi mở từ S4), nút Ứng tuyển | Tin đã kết thúc → không cho ứng tuyển |
| S7 | Hồ sơ & lịch rảnh | Mô tả bản thân (kèm gợi ý cách viết). **Lịch rảnh dạng timeline theo ngày**: các khối giờ trên trục 0–24h. Thêm khoảng rảnh qua modal: chọn ngày + giờ bắt đầu/kết thúc, có nút nhanh "Sáng 7–11 / Chiều 13–17 / Tối 18–21" chỉ để điền sẵn giờ. Xoá khoảng rảnh | Chưa khai gì (empty state có hướng dẫn); đã lưu |
| S8 | Đơn ứng tuyển của tôi | Tab theo trạng thái (Tất cả / Chờ duyệt / Đã nhận / Khác), JobCard + badge, nút Hủy đơn khi đơn đang chờ | Chưa có đơn |
| S9 | Người đăng tin: Tin đã đăng | Nút "Đăng tin mới" nổi bật; danh sách tin kèm badge trạng thái và các nút Sửa / Đóng tin / Xem đơn | Chưa có tin (empty state) |
| S10 | Người đăng tin: Đăng / Sửa tin | 1 trang 2 cột. Trái: form 3 phần **Công việc** → **Địa điểm** (số nhà + đường / phường-xã / tỉnh-thành phố + LocationPicker) → **Thời gian & tiền công**. Phải: xem trước JobCard | Chưa ghim vị trí; giờ kết thúc trước giờ bắt đầu |
| S11 | Người đăng tin: Đơn ứng tuyển của 1 tin | Mỗi ứng viên: avatar là chữ cái đầu của email, email, SĐT (bấm để gọi), badge, nút Nhận / Từ chối | Chưa có ai ứng tuyển; đơn đã được xử lý |
| S12 | Quản trị | Khung trang quản trị (placeholder, nội dung xem W4) | — |

### 5.1 S0 — Trang chủ giới thiệu

**Ai xem**: khách chưa đăng nhập, và hội đồng ở phút đầu buổi demo. Người đã đăng nhập vào `/` vẫn được chuyển thẳng về trang chính của vai trò như hiện nay (S4 với người tìm việc).

**Tham khảo bố cục**: **TopCV**, **VietnamWorks** (trang việc làm: thanh tìm kiếm ngay ở hero, khối việc làm mới, dải dành cho nhà tuyển dụng, footer nhiều cột) và **bTaskee** (giúp việc theo giờ, gần sản phẩm này nhất: các bước sử dụng, cam kết an tâm, kêu gọi cả 2 phía). Chỉ mượn **bố cục và nhịp trang**, không chép chữ, màu hay hình.

Các khối, từ trên xuống:

| # | Khối | Tham khảo | Nội dung | Dữ liệu |
|---|---|---|---|---|
| 1 | Header | TopCV | Logo chữ; link cuộn tới "Cách hoạt động", "Gợi ý AI", "Câu hỏi"; nút Đăng nhập (ghost) + Đăng ký (cam) | tĩnh |
| 2 | Hero + ô tìm nhanh | TopCV (thanh tìm kiếm ở hero) | Tiêu đề "Việc làm thêm vừa với giờ rảnh của bạn", 1 câu phụ nói về AI. Ô tìm nhanh **"Bạn ở đâu?"** (ô địa chỉ + nút "Dùng vị trí hiện tại") và nút cam "Tìm việc quanh đây" → mở S5 ở chế độ khách với vị trí đã chọn. Dưới ô: link nhỏ "Bạn cần tuyển người? Đăng tin miễn phí →". Minh hoạ người làm việc nhà ở cột phải | Tìm thật qua `GET /jobs` (đã công khai, không cần đăng nhập) |
| 3 | Việc mới đăng | TopCV "Việc làm tốt nhất" | Lưới 6 JobCard gọn (tiêu đề, phường + tỉnh/thành, `T7, 26/09 · 08:00–11:00`, tiền công) + nút "Xem tất cả việc →" (S5 chế độ khách). Bấm Ứng tuyển → Đăng nhập. **Không có vòng %** vì khách chưa có hồ sơ để AI chấm. Tiêu đề khối kèm số đếm "Đang có X việc mở" (X ≥ 100 thì hiện "100+") | **Thật**: `GET /jobs` không truyền toạ độ trả tối đa 100 tin mới nhất. Mockup dùng 3 việc ở mục 8 |
| 4 | Loại việc thường gặp | TopCV "Top ngành nghề" | 6 ô có icon: Dọn dẹp nhà, Trông trẻ, Nấu ăn, Phụ quán / phụ bếp, Chăm người già, Giặt ủi. **Chỉ minh hoạ, không bấm để lọc** (hệ thống không có danh mục, xem mục 7) | tĩnh |
| 5 | Cách hoạt động | bTaskee "3 bước", TopCV tách ứng viên / nhà tuyển dụng | 2 tab. **Người tìm việc**: Khai giờ rảnh & mô tả bản thân → AI gợi ý việc hợp giờ, gần nhà → Ứng tuyển và chờ nhận. **Người đăng tin**: Đăng tin kèm giờ, địa chỉ, tiền công → Nhận đơn ứng tuyển → Chọn người phù hợp | tĩnh |
| 6 | Gợi ý AI khác gì | riêng của sản phẩm | Trái: 3 ý ngắn "Không lọc cứng theo ngành" / "Xét giờ rảnh thật, tính cả thời gian đi lại" / "Luôn nói rõ vì sao gợi ý". Phải: 1 JobCard mẫu có MatchScore 83% + 4 lý do (dòng 1 bảng dữ liệu mục 8), nhãn nhỏ "Ví dụ minh hoạ" | tĩnh |
| 7 | An tâm khi làm việc | bTaskee "Cam kết" | 4 ý, **chỉ nói điều đã có thật**: mỗi tin ghi rõ giờ làm, địa chỉ, tiền công cả buổi; người đăng tin tự xem đơn và chọn người; trạng thái đơn minh bạch (Chờ duyệt / Đã nhận / Bị từ chối); miễn phí cho cả 2 bên. Không hứa đánh giá sao, bảo hiểm, kiểm tra lý lịch, và không lấy "đã xác minh email" làm cam kết (hiện chưa bắt buộc xác minh) | tĩnh |
| 8 | Dải "Dành cho người đăng tin" | TopCV "Dành cho nhà tuyển dụng" | Nền teal: "Cần người giúp việc theo giờ? Đăng tin miễn phí, chọn người ở gần." + nút "Đăng tin ngay" → Đăng ký với vai trò Tuyển người chọn sẵn | tĩnh |
| 9 | Câu hỏi thường gặp | TopCV, bTaskee | 5 câu dạng accordion (mở/đóng từng câu): Có mất phí không? · Có cần CV không? (không, chỉ cần vài câu mô tả) · Lịch rảnh khác ca làm cố định thế nào? · AI gợi ý dựa vào đâu? · Chưa xác minh email có dùng được không? (được) | tĩnh |
| 10 | Footer | TopCV (footer nhiều cột) | Logo + 1 câu giới thiệu; cột Người tìm việc (Tìm việc, Gợi ý cho tôi, Đăng ký); cột Người đăng tin (Đăng tin, Đăng ký); dòng "Đồ án tốt nghiệp · 2026" | tĩnh |

**Không lấy từ các trang tham khảo** (vi phạm mục 7 hoặc ngoài scope): tường logo công ty, lời chứng thực / đánh giá của người dùng, số liệu kiểu "X ứng viên, Y nhà tuyển dụng" (chưa có API đếm, không bịa số), banner quảng cáo, nút tải app, CV / cẩm nang / blog, lọc theo ngành, nhãn việc "hot" / "gấp".

**Thay đổi code đi kèm** (chỉ frontend, backend không đổi): `/` hiện S0 thay vì chuyển sang Đăng nhập; S5 mở cho khách chưa đăng nhập; Đăng ký nhận vai trò chọn sẵn từ link.

## 6. Màn tuần 6-12, chỉ phác wireframe (không tô màu chi tiết)

Những chức năng này chưa làm. Vẽ trước để hệ thống thiết kế dùng được về sau.

- **W1 Đánh giá sau công việc**: 1–5 sao + nhận xét, cho cả 2 chiều. Kèm chỗ hiển thị sao trên JobCard và trên thẻ ứng viên.
- **W2 Thông báo in-app**: chuông trên header có số chưa đọc, và danh sách thông báo (đơn được nhận/từ chối, có người ứng tuyển).
- **W3 Báo cáo / chặn người dùng**: menu "⋯" trên thẻ mở ra modal chọn lý do.
- **W4 Quản trị**: duyệt tin (`Chờ duyệt` → Duyệt / Từ chối), danh sách người dùng với Khoá / Mở khoá, danh sách báo cáo vi phạm.

## 7. Ràng buộc bắt buộc (không được vi phạm)

- **Không vẽ dữ liệu không tồn tại như thể có thật**: tên người, ảnh đại diện thật, ảnh công việc, danh mục/ngành nghề, bộ lọc theo ngành, số lượt xem, số đơn trên mỗi tin, logo công ty, lời chứng thực của người dùng, số liệu thống kê tổng. Người dùng được định danh bằng email (+ SĐT), avatar là chữ cái đầu. Nếu muốn thêm trường nào, ghi chú **"cần thêm dữ liệu"** để xác nhận sau.
- **Không có**: chat, thanh toán, CV builder, lịch lặp hàng tuần (lịch rảnh là các khoảng **theo ngày cụ thể**), gợi ý "khẩn cấp" real-time.
- Lịch rảnh là **khoảng thời gian tự do** (vd 07:15–11:40), **không** gom về ca cố định Sáng/Chiều/Tối. Nút nhanh chỉ để điền sẵn giờ.
- **Luôn hiện lý do gợi ý** (explainable AI). Trạng thái AI dự phòng phải trông khác hẳn: không có vòng %, chỉ có khoảng cách, kèm banner.
- Độ tin cậy hiện là **"Chưa có đánh giá"** (trung lập). Không vẽ sao cho tới W1.
- **Bản đồ**: OpenStreetMap qua Leaflet, **không đổi được style nền bản đồ** (không dùng Mapbox/Google Maps). Chỉ tuỳ biến được ghim, popup và khung bao. Tra địa chỉ trả về **danh sách kết quả để người dùng tự chọn** (chỉ chính xác tới mức tên đường), toạ độ cuối cùng do người dùng xác nhận bằng ghim.
- Địa chỉ theo **2 cấp hành chính** (từ 1/7/2025): số nhà + đường / phường-xã / tỉnh-thành phố. **Không có quận/huyện.**
- Một tin = **1 khung giờ liền trong 1 ngày**. Tiền công tính **cho cả buổi**, đơn vị VND.

## 8. Quy ước nội dung

- Ngày giờ: `T7, 26/09 · 08:00–11:00`. Tiền: `250.000 đ`. Khoảng cách dùng dấu phẩy thập phân: `cách 0,5 km · ~2 phút đi lại`.
- Ví dụ lý do gợi ý:
  - "✓ Nằm trọn trong giờ rảnh của bạn (đã tính 2 phút đi lại)", hoặc "✗ Ngoài giờ rảnh của bạn"
  - "📍 Cách bạn 0,5 km"
  - "📝 Khớp một phần với mô tả của bạn"
  - "⭐ Chưa có đánh giá"
- Chữ hiển thị cho "Khớp mô tả" theo ngưỡng **tạm thời** (AI bản hiện tại cho điểm mô tả thấp): ≥ 30% "Khớp tốt", 10–30% "Có liên quan", < 10% "Ít liên quan". Ngưỡng sẽ chỉnh lại khi nâng cấp AI ở tuần 6.
- Dữ liệu mẫu cho mockup (số liệu thật từ bản chạy thử):

  | Việc | Điểm | Khớp mô tả | Giờ rảnh | Khoảng cách |
  |---|---|---|---|---|
  | Dọn dẹp nhà cửa sáng thứ 7 · 06 Phan Huy Ôn, Phường Hải Châu, Đà Nẵng · T7 26/09 08:00–11:00 · 250.000 đ | 83% | 55% | 100% | 0,51 km |
  | Trông 2 bé chiều thứ 7 · 88 Phan Châu Trinh, Phường Hải Châu, Đà Nẵng · T7 26/09 13:30–18:00 · 320.000 đ | 29% | 2% | 0% | 0,78 km |
  | Phụ bếp, rửa bát tiệc cưới trưa CN · 32 Hàng Bạc, Phường Hoàn Kiếm, Hà Nội · CN 27/09 09:30–15:00 · 350.000 đ | 65% | 4% | 100% | 0,63 km |

## 9. Sản phẩm cần giao

1. Trang **design tokens** (màu, chữ, bo góc, bóng) và **component sheet** (mục 4).
2. S0–S12, mỗi màn 1 kích thước desktop 1440×900, kèm các trạng thái ở cột "Trạng thái cần vẽ" của mục 5.
3. Wireframe W1–W4.
4. 2 luồng dạng chuỗi màn:
   - **Người tìm việc**: đăng ký → khai hồ sơ → gợi ý → ứng tuyển → thấy "Đã nhận".
   - **Người đăng tin**: đăng tin → xem đơn → nhận.
5. Đặt tên file theo `docs/design/mockups/<mã màn>[-<trạng thái>].png`, ví dụ `S4-fallback.png` (xem `docs/design/mockups/README.md`).

## 10. Prompt mẫu để giao cho agent thiết kế

> Bạn là product designer. Đọc toàn bộ `docs/design/ui-redesign-brief.md` và thiết kế mockup theo đúng mục 3–9. Tuân thủ tuyệt đối mục 7 (ràng buộc về dữ liệu và bản đồ). Phong cách ấm áp, gần gũi, teal + cam, font Be Vietnam Pro, chỉ thiết kế cho laptop / máy tính (1440×900), không vẽ giao diện điện thoại. Màn quan trọng nhất là S4 "Gợi ý cho tôi": phần giải thích AI phải dễ hiểu và nổi bật. Trang chủ S0 (mục 5.1) là màn mở đầu buổi demo: tham khảo bố cục TopCV / VietnamWorks / bTaskee nhưng không vẽ logo công ty, lời chứng thực hay số liệu bịa. Dùng dữ liệu mẫu ở mục 8, toàn bộ chữ bằng tiếng Việt.
