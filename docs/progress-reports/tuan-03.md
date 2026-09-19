# Báo cáo tiến độ — Tuần 3 (Job CRUD, Application flow, Geo search)

Branch: `feat/week3-jobs` (tách từ `feat/week2-auth`, chưa merge). Ảnh minh chứng: `docs/screenshots/week3/`.

## Đối chiếu kế hoạch (`PROJECT_PLAN.md` mục 5.1)

| Ngày | Kế hoạch | Kết quả |
|---|---|---|
| 1-2 | Model `jobs`, `availability_intervals`, CRUD job cho Employer | ✅ Đạt |
| 3 | Geo search PostGIS | ✅ Đạt |
| 4 | Model `applications`, luồng ứng tuyển + trạng thái đơn | ✅ Đạt (gồm hủy đơn UC9) |
| 5 | Frontend: đăng tin, danh sách job, filter khu vực/khung giờ, form ứng tuyển | ✅ Đạt |

**Deliverable "Job CRUD + tìm/lọc + ứng tuyển hoạt động đầy đủ trên cả FE/BE": đạt** — đã chạy thử toàn bộ luồng trên UI thật (ảnh 03-11).

## Chi tiết đã làm

**Database** (migration `658771f39e2e`, ảnh 01)
- `jobs`: `lat/lng` + cột `location geography(Point,4326)` do Postgres tự sinh từ lat/lng, có GiST index; CHECK `time_end > time_start`
- `availability_intervals`: interval thời gian thực (timestamptz start/end), CHECK `end > start` — không dùng ca cố định
- `applications`: unique index một phần — mỗi job seeker chỉ có 1 đơn còn hiệu lực/job, hủy rồi được nộp lại

**Backend** (`backend/app/jobs.py`, ảnh 02)
- Jobs (UC11-13): `POST /jobs`, `PUT /jobs/{id}`, `DELETE /jobs/{id}` (đóng mềm → `closed`), `GET /jobs/mine`
- Tìm/lọc (UC5): `GET /jobs?lat&lng&radius_km&start&end` — `ST_DWithin` theo bán kính, sắp theo khoảng cách, trả `distance_km`; lọc job chồng lấp khung giờ
- Lịch rảnh (UC4): `GET/POST /availability`, `DELETE /availability/{id}`
- Ứng tuyển (UC7-10): `POST /applications`, `GET /applications/me`, `GET /jobs/{id}/applications`, `PATCH /applications/{id}`
- Bảo mật: RBAC theo role ở mọi route + kiểm tra ownership (employer B không sửa/đóng/xem đơn job của A → 404); bảng chuyển trạng thái cho phép theo role (seeker chỉ hủy, employer chỉ nhận/từ chối); UPDATE có điều kiện `status = 'pending'` để seeker hủy và employer duyệt cùng lúc thì chỉ 1 bên thắng

**Frontend** (`frontend/src/pages/JobPages.tsx`)
- Job seeker: Tìm việc (lọc vị trí + bán kính + khung giờ, nút "Dùng vị trí hiện tại"), Lịch rảnh, Đơn ứng tuyển (hủy khi đang chờ)
- Employer: đăng/sửa/đóng tin, xem danh sách ứng viên, nhận/từ chối

**Kiểm thử**
- `pytest`: **35/35 pass** (20 test mới trong `tests/test_jobs.py`: RBAC, ownership, geo radius + sắp xếp, lọc khung giờ, luồng đơn, chuyển trạng thái sai role) — ảnh 12
- E2E trên UI thật (Edge headless): employer đăng tin → seeker khai lịch rảnh → tìm theo Hoàn Kiếm bán kính 10 km (có Hồ Tây 4.9 km, loại tin TP.HCM) → ứng tuyển → employer nhận → seeker thấy "Đã nhận"; seeker vào `/employer` bị đẩy về `/seeker`
- `npm run lint` + `npm run build` pass; `alembic check` không lệch models

## Chưa làm / giới hạn đã biết
- ~~Chưa deploy lên Render~~ — **đã deploy** qua PR #9, #10. Kiểm tra 2026-09-19: `/health` 200, `openapi.json` có đủ route jobs/availability/applications, `GET /jobs?lat=21.03&lng=105.85` 200 → migration bật PostGIS chạy được trên Postgres managed. Riêng commit `f9c9964` (tra địa chỉ Photon + đổi tile) chỉ đổi frontend/docs, lên production khi merge PR tiếp theo.
- "Mô tả tự do" của job seeker (Scope 2.1) chưa có — cần cho `semantic_score`, làm đầu Tuần 4.
- Chưa phân trang (tối đa 100 kết quả/lần tìm); không gộp các interval rảnh chồng nhau.
- Trạng thái `completed` (sau khi làm xong việc) chưa có transition — thuộc luồng rating tuần 6-12.
- Admin duyệt tin (UC19) theo kế hoạch để tuần 6+, tin đăng là `open` ngay.
- Ô địa chỉ (street/ward/city) chỉ để hiển thị, không được validate khớp với điểm ghim trên bản đồ — employer có thể gõ sai địa chỉ hiển thị dù toạ độ đúng. Chấp nhận được vì không có geocoding để đối chiếu hai chiều.

