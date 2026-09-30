# AI Scoring

## Công thức
```
final_score = w1 × semantic_score + w2 × time_feasibility_score + w3 × geo_score + w4 × trust_modifier
```
Tất cả 4 thành phần nằm trong [0,1] **trước khi** nhân trọng số. Chuẩn hóa theo **cận cố định**, không min-max theo từng lô job: min-max theo lô làm điểm một job phụ thuộc các job khác trong cùng lô, và lô 1 job thì chia cho 0.

Cài đặt: `ai-service/app/scoring.py` (hàm thuần, không state) + `ai-service/app/main.py` (`POST /score`). Trọng số: `semantic 0.35, time_feasibility 0.35, geo 0.2, trust 0.1` — chọn tay ở tuần 4, **giữ nguyên và khoá 2026-09-30** sau đánh giá offline (mục cuối).

## Từng thành phần
- **semantic_score** — so khớp ngữ nghĩa mô tả job (`title + description`) vs. mô tả tự do của người tìm việc (`users.description`).
  - Tuần 1-5: TF-IDF + cosine similarity, tự cài bằng thư viện chuẩn Python (không scikit-learn). Token = âm tiết + bigram âm tiết (từ tiếng Việt thường 2 âm tiết: "dọn dẹp", "trông trẻ"), chuẩn hóa Unicode NFC + chữ thường, **nối thêm bản không dấu của mọi token** (`đ→d`, bỏ dấu thanh) để người gõ không dấu vẫn khớp tin có dấu — chọn qua thí nghiệm trên dữ liệu seed (P@3 0.71 → 0.79, xem `docs/progress-reports/tuan-04.md`); giá phải trả là gộp nhầm vài từ khác nghĩa (chợ/chó). Đã thử bỏ từ đệm: làm kết quả tệ đi, không dùng. IDF dạng smooth `ln((1+n)/(1+df)) + 1`, tính trên chính lô job của request (AI service không giữ state). Cosine của vector không âm nên tự nằm trong [0,1]. Mô tả trống → 0 cho mọi job (không đổi thứ hạng).
  - **Không nâng cấp embedding** (quyết định 2026-09-30): model đa ngôn ngữ + torch vượt 512 MB RAM của Render free, và đánh giá offline cho thấy TF-IDF đã vượt baseline. Giới hạn chấp nhận, nêu trong báo cáo: chỉ khớp đúng chữ ("tổng vệ sinh" ≠ "dọn dẹp"), điểm `semantic` nhỏ (~0.1). **Thiết kế AI đã khoá — không đổi kiến trúc scoring.**
- **time_feasibility_score** — tỉ lệ khung cần có mặt `[giờ bắt đầu − thời gian đi, giờ kết thúc + thời gian về]` nằm trong **hợp** các `availability_intervals` (gộp interval chồng nhau trước, không đếm trùng). Thời gian đi = khoảng cách Haversine / 20 km/h (xe máy nội thành, hằng số). 1 = rảnh trọn cả đi lẫn về, 0 = không rảnh chút nào.
- **geo_score** — `1 − min(d, R)/R`, với `d` = khoảng cách Haversine, `R` = bán kính tìm kiếm (min-max cận cố định [0, R]). Dùng Haversine thay vì `ST_Distance` của PostGIS để AI service không phụ thuộc DB; sai khác với khoảng cách geography của PostGIS < 0.5%, không đáng kể ở bán kính ≤ 100 km. PostGIS vẫn dùng ở backend để **lọc trước** job ứng viên (`ST_DWithin`).
- **trust_modifier** — dựa trên rating hai chiều. **Mặc định 1.0 (trung lập) khi chưa có dữ liệu rating** — không được để giá trị mặc định làm lệch điểm gợi ý theo hướng cao/thấp bất thường. Tuần 4-5 mọi job đều 1.0 nên chỉ cộng hằng số `w4`, không đổi thứ hạng.

## Vì sao không dùng Collaborative Filtering
Dữ liệu tương tác quá thưa và vòng đời job ngắn trong phạm vi đồ án — không đủ điều kiện chứng minh CF hoạt động đúng. Đây là quyết định kiến trúc đã chốt, **không triển khai CF** dù có ý tưởng cải tiến sau này.

## Explainable AI
Endpoint gợi ý AI **bắt buộc trả breakdown từng thành phần điểm**, không chỉ 1 số `final_score` — mọi kết quả gợi ý phải giải thích được lý do trên UI.

## Đánh giá offline
`backend/offline_eval.py` (chạy sau `seed.py`): đi đúng đường `GET /recommendations` → ai-service, 6 nhân vật × 10 tin trong bán kính 10 km. Nhãn 0/1/2 gán tay theo câu chuyện nhân vật (mô tả + lịch rảnh + ràng buộc tự nêu), không sinh từ công thức. P/R tính với nhãn 2, NDCG dùng nhãn phân cấp. Kết quả 2026-09-30:

| Cách xếp | P@3 | NDCG@3 | R@5 | NDCG@5 |
|---|---|---|---|---|
| Baseline gần nhất trước (chế độ dự phòng) | 0.53 | 0.56 | 0.83 | 0.64 |
| Baseline lọc cứng trùng giờ rảnh, rồi gần nhất | 0.67 | 0.86 | 0.90 | 0.89 |
| AI (0.35/0.35/0.2/0.1) | 0.73 | 0.92 | 0.95 | 0.94 |

Dò lưới trọng số cho `(0.8, 0.1, 0.0)` (NDCG@5 0.986) nhưng **không dùng**: nhãn không xét khoảng cách nên lưới tự đẩy trọng số khoảng cách về 0, trọng số mô tả phải cao chỉ vì điểm TF-IDF nhỏ, và kiểm tra chéo bỏ-1-nhân-vật chỉ hơn trọng số hiện tại ở 2/6 nhân vật. **Giới hạn phải nêu trong báo cáo**: cùng một người viết dữ liệu seed, gán nhãn và thiết kế công thức; mẫu nhỏ; dữ liệu mô phỏng, không phải pilot test thật.

## Nguồn tham khảo
Chi tiết đầy đủ: `docs/PROJECT_PLAN.md` mục 1.3, 3.3, 7, 8.