## Việc phát sinh
- Không có thay đổi scope. Không thêm dependency backend mới (PostGIS dùng qua SQL functions, không cài GeoAlchemy2).
- **Đổi cách chọn vị trí (theo yêu cầu người thực hiện, sau khi xong bản đầu Tuần 3):**
  - Thử **Goong Maps API** để geocode địa chỉ → toạ độ, nhưng tài khoản cá nhân cần admin duyệt mới cấp key — không khả thi cho đồ án cá nhân.
  - Thử **OpenStreetMap Nominatim** (miễn phí, không cần key) — bị chặn ngay ở mức chính sách sử dụng cho IP server/cloud (403 Access denied), không chỉ riêng mạng máy dev; không dùng được cho production dù local có gọi được.
  - **Chốt phương án:** bỏ hẳn geocoding qua API bên thứ 3. Ô địa chỉ (số nhà+đường / phường-xã / tỉnh-thành phố, theo địa giới 2 cấp từ 1/7/2025) chỉ để hiển thị; toạ độ `lat`/`lng` lấy từ việc **người dùng tự bấm ghép ghim trên bản đồ** (thư viện `leaflet`, tile OpenStreetMap — chỉ hiển thị ảnh bản đồ, không gọi API tìm kiếm nên không bị chặn) hoặc nút "Dùng vị trí hiện tại" (GPS trình duyệt). Không cần tài khoản/API key nào.
  - Migration `ffbf3dd8cc02` (thêm cột địa chỉ) giữ nguyên. `backend/app/jobs.py` không có logic geocode — `JobIn` nhận `lat`/`lng` trực tiếp từ frontend như thiết kế gốc.
  - Đã chạy thử trên UI thật (Edge headless, giả lập GPS qua CDP): đăng tin → bấm ghim trên bản đồ → lưu → toạ độ đúng như đã chọn; mở lại để sửa thì ghim hiện đúng vị trí cũ; tìm việc cũng bấm ghim tương tự. Ảnh 16-20 (tile bản đồ không hiện trong ảnh vì mạng sandbox lúc chạy test chặn `tile.openstreetmap.org`, không phải lỗi code — máy thật của người dùng truy cập bình thường).
  - `pytest`: **36/36 pass** (bỏ 6 test liên quan Goong, không thêm test mới vì lat/lng lại là input trực tiếp như thiết kế FR2/FR3 gốc).
- **Chỉnh lại map picker sau khi dùng thử** (phản hồi: "chưa trực quan, load rất chậm") — `LocationPicker` trong `frontend/src/pages/JobPages.tsx`:
  - Khi mở form chưa có toạ độ, tự gọi GPS trình duyệt để zoom thẳng về vùng quanh vị trí thật (zoom 15) thay vì giữ view Đà Nẵng zoom 6 — zoom 6 phủ cả nước nên phải tải rất nhiều tile trước khi user thu hẹp. Từ chối quyền vị trí thì im lặng giữ fallback Đà Nẵng, không hiện lỗi (chỉ nút "Dùng vị trí hiện tại" bấm chủ động mới báo lỗi).
  - Marker đặt `draggable: true` + cập nhật toạ độ khi `dragend` — trước đó muốn chỉnh lại phải bấm lại từ đầu, không kéo được ghim như thói quen dùng bản đồ thông thường.
  - Kiểm thử E2E trên UI thật (Edge headless + CDP giả lập GPS), 4 kịch bản pass — ảnh 21-24: cho phép GPS → ghim tự đặt đúng Hà Nội; kéo ghim → toạ độ đổi theo vị trí thả; từ chối GPS → không đặt ghim, không báo lỗi; mở "Sửa" job có sẵn toạ độ TP.HCM → GPS Hà Nội không ghi đè.
  - Không đổi kiến trúc: vẫn Leaflet, không thêm dependency, không thêm lại geocoding.
- **Phát sinh tiếp: đổi nguồn ảnh tile bản đồ** (phản hồi sau khi dùng thử trên máy thật: "bản đồ trống, không thấy đường xá nhà cửa, không ghim chính xác được") —
  - Nguyên nhân: `tile.openstreetmap.org` (server tile chính của OSM) không phải CDN dành cho app production, hay bị chặn/timeout tuỳ mạng — xác nhận bằng `curl`: server này không kết nối được (`000`) từ môi trường test, trong khi các tile server khác vẫn OK. Kết quả là ảnh tile không tải được, chỉ còn nền xám + ghim, không có gì để định vị trực quan.
  - Thử CARTO Voyager (`basemaps.cartocdn.com`, free, không cần key) trước — tile trả về 200 nhưng hoá ra là ảnh watermark "API KEY REQUIRED" (CARTO đã đổi chính sách, endpoint raster ẩn danh này không còn phục vụ tile thật) — phát hiện được nhờ chụp ảnh kiểm tra trực quan, không chỉ dựa vào mã trạng thái HTTP.
  - Chốt dùng mirror Đức của chính OSM (`tile.openstreetmap.de`, free, không cần key, cùng dữ liệu/kiểu vẽ với OSM chuẩn) — kết nối OK, tile tải đủ dữ liệu (~55KB/tile, tương đương tile thật thay vì tile watermark ~19KB của CARTO).
  - Kiểm thử lại E2E (ảnh 21-25): tile hiện rõ tên đường, sông hồ, khối nhà, biểu tượng địa danh ở cả 2 khu vực test (Hà Nội, TP.HCM); 10/10 ảnh tile xác nhận có pixel thật (`naturalWidth > 0`), không phải ảnh vỡ/watermark.
  - Không phải geocoding (không tra địa chỉ↔toạ độ qua bên thứ 3) nên không vi phạm quyết định đã chốt ở CLAUDE.md §5 — chỉ là đổi nguồn ảnh nền hiển thị.
- **Mở lại quyết định geocoding: thêm tra địa chỉ → ghim toạ độ** (người thực hiện chủ động yêu cầu, vì gõ sẵn địa chỉ ở 3 ô street/ward/city mà vẫn phải tự mò ghim trên bản đồ là bất tiện):
  - Trước đây khóa vì Goong cần admin duyệt key và Nominatim chặn IP server (403). Lần này **gọi thẳng từ trình duyệt người dùng, backend không đụng tới** nên lý do "IP server bị chặn" không còn; dùng **Photon** (`photon.komoot.io`, dữ liệu OSM, miễn phí, không cần API key, có CORS). Không thêm npm dependency nào — dùng `fetch` sẵn có.
  - Luồng: nhập địa chỉ → nút "Định vị trên bản đồ" → hiện tối đa 5 kết quả để chọn → bấm 1 kết quả thì ghim nhảy tới đó ở zoom 17 và hiện toạ độ. Trang "Đăng tin" đọc địa chỉ từ chính 3 ô street/ward/city (nên địa chỉ hiển thị và ghim khớp nhau); trang "Tìm việc" có ô địa chỉ riêng. Kéo ghim + "Dùng vị trí hiện tại" giữ nguyên.
  - **Không tự ghim theo kết quả đầu tiên** — đã đo thật: OSM Việt Nam thiếu dữ liệu số nhà ("36 Hàng Bông, Hoàn Kiếm" ra bệnh viện ở phố Tràng Thi), và địa chỉ không tồn tại vẫn trả match sai im lặng ("Phan Huy Ôn, Hải Châu, Đà Nẵng" ra sân bay Đà Nẵng). Vì vậy bắt buộc cho người dùng chọn trong danh sách rồi kéo ghim chỉnh tới đúng số nhà.
  - Kiểm thử E2E 4 kịch bản pass (ảnh 26-29): tra "Đường Phan Huy Ích, An Hải, Đà Nẵng" → ghim đúng 16.054, 108.235; kéo ghim sau khi định vị vẫn chạy; địa chỉ rác → báo "Không tìm thấy địa chỉ này", toạ độ giữ nguyên, không ghim bừa; trang Tìm việc tra "Hồ Gươm, Hà Nội" → ghim đúng Hoàn Kiếm rồi tìm ra job "Dọn dẹp căn hộ - Hoàn Kiếm" cách 0.18 km.
  - Đã cập nhật CLAUDE.md §5 cho khớp (ràng buộc mới: geocoding chỉ phía client, không bao giờ ở backend).

## Tiếp theo: Tuần 4 — AI Service MVP
Scaffold `ai-service` (FastAPI riêng, thêm vào compose), thêm mô tả tự do cho job seeker, cài `semantic` (TF-IDF), `time_feasibility`, `geo` score + unit test, chốt contract `POST /score` trả breakdown.
