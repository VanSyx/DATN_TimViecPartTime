"""Giả lập ~3 tháng sử dụng: người tìm việc, người giao việc, tin, đơn, đánh giá, báo cáo, thông báo.

Khác seed.py (vài tài khoản cố định để test tay): script này dựng lịch sử như thể hệ thống đã chạy từ ~90 ngày
trước tới nay — tin cũ đã xong và được đánh giá, tin mới đang mở trong 2 tuần tới, có mùa Trung thu, có 1 tài
khoản lừa đảo bị khoá, 1 người nhận việc rồi bùng bị khoá, vài báo cáo đang chờ admin.

Chạy (dev):  docker compose exec backend python seed_history.py
Chạy (prod): DATABASE_URL=<neon> JWT_SECRET=x JWT_REFRESH_SECRET=x SEED_PASSWORD=<mk> python seed_history.py
Chạy lại được: xoá rồi tạo lại đúng các tài khoản @example.net (tên miền dành riêng RFC 2606, không ai nhận mail; .test bị email-validator từ chối).
Thời gian tính theo lúc chạy; cùng ngày chạy thì ra cùng dữ liệu (random có seed).
"""

import os
import random
import uuid
from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Application, AvailabilityInterval, Job, Notification, Rating, Report, User
from app.security import hash_secret
from seed import CN, T2, T3, T4, T5, T6, T7, TODAY, VN, at, wipe

DOMAIN = "@example.net"
PASSWORD = os.environ.get("SEED_PASSWORD", "matkhau123")
NOW = datetime.now(VN)
rng = random.Random(TODAY.toordinal())
WEEKDAYS, WEEKEND, EVERYDAY = {T2, T3, T4, T5, T6}, {T7, CN}, set(range(7))
HN, HCM, DN = "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng"
# Nhóm việc: tin thuộc nhóm nào thì người có kỹ năng nhóm đó mới ứng tuyển
DON, GIAT, TRE, GIA, NAU, QUAN, TIEC, VAC, PET, KEM = (
    "don", "giat", "tre", "gia", "nau", "quan", "tiec", "vac", "pet", "kem")

LOC = {  # (đường, phường, thành phố, lat, lng)
    "doican": ("Ngõ 267 Đội Cấn", "Phường Ngọc Hà", HN, 21.0359, 105.8295),
    "trantt": ("45 Trần Thái Tông", "Phường Cầu Giấy", HN, 21.0336, 105.7897),
    "tdt": ("Ngõ 72 Tôn Đức Thắng", "Phường Văn Miếu - Quốc Tử Giám", HN, 21.0247, 105.8317),
    "timescity": ("Times City, 458 Minh Khai", "Phường Vĩnh Tuy", HN, 20.9953, 105.8686),
    "hangbe": ("35 Hàng Bè", "Phường Hoàn Kiếm", HN, 21.0330, 105.8540),
    "xuandieu": ("Ngõ 31 Xuân Diệu", "Phường Tây Hồ", HN, 21.0620, 105.8290),
    "vanquan": ("Khu đô thị Văn Quán", "Phường Hà Đông", HN, 20.9770, 105.7870),
    "royal": ("Royal City, 72A Nguyễn Trãi", "Phường Thanh Xuân", HN, 21.0030, 105.8150),
    "kimlien": ("Tập thể Kim Liên, ngõ 4B Đặng Văn Ngữ", "Phường Kim Liên", HN, 21.0110, 105.8360),
    "linhdam": ("Chung cư HH2 Linh Đàm", "Phường Hoàng Liệt", HN, 20.9640, 105.8280),
    "mydinh": ("Khu đô thị Mỹ Đình 1, đường Hàm Nghi", "Phường Từ Liêm", HN, 21.0310, 105.7700),
    "nct": ("Số 6 ngõ 91 Nguyễn Chí Thanh", "Phường Láng", HN, 21.0215, 105.8100),
    "bode": ("Ngõ 68 Nguyễn Văn Cừ", "Phường Bồ Đề", HN, 21.0440, 105.8730),
    "tdh": ("Ngõ 92 Trần Duy Hưng", "Phường Yên Hòa", HN, 21.0110, 105.8000),
    "ltk": ("18 Lý Thường Kiệt", "Phường Cửa Nam", HN, 21.0255, 105.8505),
    "lang": ("Ngõ 54 Nguyễn Chí Thanh", "Phường Láng", HN, 21.0230, 105.8095),
    "linhdam2": ("Chung cư HH4 Linh Đàm", "Phường Hoàng Liệt", HN, 20.9655, 105.8300),
    "dvt": ("Ngõ 1 Trần Quý Kiên", "Phường Cầu Giấy", HN, 21.0370, 105.7880),
    "vvt": ("Hẻm 102 Võ Văn Tần", "Phường Xuân Hòa", HCM, 10.7769, 106.6880),
    "manor": ("The Manor, 91 Nguyễn Hữu Cảnh", "Phường Thạnh Mỹ Tây", HCM, 10.7920, 106.7170),
    "ntrai": ("Hẻm 51 Nguyễn Trãi", "Phường Bến Thành", HCM, 10.7700, 106.6930),
    "pdl": ("Hẻm 215 Phan Đăng Lưu", "Phường Phú Nhuận", HCM, 10.8030, 106.6850),
    "pct": ("88 Phan Châu Trinh", "Phường Hải Châu", DN, 16.0670, 108.2210),
    "ngoquyen": ("Kiệt 75 Ngô Quyền", "Phường An Hải", DN, 16.0650, 108.2350),
    "ledinhly": ("Kiệt 25 Lê Đình Lý", "Phường Thanh Khê", DN, 16.0600, 108.2080),
}


def T(title, descs, cat, days, start, end, salary, rate, heads=1, window=None):
    """Mẫu tin lặp lại: `rate` tin/tuần, `window` = (từ N ngày trước, tới M ngày trước) nếu chỉ đăng theo mùa."""
    return dict(title=title, descs=descs, cat=cat, days=days, start=start, end=end, salary=salary, rate=rate,
                heads=heads, window=window)


# (email, sđt, tham gia N ngày trước, địa điểm, tính cách khi bị chấm, mẫu tin, bị khoá N ngày trước)
EMPLOYERS = [
    ("huongdinh.bd", "0913 245 118", 92, "doican", "good", [
        T("Dọn nhà sáng thứ 7", [
            "Nhà mình 3 tầng trong ngõ Đội Cấn, cần 1 bạn dọn dẹp sáng thứ 7: lau nhà, lau cầu thang, dọn bếp, giặt "
            "và phơi đồ. Nhà có sẵn máy hút bụi với đồ lau. Nhà có nuôi mèo nên bạn nào dị ứng lông mèo thì thông cảm nha.",
            "Như mọi tuần: lau 3 tầng, dọn bếp, thay ga giường tầng 2. Tuần này nhà có giỗ nên bếp hơi bừa, "
            "bạn chịu khó giúp mình."], DON, {T7}, "08:00", "11:00", 270_000, 0.8),
        T("Trông bé trai 5 tuổi buổi tối", [
            "Vợ chồng mình đi ăn cưới, cần người trông bé từ 6h tối tới 9h30. Bé ngoan, chỉ cần cho bé ăn tối (mình "
            "nấu sẵn rồi), tắm cho bé và kể chuyện cho bé ngủ. Ưu tiên bạn nữ có kinh nghiệm trông trẻ."],
          TRE, {T4, T6}, "18:00", "21:30", 300_000, 0.15),
    ], None),
    ("cafe.goc.tts", "0988 017 352", 90, "trantt", "good", [
        T("Phụ quán cafe ca sáng", [
            "Quán cafe nhỏ đường Trần Thái Tông cần người phụ ca sáng: pha chế đơn giản (cafe phin, bạc xỉu, trà đá), "
            "rửa ly, lau bàn, dọn quán. Không cần kinh nghiệm, anh chỉ 15 phút là làm được. 30k/h, làm ổn thì nhận dài.",
            "Ca sáng 6h-10h, khách chủ yếu dân văn phòng mua mang đi nên cần nhanh tay. Bao 1 ly nước."],
          QUAN, WEEKDAYS, "06:00", "10:00", 120_000, 1.0),
        T("Phụ quán ca tối cuối tuần", [
            "Tối thứ 7, chủ nhật quán đông, cần thêm 1 bạn bưng nước, dọn bàn, rửa ly. Quán có nhạc acoustic nên hơi "
            "ồn, bạn nào ngại thì cân nhắc."], QUAN, WEEKEND, "18:00", "22:30", 180_000, 0.5),
    ], None),
    ("maibui.home", "0904 366 027", 88, "tdt", "good", [
        T("Đi chợ, nấu cơm trưa, chăm bà", [
            "Cần người đi chợ, nấu cơm trưa cho 2 ông bà (ăn nhạt, ít dầu mỡ vì bà bị tiểu đường), sau đó dọn rửa và "
            "ngồi nói chuyện với bà một lúc. Bà đi lại chậm, cần người đỡ đi vệ sinh. Ưu tiên cô/chị lớn tuổi có kinh "
            "nghiệm chăm người già.",
            "Giống mọi tuần: đi chợ, nấu cơm trưa món Bắc, ăn nhạt. Dọn rửa xong ngồi với bà chút rồi về."],
          GIA, {T2, T5}, "09:30", "13:30", 280_000, 1.1),
        T("Đưa bà đi tái khám", [
            "Thứ 3 bà có lịch tái khám tiểu đường ở Bạch Mai, cần người đi cùng bà bằng taxi (nhà trả tiền xe), xếp "
            "hàng lấy số, đỡ bà đi lại, mua thuốc rồi đưa bà về. Thường mất cả buổi sáng."],
          GIA, {T3}, "07:00", "11:30", 250_000, 0.25),
    ], None),
    ("thaoly.timescity", "0936 480 915", 70, "timescity", "good", [
        T("Tổng vệ sinh căn hộ sau sửa chữa", [
            "Căn hộ 2PN 75m2 vừa sơn lại, bụi xi măng với vết sơn nhiều. Cần 2 người tổng vệ sinh: lau kính, cạo vết "
            "sơn, lau sàn, vệ sinh nhà tắm. Mình cấp đồ, bạn có dụng cụ riêng thì càng tốt. Làm nhanh gọn mình bo thêm."],
          DON, WEEKEND, "07:30", "12:30", 550_000, 1.0, heads=2, window=(70, 63)),
        T("Dọn nhà định kỳ chủ nhật", [
            "Căn hộ 2PN, 2 vợ chồng đi làm cả tuần nên cuối tuần cần người dọn: hút bụi, lau sàn, lau bếp, nhà tắm, "
            "gấp quần áo. Đồ lau dọn có đủ."], DON, {CN}, "08:00", "11:00", 250_000, 0.45),
    ], None),
    ("nhahang.hangbe", "0243 826 7731", 85, "hangbe", "good", [
        T("Phụ bếp, rửa bát tiệc cưới", [
            "Nhà hàng có tiệc cưới trưa cuối tuần, cần người phụ bếp: sơ chế rau, rửa bát, bưng bê dọn mâm. Bao cơm "
            "trưa. Mặc áo tối màu, đi giày kín mũi.",
            "Tiệc 35-40 mâm, cần người rửa bát với dọn mâm. Ai làm với nhà hàng rồi thì ưu tiên gọi lại."],
          TIEC, WEEKEND, "09:30", "15:00", 350_000, 1.0, heads=3),
        T("Rửa bát ca tối", ["Rửa bát ca tối 17h-22h, nhà hàng đông khách cuối tuần. Có chỗ gửi xe, bao bữa tối."],
          QUAN, {T6, T7}, "17:00", "22:00", 250_000, 0.5),
    ], None),
    ("minh.tayho", "0916 552 804", 80, "xuandieu", "good", [
        T("Dắt chó đi dạo + tưới cây", [
            "Mình đi công tác, cần người qua nhà buổi chiều dắt bé Golden đi dạo 30 phút quanh hồ, cho ăn và tưới cây "
            "ngoài ban công. Chó hiền, rất quấn người."], PET, {T2, T3, T4, T5}, "17:00", "18:00", 100_000, 0.5),
        T("Qua nhà cho chó ăn buổi sáng", [
            "Mình đi công tác mấy hôm, cần người qua buổi sáng cho bé Golden ăn, dắt đi vệ sinh, dọn qua sân. Chó hiền "
            "nhưng to, bạn nào sợ chó thì đừng nhận nha."], PET, {T6}, "07:00", "08:30", 120_000, 0.2),
    ], None),
    ("ly.vanquan", "0983 912 640", 75, "vanquan", "good", [
        T("Giặt ủi, dọn nhà sáng thứ 7", [
            "Nhà mình ở khu đô thị Văn Quán, cần người giặt ủi đồ cả tuần và dọn qua nhà cửa. Nhà 4 người nên đồ khá "
            "nhiều, có máy giặt máy sấy."], GIAT, {T7}, "08:00", "11:00", 250_000, 0.6),
    ], None),
    ("kimoanh.royal", "0975 133 806", 66, "royal", "good", [
        T("Đón bé tan học, trông đến 7h tối", [
            "Mình cần người đón bé lớp 2 ở trường tiểu học gần nhà (đi bộ 10 phút), về nhà cho bé tắm, ăn nhẹ, chơi "
            "với bé tới khi mình đi làm về khoảng 7h. Bé hơi nghịch nhưng nghe lời.",
            "Đón bé như mọi hôm. Hôm nay bé có bài tập tiếng Việt, bạn kèm bé viết giúp mình."],
          TRE, WEEKDAYS, "16:30", "19:00", 150_000, 1.1),
        T("Kèm bé lớp 3 làm bài tập", [
            "Bé lớp 3 học hơi chậm môn toán, cần người kèm làm bài tập về nhà 1,5 tiếng. Ưu tiên sinh viên sư phạm "
            "hoặc có kinh nghiệm gia sư."], KEM, {T3, T5}, "19:00", "20:30", 150_000, 0.6),
    ], None),
    ("tuanvu.kimlien", "0912 704 559", 58, "kimlien", "good", [
        T("Chăm ông sau mổ buổi sáng", [
            "Bố mình 78 tuổi vừa mổ khớp háng, đi lại phải có người đỡ. Cần người buổi sáng giúp ông vệ sinh cá nhân, "
            "cho ông ăn sáng, uống thuốc, tập đi trong nhà theo hướng dẫn của bác sĩ. Nhà tập thể tầng 2.",
            "Như hôm trước: vệ sinh cho ông, nấu cháo, nhắc ông uống thuốc, đỡ ông tập đi 15 phút."],
          GIA, {T2, T3, T4, T5, T6, T7}, "07:00", "11:00", 240_000, 1.0, window=(58, 20)),  # ông khoẻ dần
    ], None),
    ("tiembanh.thuha", "0968 330 217", 45, "linhdam", "good", [
        T("Đóng hộp bánh Trung thu ca tối", [
            "Tiệm bánh nhà làm cần người phụ đóng hộp, dán tem, xếp bánh vào túi giao cho khách. Việc ngồi một chỗ, "
            "không nặng, làm 3 tiếng. Tuần cận Rằm làm tới khuya thì có phụ cấp thêm.",
            "Cận Trung thu đơn nhiều quá, cần thêm 2 bạn đóng hộp tối nay. Ai làm hôm trước rồi thì càng tốt."],
          QUAN, EVERYDAY, "18:30", "21:30", 160_000, 3.0, heads=2, window=(40, 15)),  # Rằm tháng 8: 25/9/2026
        T("Đứng quầy bán bánh sáng chủ nhật", [
            "Tiệm bánh ở sảnh chung cư HH2 Linh Đàm cần 1 bạn đứng quầy sáng chủ nhật: lấy bánh, tính tiền (có máy), "
            "đóng gói. Không cần kinh nghiệm."], QUAN, {CN}, "07:00", "11:00", 140_000, 0.6, window=(14, -14)),
    ], None),
    ("lananh.mydinh", "0989 461 273", 50, "mydinh", "good", [
        T("Nấu cơm tối cho gia đình 4 người", [
            "Nhà mình 2 vợ chồng với 2 bé, đi làm về muộn. Cần người đi chợ (tiền chợ mình gửi trước), nấu bữa tối "
            "3 món + canh, dọn rửa bếp. Nhà ăn nhạt, các bé không ăn cay.",
            "Nấu tối như mọi hôm. Hôm nay có ông bà nội lên chơi nên nấu cho 6 người nhé."],
          NAU, {T2, T3, T4, T5}, "16:00", "19:00", 200_000, 1.0),
    ], None),
    ("dichvutiec.thanhnam", "0904 991 238", 82, "nct", "stingy", [
        T("Phục vụ tiệc buffet công ty", [
            "Bên mình nhận tổ chức tiệc buffet, cần bạn phục vụ: bày đồ ăn, thay khay, dọn bàn. Mặc áo trắng quần đen, "
            "có mặt trước giờ tiệc 30 phút để phổ biến công việc. Tiệc ở các toà văn phòng khu Cầu Giấy, Đống Đa, "
            "sẽ báo địa chỉ cụ thể.",
            "Tiệc của một công ty khoảng 150 khách. Cần 3 bạn phục vụ, ưu tiên nam cao ráo."],
          TIEC, {T5, T6, T7}, "17:00", "21:30", 300_000, 0.6, heads=3),
    ], None),
    ("nguyenhoa.bode", "0396 218 447", 62, "bode", "good", [
        T("Chuyển đồ lên tầng 3", [
            "Nhà mình mới mua tủ, giường, cần 2 bạn khoẻ khuân đồ từ tầng 1 lên tầng 3 (cầu thang bộ), sau đó dọn bìa "
            "carton, xốp đi bỏ. Tầm 2 tiếng là xong."], VAC, WEEKEND, "08:00", "10:30", 250_000, 0.15, heads=2),
        T("Dọn kho, phân loại đồ cũ", [
            "Dọn kho tầng 1 đầy đồ cũ: phân loại cái nào bán đồng nát, cái nào bỏ, lau dọn sạch kho. Bụi nhiều, nên "
            "mang khẩu trang."], VAC, WEEKEND, "14:00", "17:00", 220_000, 0.15),
    ], None),
    ("thuydung.yenhoa", None, 77, "tdh", "good", [
        T("Qua nhà cho mèo ăn, dọn cát", [
            "Mình về quê mấy hôm, cần người qua nhà 1 lần/ngày cho 2 bé mèo ăn, thay nước, dọn khay cát. Tầm 30-45 "
            "phút. Mình gửi chìa khoá ở bảo vệ toà nhà.",
            "Lại về quê rồi 😅 nhờ bạn qua cho 2 bé mèo ăn, dọn cát giúp mình, mèo nhà mình hơi nhát người."],
          PET, EVERYDAY, "18:00", "19:00", 80_000, 0.35),
        T("Dọn nhà, lau kính ban công", [
            "Căn hộ 1PN, cần dọn kỹ: lau kính ban công, lau quạt, cọ nhà tắm, hút bụi sofa (có lông mèo)."],
          DON, WEEKEND, "09:00", "12:00", 230_000, 0.25),
    ], None),
    ("homestay.cuanam", "0866 402 931", 88, "ltk", "strict", [
        T("Dọn phòng homestay sau khi khách trả phòng", [
            "Homestay 5 phòng phố cổ, cần người dọn phòng sau khi khách check-out: thay ga gối, lau nhà, cọ nhà tắm, "
            "bổ sung đồ dùng. Làm quen việc thì 1 phòng tầm 25-30 phút.",
            "Hôm nay 4 phòng trả cùng lúc, cần dọn kịp trước 14h khách mới nhận phòng."],
          DON, EVERYDAY, "10:00", "14:00", 200_000, 1.4),
    ], None),
    ("quanbun.ngo54", "0977 645 120", 90, "lang", "good", [
        T("Phụ bán bún chả buổi trưa", [
            "Quán bún chả cần người phụ giờ trưa: bưng bún, dọn bàn, rửa bát. Trưa đông từ 11h tới 13h nên cần nhanh "
            "nhẹn. Bao bữa trưa.",
            "Phụ quán trưa như mọi hôm, ai làm rồi biết việc thì ưu tiên."],
          QUAN, WEEKDAYS, "10:30", "13:30", 130_000, 1.5),
    ], None),
    ("phuong.linhdam", "0352 778 190", 55, "linhdam2", "good", [
        T("Kèm tiếng Anh giao tiếp cho bé 8 tuổi", [
            "Bé học lớp 3, đã học tiếng Anh ở trường nhưng còn ngại nói. Cần bạn nói chuyện, chơi trò chơi bằng tiếng "
            "Anh với bé 1,5 tiếng, chủ yếu cho bé dạn nói. Ưu tiên bạn phát âm tốt."],
          KEM, {T3, T5, T7}, "19:00", "20:30", 180_000, 1.0),
    ], None),
    ("vieclam.online247", "0563 118 902", 19, "dvt", "spam", [
        T("Tuyển CTV làm tại nhà, việc nhẹ lương cao", [
            "Cần gấp 20 CTV đóng gói hàng tại nhà, 300-500k/ngày, không cần kinh nghiệm. Liên hệ Zalo để nhận việc. "
            "Đặt cọc 200k nhận nguyên liệu, hoàn cọc khi bàn giao hàng."],
          QUAN, EVERYDAY, "08:00", "17:00", 500_000, 1.5, window=(19, 13)),
    ], 13),
    ("khoa.dang.q3", "0903 584 216", 84, "vvt", "good", [
        T("Dọn dẹp + ủi đồ công sở", [
            "Nhà 1 trệt 1 lầu, cần dọn dẹp, lau nhà và ủi khoảng 15 bộ đồ công sở. Hẻm xe máy vào được, gửi xe free."],
          GIAT, {T7}, "14:00", "17:00", 240_000, 0.6),
    ], None),
    ("ngan.manor", "0938 207 664", 60, "manor", "good", [
        T("Trông bé 3 tuổi buổi tối", [
            "Hai vợ chồng có việc buổi tối, cần người trông bé gái 3 tuổi ở căn hộ. Bé đã ăn tối, chỉ cần chơi với bé, "
            "đánh răng và dỗ bé ngủ khoảng 8h30."], TRE, {T5, T6, T7}, "18:00", "21:30", 280_000, 0.5),
    ], None),
    ("cafe.moc.q1", "0898 335 172", 80, "ntrai", "good", [
        T("Phụ quán cafe cuối tuần", [
            "Quán cafe nhỏ trong hẻm Nguyễn Trãi cần bạn phụ ca cuối tuần: order, bưng nước, dọn bàn. Biết pha cà phê "
            "muối là điểm cộng.",
            "Phụ quán ca chiều, cuối tuần khách du lịch nhiều nên cần nói được vài câu tiếng Anh cơ bản."],
          QUAN, WEEKEND, "13:00", "18:00", 150_000, 1.0),
    ], None),
    ("phat.phunhuan", "0909 412 783", 55, "pdl", "good", [
        T("Chăm bà nội buổi chiều", [
            "Bà nội 85 tuổi, còn minh mẫn nhưng đi lại yếu. Cần người buổi chiều nấu cháo, cho bà ăn, nhắc bà uống "
            "thuốc, đẩy xe lăn cho bà ra hẻm hóng mát. Ưu tiên cô/chị có kinh nghiệm."],
          GIA, {T2, T4, T6}, "14:00", "18:00", 220_000, 0.8),
    ], None),
    ("ngoc.phan.dn", "0905 640 318", 78, "pct", "good", [
        T("Trông 2 bé chiều thứ 7", [
            "Trông 2 bé (7 tuổi và 4 tuổi) buổi chiều, trời mát thì dẫn bé ra công viên APEC gần nhà chơi. Bạn nào "
            "biết chút tiếng Anh nói chuyện với bé thì càng tốt."], TRE, {T7}, "13:30", "18:00", 320_000, 0.6),
        T("Kèm tiếng Anh cho bé 7 tuổi", [
            "Bé lớn nhà mình 7 tuổi, cần bạn kèm tiếng Anh qua trò chơi, đọc truyện. 1 tiếng mỗi buổi."],
          KEM, {T3, T5}, "18:30", "19:30", 120_000, 0.4),
    ], None),
    ("homestay.anhai", "0935 266 094", 86, "ngoquyen", "good", [
        T("Dọn phòng homestay gần biển", [
            "Homestay 6 phòng gần biển Mỹ Khê, cần dọn phòng sau khi khách trả: thay ga, lau nhà, cọ nhà tắm, giặt "
            "khăn bằng máy. Cát nhiều nên lau kỹ giúp mình nha.",
            "Cuối tuần khách đông, cần thêm người dọn buổi trưa."], DON, EVERYDAY, "10:00", "14:00", 180_000, 1.0),
    ], None),
    ("dung.thanhkhe", None, 70, "ledinhly", "good", [
        T("Nấu cơm trưa + dọn nhà", [
            "Nhà có ông bà lớn tuổi ở nhà ban ngày, cần người đi chợ nấu cơm trưa món miền Trung, dọn dẹp nhà cửa nhẹ "
            "nhàng. Ông bà dễ tính."], NAU, {T2, T4, T6}, "09:00", "12:30", 180_000, 0.4),
    ], None),
]

# (email, sđt, đã xác minh, tham gia N ngày trước, thành phố, kỹ năng, lịch rảnh hằng tuần, mô tả, tính cách, bị khoá)
SEEKERS = [
    ("lannguyen.neu", "0912 345 678", True, 91, HN, {DON, GIAT, TRE},
     [(WEEKDAYS, "13:30", "17:30"), (WEEKEND, "07:00", "20:00")],
     "Em là sv năm 2 NEU, ở trọ gần Bạch Mai. Em rảnh các buổi chiều trong tuần với cả ngày cuối tuần. Em làm được "
     "dọn dẹp nhà, rửa bát, giặt ủi, trông em nhỏ cũng được ạ (nhà em có 2 đứa em nên quen rồi).", "good", None),
    ("hungtran.xeom", "0987 111 222", True, 89, HN, {QUAN, VAC, TIEC}, [(EVERYDAY, "05:30", "10:00")],
     "Chạy xe ôm công nghệ là chính, sáng sớm 5h30 tới 10h thì rảnh. Nhận phụ quán, bưng bê, rửa ly, khuân vác nhẹ. "
     "Nhà ở Cầu Giấy nên ưu tiên việc gần.", "good", None),
    ("lehoa1974", "0904 555 666", True, 87, HN, {NAU, GIA, DON}, [(WEEKDAYS, "08:00", "14:00")],
     "Cô 52 tuổi, nghỉ hưu. Cô nấu ăn món Bắc ngon, từng chăm bà nội 3 năm nên quen chăm người già. Cô không làm "
     "buổi tối, không đi xa quá 5 cây số.", "good", None),
    ("trangpham.tx", "0935 777 888", True, 80, HN, {TRE, KEM},
     [(WEEKDAYS, "18:30", "22:00"), ({CN}, "08:00", "21:00")],
     "Mình làm văn phòng giờ hành chính, tối từ 18h30 với cả ngày chủ nhật thì rảnh. Kèm bé học bài, trông trẻ, dạy "
     "tiếng Anh giao tiếp cơ bản cho bé được. Có xe máy.", "good", None),
    ("tuananhvu.hust", None, False, 30, HN, {DON, VAC}, [(WEEKEND, "07:00", "18:00")],
     "don nha, khuan do, sua dien nuoc co ban. lam dc cuoi tuan", "good", None),
    ("namdo.nd96", "0977 333 444", True, 84, HN, {DON, QUAN, TIEC, VAC, PET, GIAT}, [(EVERYDAY, "07:00", "21:00")],
     "Chào mọi người, mình tên Nam, 24 tuổi, quê Nam Định, đang ở trọ Hai Bà Trưng. Hiện mình đang thất nghiệp nên "
     "cần việc gấp, việc gì cũng làm được: dọn nhà, rửa bát, phụ quán, bốc vác, trông xe, giao hàng... Mình chăm "
     "chỉ, thật thà, không ngại việc nặng. Ai cần liên hệ mình nha, cảm ơn nhiều!!!", "meh", None),
    ("thuhuong.ftu", "0329 614 552", True, 76, HN, {TRE, KEM},
     [({T3, T5}, "14:00", "21:00"), (WEEKEND, "08:00", "21:00")],
     "Mình là Hương, sinh viên năm 3 Ngoại thương, IELTS 7.0. Mình từng làm trợ giảng ở trung tâm tiếng Anh trẻ em "
     "1 năm nên khá quen với các bé 5-10 tuổi. Có thể kèm bài tập, đọc truyện tiếng Anh, trông bé buổi tối.",
     "good", None),
    ("ngocanh.k65", "0386 220 917", True, 61, HN, {QUAN, TIEC},
     [({T6}, "17:00", "23:00"), (WEEKEND, "08:00", "23:00")],
     "Em sv năm nhất, nhanh nhẹn, đã từng làm phục vụ ở quán cafe chuỗi 3 tháng. Rảnh tối thứ 6 với cả cuối tuần ạ.",
     "good", None),
    ("bichngoc1999", "0961 845 203", True, 83, HN, {DON, GIAT, NAU}, [(WEEKDAYS, "08:30", "15:30")],
     "Mình có bé đang học mẫu giáo nên chỉ làm được giờ hành chính, đưa con đi học xong là rảnh tới 3h30 chiều. "
     "Dọn nhà, giặt ủi, nấu ăn gia đình đều được, làm cẩn thận.", "good", None),
    ("minhquan.dhxd", "0332 907 461", True, 79, HN, {VAC, TIEC, QUAN},
     [(WEEKDAYS, "17:00", "22:00"), (WEEKEND, "07:00", "22:00")],
     "SV Xây dựng, cao 1m78, khoẻ, bê vác chuyển đồ ok. Phục vụ tiệc cưới cũng đã đi nhiều. Tối trong tuần với cuối "
     "tuần thì ib mình.", "good", None),
    ("vanthanh.hp", "0904 228 315", True, 86, HN, {DON, NAU, GIA}, [(EVERYDAY, "07:00", "17:00")],
     "Cô quê Hải Phòng, lên Hà Nội ở với con gái. Cô làm giúp việc theo giờ được 4 năm rồi, dọn nhà, nấu cơm, chăm "
     "người già đều làm được. Cô ở Thanh Xuân, đi xe buýt nên ưu tiên chỗ gần.", "good", None),
    ("phuongthao.hvnh", "0868 412 659", True, 72, HN, {KEM, TRE}, [(WEEKDAYS, "17:30", "21:00")],
     "Em là sinh viên Học viện Ngân hàng, học chuyên Toán cấp 3. Nhận kèm toán tiểu học, THCS, kiểm tra bài tập về "
     "nhà cho các bé. Em kiên nhẫn và nói dễ hiểu ạ.", "good", None),
    ("ducanh.dog", "0912 087 446", True, 81, HN, {PET},
     [(EVERYDAY, "06:00", "08:30"), (EVERYDAY, "17:00", "20:00")],
     "Nhà mình nuôi 3 bé chó nên rất quen chó mèo, kể cả chó to. Nhận dắt chó đi dạo, cho ăn, tắm cơ bản, trông nhà "
     "giúp khi bạn đi vắng. Sáng sớm với chiều tối mình rảnh.", "good", None),
    ("haiyen.dieuduong", "0983 650 172", True, 64, HN, {GIA, NAU},
     [({T2, T4, T6}, "07:00", "12:00"), (WEEKEND, "07:00", "17:00")],
     "Chị là điều dưỡng, làm ca ở viện nên lịch rảnh xen kẽ. Chăm người già, người sau mổ, đo huyết áp, tiêm insulin, "
     "hướng dẫn tập vận động đều được. Ai cần người chăm có chuyên môn thì nhắn chị.", "good", None),
    ("quynhchi.2004", "0355 712 098", True, 47, HN, {QUAN, TIEC, TRE},
     [(WEEKEND, "07:00", "22:00"), ({T4}, "13:00", "18:00")],
     "hi mn, em năm 2 đh thương mại ạ. em làm phục vụ, phụ quán, trông bé đều đc, em vui vẻ hoà đồng 😊", "good", None),
    ("bacminh.huutri", "0913 506 284", True, 69, HN, {PET, VAC}, [(WEEKDAYS, "07:00", "11:00")],
     "Tôi 61 tuổi, nghỉ hưu, sức khoẻ tốt. Nhận tưới cây, chăm cây cảnh, cho cá cho chó ăn khi chủ nhà đi vắng, "
     "khuân vác nhẹ. Buổi sáng tôi rảnh.", "good", None),
    ("thanhtam.hd", "0973 248 610", True, 74, HN, {DON, GIAT}, [({T2, T3, T4, T5, T6, T7}, "08:00", "12:00")],
     "Nhà chị ở Hà Đông, nhận dọn nhà, giặt ủi buổi sáng. Làm sạch sẽ, có kinh nghiệm dọn nhà sau sửa chữa.",
     "good", None),
    ("kimchi.bep", "0948 337 105", True, 88, HN, {NAU, QUAN, TIEC},
     [(WEEKEND, "06:00", "22:00"), ({T3, T5}, "16:00", "21:00")],
     "Chị từng làm bếp nhà hàng 6 năm, nấu được cỗ, sơ chế nhanh. Nghỉ ở nhà trông con nên nhận việc theo buổi, ưu "
     "tiên cuối tuần.", "good", None),
    ("longpham.gym", "0399 860 431", True, 57, HN, {VAC, TIEC},
     [(WEEKDAYS, "14:00", "22:00"), (WEEKEND, "08:00", "20:00")],
     "Mình 26t, làm PT phòng gym ca sáng, chiều tối rảnh. Khuân vác, chuyển nhà, bê đồ lên tầng, sức khoẻ ok.",
     "good", None),
    ("maianh.mamnon", "0916 274 983", True, 68, HN, {TRE}, [(WEEKDAYS, "07:00", "19:00")],
     "Mình từng là giáo viên mầm non 5 năm, giờ nghỉ để chăm con nhỏ nên nhận trông trẻ theo giờ. Biết dỗ bé ăn, bé "
     "ngủ, sơ cứu cơ bản. Ưu tiên các bé dưới 6 tuổi.", "good", None),
    ("hoangviet.sv", "0367 491 205", True, 73, HN, {QUAN, TIEC, VAC, DON},
     [(WEEKDAYS, "17:00", "23:00"), (WEEKEND, "07:00", "23:00")],
     "sv nam, nhan phu quan, phuc vu tiec, khuan do. lam dc toi va cuoi tuan", "good", 12),  # nhận việc rồi bùng
    ("thuyduong.88", None, True, 65, HN, {DON, GIAT, NAU}, [(WEEKDAYS, "13:00", "18:00")],
     "Dọn dẹp nhà cửa, giặt ủi, nấu ăn gia đình. Làm việc buổi chiều.", "good", None),
    ("ngoctram.ketoan", "0904 773 128", True, 52, HN, {TRE, KEM, DON}, [(WEEKDAYS, "09:00", "16:30")],
     "Mình làm kế toán online nên giờ giấc linh hoạt, ban ngày trong tuần đều sắp xếp được. Trông bé, kèm bé học bài, "
     "dọn nhà nhẹ nhàng ok.", "good", None),
    ("huyhoang.bk", "0358 116 724", True, 77, HN, {KEM},
     [(WEEKDAYS, "18:00", "21:30"), ({CN}, "08:00", "11:00")],
     "Sinh viên năm 4 ĐH Bách khoa, 3 năm gia sư toán lý cấp 2, cấp 3. Nhận kèm buổi tối.", "good", None),
    ("linhchi.meomeo", "0389 205 776", True, 63, HN, {PET, DON},
     [(WEEKEND, "08:00", "20:00"), ({T3, T5}, "18:00", "21:00")],
     "Con sen chính hiệu 🐱 nhà nuôi 2 mèo. Nhận cho mèo ăn, dọn cát, chơi với boss khi chủ đi vắng. Dọn nhà cũng "
     "được ạ.", "good", None),
    ("tranloan.1970", "0912 640 357", True, 85, HN, {GIA, NAU}, [(EVERYDAY, "06:00", "13:00")],
     "Cô năm nay 56 tuổi, đã chăm bà ngoại liệt 2 năm nên quen việc chăm người già: vệ sinh, cho ăn, đỡ đi lại. Cô "
     "nấu cháo, nấu cơm ăn kiêng cho người tiểu đường được.", "good", None),
    ("duyanh.music", "0342 558 019", True, 59, HN, {TIEC, QUAN}, [({T6, CN}, "15:00", "23:00")],
     "Mình chơi guitar ở quán vào tối thứ 7 nên rảnh tối thứ 6, chủ nhật và mấy buổi chiều. Phục vụ tiệc, bưng bê, "
     "phụ quán đều được.", "good", None),
    ("vietha.mydinh", "0971 836 240", True, 49, HN, {DON, VAC},
     [(WEEKDAYS, "18:00", "21:00"), (WEEKEND, "08:00", "18:00")],
     "Nhà ở Mỹ Đình, nhận dọn dẹp, khuân đồ, chuyển nhà nhỏ. Sau giờ làm hành chính với cuối tuần.", "good", None),
    ("hongnhung.qn", "0376 912 584", True, 38, HN, {QUAN, DON}, [(EVERYDAY, "10:00", "22:00")],
     "Em quê Quảng Ninh mới lên Hà Nội, đang tìm việc làm thêm ổn định. Bưng bê, rửa bát, phụ quán, dọn phòng em làm "
     "được hết, chịu khó ạ.", "good", None),
    ("thanhnga.lb", "0985 427 330", True, 71, HN, {NAU, DON, TRE}, [(WEEKDAYS, "09:00", "17:00")],
     "Chị ở Long Biên, con lớn rồi nên ban ngày rảnh. Nấu ăn ngon, dọn nhà sạch sẽ, trông trẻ có kinh nghiệm (nuôi "
     "2 đứa rồi 😄).", "good", None),
    ("dangkhoa.it", None, True, 42, HN, {PET, VAC}, [(WEEKEND, "07:00", "18:00")],
     "Dev làm remote, cuối tuần muốn ra ngoài vận động chút. Dắt chó, chuyển đồ, bê vác ok.", "good", None),
    ("phamyen.k67", None, False, 4, HN, set(), [], None, "good", None),  # vừa đăng ký, chưa làm gì
    ("trinhthu.1995", "0962 318 457", True, 67, HN, {DON},
     [(WEEKDAYS, "09:00", "15:00"), ({T7}, "09:00", "15:00")],
     "Chị nhận dọn phòng homestay, khách sạn mini, căn hộ dịch vụ khu phố cổ. Đã làm buồng phòng khách sạn 2 năm.",
     "good", None),
    ("buiquang.shipper", "0337 604 192", True, 54, HN, {VAC, QUAN}, [(EVERYDAY, "13:00", "17:00")],
     "Chạy ship buổi sáng với tối, giữa trưa chiều rảnh. Bốc xếp hàng, khuân đồ, phụ quán ok.", "meh", None),
    ("vyhuynh.bt", "0909 888 999", True, 82, HCM, {DON, GIAT, NAU}, [(WEEKEND, "08:00", "18:00")],
     "Dọn dẹp nhà cửa, ủi đồ, nấu ăn đơn giản. Rảnh cuối tuần.", "good", None),
    ("tuankiet.hcmus", "0372 146 980", True, 75, HCM, {QUAN, KEM},
     [(WEEKDAYS, "18:00", "21:00"), (WEEKEND, "07:00", "19:00")],
     "Sinh viên KHTN, nhận phụ quán cafe cuối tuần, kèm toán cho học sinh cấp 2 buổi tối. Tiếng Anh giao tiếp ổn.",
     "good", None),
    ("colan.govap", "0937 520 664", True, 70, HCM, {GIA, NAU, DON}, [(WEEKDAYS, "08:00", "18:00")],
     "Cô ở Gò Vấp, nhận chăm người già ban ngày, nấu cơm, dọn dẹp. Cô làm kỹ, không ngại việc.", "good", None),
    ("baotran.2003", "0328 709 341", True, 58, HCM, {TRE, QUAN},
     [({T5, T6}, "17:00", "22:00"), (WEEKEND, "08:00", "22:00")],
     "Em sv năm 3, thích con nít, có em gái nhỏ nên trông bé quen tay. Phụ quán cuối tuần cũng được ạ.", "good", None),
    ("minhthu.uel", "0886 254 017", True, 66, HCM, {DON, TRE, GIAT},
     [(WEEKDAYS, "13:00", "18:00"), ({T7}, "13:00", "18:00")],
     "Sinh viên UEL, rảnh buổi chiều. Dọn nhà, ủi đồ, trông bé đều được nha.", "good", None),
    ("anhkhoa.pn", "0794 312 865", True, 51, HCM, {QUAN, VAC},
     [(EVERYDAY, "06:00", "11:00"), (WEEKEND, "13:00", "18:00")],
     "Nhận phụ quán, bưng bê, khuân vác buổi sáng với chiều cuối tuần. Ở Phú Nhuận.", "good", None),
    ("ducngo.dut", "0905 123 123", True, 80, DN, {TRE, KEM},
     [(WEEKEND, "13:00", "20:00"), ({T3, T5}, "18:00", "21:00")],
     "Sinh viên ĐH Đà Nẵng, IELTS 6.5, thích chơi với con nít. Trông trẻ, dạy kèm tiếng Anh cho bé được.",
     "good", None),
    ("thaovy.dn", "0702 846 519", True, 78, DN, {DON}, [(EVERYDAY, "08:00", "14:30")],
     "Em ở Sơn Trà, nhận dọn phòng homestay, khách sạn mini buổi sáng tới đầu giờ chiều.", "good", None),
    ("chinh.camle", "0914 375 206", True, 69, DN, {NAU, GIA, DON}, [(WEEKDAYS, "07:00", "16:00")],
     "Chị nấu món Quảng, món Huế ngon, nhận nấu cơm trưa, dọn nhà, chăm ông bà ban ngày.", "good", None),
    ("hoangnam.due", "0779 418 653", True, 56, DN, {QUAN, TIEC},
     [(WEEKDAYS, "17:00", "22:00"), (WEEKEND, "08:00", "22:00")],
     "SV Kinh tế ĐN, phục vụ nhà hàng tiệc cưới được, buổi tối với cuối tuần.", "good", None),
    ("myle.sontra", None, True, 44, DN, {TRE, DON}, [(WEEKEND, "08:00", "18:00")],
     "Mình ở Sơn Trà, trông bé, dọn nhà cuối tuần.", "good", None),
]

SCORES = {  # tính cách → phân bố điểm người kia chấm cho mình
    "good": [5] * 7 + [4] * 3 + [3], "meh": [5, 4, 4, 3, 3, 2], "stingy": [5, 4, 4, 3, 3], "strict": [5, 4, 4, 4, 3],
}
COMMENTS = {
    "employer": {  # chủ chấm người làm
        5: ["Làm cẩn thận, sạch sẽ, lần sau chị lại gọi.", "Đúng giờ, nhanh nhẹn, rất ok.",
            "Bạn ấy chịu khó, bếp sạch bong luôn 👍", "Bé quý bạn lắm, lần sau nhờ tiếp.", "Làm tốt, không phải nhắc gì.",
            "Nhanh tay, quán đông vẫn xoay được.", "Nấu ăn hợp khẩu vị ông bà, cảm ơn cô nhiều.",
            "Thật thà, gọn gàng. Recommend!", "Rất ổn", "Thuê mấy lần rồi, vẫn hài lòng.",
            "Chu đáo, còn nhắn lại tình hình cho mình sau buổi làm."],
        4: ["Làm ổn, có điều đến muộn 10 phút.", "Được, lúc đầu hơi chậm nhưng sau quen việc.",
            "Bạn hiền, làm được việc. Lần sau nhớ đem dép đi trong nhà nhé.", "Tạm ổn, lau kính còn vệt.",
            "Ok, hơi ít nói."],
        3: ["Làm được nhưng hơi ẩu, phải nhắc lau lại nhà tắm.", "Đến trễ gần 30 phút không báo trước.",
            "Làm chậm, quá giờ 30 phút mới xong."],
        2: ["Đến muộn, làm qua loa, chắc không thuê lại.", "Dùng điện thoại suốt, phải nhắc mấy lần."],
    },
    "seeker": {  # người làm chấm chủ
        5: ["Chị chủ nhà dễ thương, còn cho em mang bánh về 🥰", "Anh chủ vui tính, chỉ việc kỹ, trả đủ tiền ngay sau ca.",
            "Nhà gọn sẵn nên dọn nhanh, chủ nhà tử tế.", "Cô chú hiền lắm, có việc em lại đi.",
            "Trả tiền đúng như tin đăng, còn bo thêm 50k.", "Bố mẹ bé chuẩn bị sẵn đồ ăn hết rồi, bé ngoan.",
            "Đúng mô tả, sẽ quay lại.", "Tốt", "Được bao cơm, mọi người thân thiện."],
        4: ["Việc nhiều hơn mô tả một chút nhưng chủ nhà vui vẻ.", "Ok, có điều ngõ hơi khó tìm.",
            "Ổn, đứng chờ hơi lâu mới có người mở cửa.", "Trả tiền hơi muộn (tối mới chuyển khoản) nhưng đủ."],
        3: ["Việc nhiều hơn mô tả, tin ghi dọn 2 tầng mà thực tế 3 tầng.", "Chủ hơi khó tính, bắt làm lại mấy lần.",
            "Quá giờ 45 phút mà không tính thêm."],
        2: ["Làm xong trả thiếu 50k so với tin, bảo là trừ vì về sớm 15 phút."],
    },
}


def between(lo, hi):
    """Thời điểm ngẫu nhiên trong [lo, hi], tránh 0h-6h sáng nếu được. None nếu khoảng rỗng."""
    if hi <= lo:
        return None
    t = lo + (hi - lo) * rng.random()
    if t.hour < 6:
        t2 = t.replace(hour=rng.randint(6, 8), minute=rng.randint(0, 59))
        t = t2 if lo <= t2 <= hi else t
    return t


def day(offset):
    return TODAY + timedelta(days=offset)


def wsample(items, weights, k):
    items, weights, out = list(items), list(weights), []
    while items and len(out) < k:
        i = rng.choices(range(len(items)), weights)[0]
        out.append(items.pop(i))
        weights.pop(i)
    return out


def fits(pattern, job):
    s, e, wd = job.time_start.strftime("%H:%M"), job.time_end.strftime("%H:%M"), job.time_start.weekday()
    return any(wd in days and a <= s and e <= b for days, a, b in pattern)


def build():
    users, jobs, apps, ratings, reports, notes, intervals = [], [], [], {}, [], [], []

    def note(user_id, type, message, related_id, created_at):
        fresh = NOW - created_at < timedelta(days=2)
        notes.append(Notification(id=uuid.uuid4(), user_id=user_id, type=type, message=message, related_id=related_id,
                                  created_at=created_at, is_read=rng.random() < (0.45 if fresh else 0.93)))

    def joined(days_ago):
        return at(day(-days_ago), f"{rng.randint(7, 22):02d}:{rng.randint(0, 59):02d}")

    emp, seek = {}, {}
    for email, phone, days_ago, loc, quality, templates, until in EMPLOYERS:
        u = User(id=uuid.uuid4(), role="employer", email=email + DOMAIN, phone=phone, email_verified=True,
                 created_at=joined(days_ago))
        emp[email] = dict(user=u, loc=LOC[loc], quality=quality, templates=templates,
                          until=at(day(-until), "10:00") if until else None)
        users.append(u)
    for email, phone, verified, days_ago, city, skills, pattern, desc, quality, until in SEEKERS:
        u = User(id=uuid.uuid4(), role="job_seeker", email=email + DOMAIN, phone=phone, email_verified=verified,
                 description=desc, created_at=joined(days_ago))
        seek[email] = dict(user=u, city=city, skills=skills, pattern=pattern, quality=quality, busy=[],
                           until=at(day(-until), "22:00") if until else None)
        users.append(u)

    # ---------- Tin: mỗi mẫu đăng lặp theo tuần từ lúc chủ tham gia tới 2 tuần tới ----------
    meta = {}  # job.id → (employer, mẫu)
    for e in emp.values():
        street, ward, city, lat, lng = e["loc"]
        stop = min(NOW, e["until"] or NOW)
        for t in e["templates"]:
            lo, hi = (e["user"].created_at.date() - TODAY.date()).days + 1, 13
            if t["window"]:
                lo, hi = max(lo, -t["window"][0]), min(hi, -t["window"][1])
            seen = set()
            for wk in range(lo, hi + 1, 7):
                rate = t["rate"] * min(1, 0.4 + 0.6 * (wk + 90) / 90)  # nền tảng mới: lượng tin tăng dần
                count = int(rate) + (rng.random() < rate % 1)
                options = [d for d in range(wk, min(wk + 7, hi + 1)) if day(d).weekday() in t["days"]]
                for d in rng.sample(options, min(count, len(options))):
                    start, end = at(day(d), t["start"]), at(day(d), t["end"])
                    created = max(start - timedelta(hours=rng.uniform(8, 330)),
                                  e["user"].created_at + timedelta(hours=rng.uniform(0.3, 30)))
                    if created >= min(start - timedelta(hours=1), stop) or d in seen:
                        continue  # chưa tới lúc đăng / chủ đã bị khoá
                    seen.add(d)
                    j = Job(id=uuid.uuid4(), employer_id=e["user"].id, title=t["title"],
                            description=rng.choice(t["descs"]), street=street, ward=ward, city=city, lat=lat, lng=lng,
                            time_start=start, time_end=end, salary=t["salary"], status="open", created_at=created)
                    jobs.append(j)
                    meta[j.id] = (e, t)
    jobs.sort(key=lambda j: j.created_at)

    # ---------- Đơn ứng tuyển + duyệt đơn ----------
    app_meta = {}  # app.id → (job, seeker)
    for j in jobs:
        e, t = meta[j.id]
        hi = min(j.time_start - timedelta(hours=1), NOW, e["until"] or NOW)
        pool = [s for s in seek.values() if s["city"] == j.city and t["cat"] in s["skills"]
                and s["user"].created_at < hi and (s["until"] is None or s["until"] > j.created_at)]
        n = rng.choices(range(6), [12, 26, 27, 18, 11, 6])[0] + t["heads"] - 1
        picked = wsample(pool, [3 if fits(s["pattern"], j) else 0.4 for s in pool], n)
        mine = []
        for s in picked:
            top = min(hi, s["until"] or hi)
            created = between(max(j.created_at, s["user"].created_at) + timedelta(minutes=10), top)
            if created is None:
                continue
            a = Application(id=uuid.uuid4(), job_id=j.id, job_seeker_id=s["user"].id, status="pending",
                            created_at=created, updated_at=created)
            apps.append(a)
            app_meta[a.id] = (j, s)
            mine.append((a, s))
            note(e["user"].id, "new_application", f"{s['user'].email} ứng tuyển “{j.title}”", j.id, created)
        if not mine or e["quality"] == "spam":
            continue
        decide = between(max(a.created_at for a, _ in mine) + timedelta(minutes=20),
                         j.time_start - timedelta(minutes=30))
        if decide is None or decide > NOW:
            continue  # chủ chưa duyệt
        accepted = 0
        for a, s in sorted(mine, key=lambda x: (not fits(x[1]["pattern"], j), rng.random())):
            free = not any(b0 < j.time_end and j.time_start < b1 for b0, b1 in s["busy"])
            if accepted < t["heads"] and free:
                a.status, a.updated_at, accepted = "accepted", decide, accepted + 1
                s["busy"].append((j.time_start, j.time_end))
            else:
                r = rng.random()
                if r < 0.15:  # người làm tự rút đơn trước khi được duyệt
                    a.status, a.updated_at = "cancelled", between(a.created_at, decide)
                    continue
                if r > 0.8:
                    continue  # chủ không trả lời đơn này
                a.status, a.updated_at = "rejected", decide + timedelta(minutes=rng.randint(1, 30))
            verdict = "đã được nhận" if a.status == "accepted" else "không được nhận"
            note(s["user"].id, "application_status", f"Đơn ứng tuyển “{j.title}” {verdict}", a.id, a.updated_at)
        # Tuyển đủ thì đóng tin; việc đã qua thì phần lớn chủ đóng, số còn lại quên đóng
        if j.time_end < NOW:
            j.status = "closed" if rng.random() < (0.75 if accepted else 0.5) else "open"
        elif accepted >= t["heads"] and rng.random() < 0.6:
            j.status = "closed"

    # ---------- Đánh giá 2 chiều sau khi xong việc ----------
    def rate(a, rater, ratee, side, quality, created):
        score = rng.choice(SCORES[quality])
        comment = rng.choice(COMMENTS[side][score]) if score <= 3 or rng.random() < 0.7 else None
        ratings[(a.id, rater.id)] = Rating(id=uuid.uuid4(), application_id=a.id, rater_id=rater.id, ratee_id=ratee.id,
                                           score=score, comment=comment, created_at=created)

    for a in apps:
        j, s = app_meta[a.id]
        e = meta[j.id][0]
        if a.status != "accepted" or j.time_end >= NOW:
            continue
        if rng.random() < 0.75:
            when = between(j.time_end + timedelta(minutes=30), min(j.time_end + timedelta(days=3), NOW))
            if when:
                rate(a, e["user"], s["user"], "employer", s["quality"], when)
        if rng.random() < 0.6:
            when = between(j.time_end + timedelta(minutes=30),
                           min(j.time_end + timedelta(days=4), NOW, s["until"] or NOW))
            if when:
                rate(a, s["user"], e["user"], "seeker", e["quality"], when)

    # ---------- Kịch bản báo cáo ----------
    def report(reporter, reported, reason, created, status=None, resolved_at=None):
        r = Report(id=uuid.uuid4(), reporter_id=reporter.id, reported_id=reported.id, reason=reason,
                   status=status or "pending", created_at=created, resolved_at=resolved_at)
        reports.append(r)
        if status:
            outcome = "tài khoản này đã bị khoá" if status == "resolved" else "chưa đủ căn cứ để khoá tài khoản"
            note(reporter.id, "report_resolved", f"Báo cáo của bạn về {reported.email} đã được xử lý: {outcome}", r.id,
                 resolved_at)
        return r

    def set_rating(a, rater, ratee, score, comment, created):
        ratings[(a.id, rater.id)] = Rating(id=uuid.uuid4(), application_id=a.id, rater_id=rater.id, ratee_id=ratee.id,
                                           score=score, comment=comment, created_at=created)

    def accepted_of(pred):
        return sorted((a for a in apps if a.status == "accepted" and pred(*app_meta[a.id])),
                      key=lambda a: app_meta[a.id][0].time_end)

    # 1) Tài khoản lừa đảo: 2 người báo cáo → admin gỡ hết tin và khoá
    spam = emp["vieclam.online247"]
    spam_apps = sorted((a for a in apps if meta[app_meta[a.id][0].id][0] is spam), key=lambda a: a.created_at)
    victims = list(dict.fromkeys(app_meta[a.id][1]["user"] for a in spam_apps))[:2]
    victims += [s["user"] for s in seek.values() if QUAN in s["skills"] and s["city"] == HN][: 2 - len(victims)]
    first = spam_apps[0].created_at if spam_apps else spam["user"].created_at
    r1 = between(first + timedelta(hours=1), spam["until"] - timedelta(hours=8))
    r2 = between(r1 + timedelta(hours=1), spam["until"] - timedelta(hours=1))
    report(victims[0], spam["user"], "Tin đăng bắt đặt cọc 200k qua chuyển khoản mới giao việc, mình gọi hỏi thì bảo "
           "cọc xong mới gửi địa chỉ. Nghi lừa đảo, mọi người cẩn thận.", r1, "resolved", spam["until"])
    report(victims[1], spam["user"], "Nhắn Zalo theo tin thì bị đòi chuyển 200k tiền 'nguyên liệu'. Đây là lừa đảo, "
           "đề nghị admin xử lý.", r2, "resolved", spam["until"])
    for j in jobs:
        if meta[j.id][0] is spam:
            j.status = "rejected"
            note(spam["user"].id, "job_status", f"Tin “{j.title}” đã bị quản trị viên gỡ. Lý do: Yêu cầu đặt cọc trước "
                 "khi nhận việc, có dấu hiệu lừa đảo", j.id, spam["until"] - timedelta(minutes=5))
    spam["user"].is_blocked = True

    # 2) Người nhận việc rồi bùng 2 lần: lần 1 admin bỏ qua, lần 2 khoá
    viet = seek["hoangviet.sv"]
    flaky = accepted_of(lambda j, s: s is viet and j.time_end < viet["until"] - timedelta(hours=4))[-2:]
    for i, a in enumerate(flaky):
        j = app_meta[a.id][0]
        boss = meta[j.id][0]["user"]
        ratings.pop((a.id, viet["user"].id), None)  # không đến thì không chấm chủ
        set_rating(a, boss, viet["user"], 1, "Nhận việc rồi không đến, gọi không nghe máy.", j.time_end +
                   timedelta(hours=1))
        created = j.time_end + timedelta(hours=2)
        if i == len(flaky) - 1:
            report(boss, viet["user"], "Lần thứ 2 bạn này nhận việc rồi bỏ không đến, cũng không báo trước. Đề nghị "
                   "khoá để người khác không bị như mình.", created, "resolved", viet["until"])
        else:
            report(boss, viet["user"], "Bạn này nhận ca rồi nhưng không đến, gọi 3 cuộc không nghe, nhắn tin không trả "
                   "lời. Hôm đó thiếu người làm.", created, "dismissed", created + timedelta(hours=20))
    viet["user"].is_blocked = bool(flaky)

    # 3) Tranh chấp tiền công với chủ "stingy": admin bỏ qua
    party = emp["dichvutiec.thanhnam"]
    paid_less = accepted_of(lambda j, s: meta[j.id][0] is party and s["quality"] == "good" and s is not viet
                            and j.time_end < NOW - timedelta(days=10))
    if paid_less:
        a = paid_less[len(paid_less) // 2]
        j, s = app_meta[a.id]
        set_rating(a, s["user"], party["user"], 2, COMMENTS["seeker"][2][0], j.time_end + timedelta(hours=3))
        report(s["user"], party["user"], f"Tin ghi {j.salary // 1000}k/buổi nhưng làm xong chỉ trả "
               f"{j.salary // 1000 - 50}k, bảo trừ 50k vì về sớm 15 phút trong khi quản lý cho về. Mong admin nhắc "
               "nhở.", j.time_end + timedelta(hours=11), "dismissed", j.time_end + timedelta(days=1, hours=9))

    # 4) Hai báo cáo mới đang chờ admin
    recent = lambda j: NOW - timedelta(days=7) < j.time_end < NOW - timedelta(hours=8)  # noqa: E731
    late = accepted_of(lambda j, s: recent(j) and s["quality"] == "meh")
    if late:
        a = late[-1]
        j, s = app_meta[a.id]
        boss = meta[j.id][0]["user"]
        set_rating(a, boss, s["user"], 2, COMMENTS["employer"][2][0], j.time_end + timedelta(hours=1))
        report(boss, s["user"], "Đến muộn gần 1 tiếng, làm được nửa buổi thì xin về sớm, nhắn tin không trả lời.",
               j.time_end + timedelta(hours=2))
    rude = accepted_of(lambda j, s: recent(j) and meta[j.id][0]["quality"] in ("strict", "good")
                       and s["quality"] == "good")
    if rude:
        a = max(rude, key=lambda a: meta[app_meta[a.id][0].id][0]["quality"] == "strict")  # ưu tiên chủ khó tính
        j, s = app_meta[a.id]
        boss = meta[j.id][0]["user"]
        set_rating(a, s["user"], boss, 3, COMMENTS["seeker"][3][1], j.time_end + timedelta(hours=2))
        report(s["user"], boss, "Chủ bắt làm thêm việc ngoài tin đăng, em nói không kịp giờ thì to tiếng và trừ 50k "
               "tiền công.", j.time_end + timedelta(hours=3))

    # ---------- Lịch rảnh: 10 ngày qua tới 2 tuần tới; vài người lâu không cập nhật ----------
    for s in seek.values():
        if s["user"].is_blocked or not s["pattern"]:
            continue
        horizon = 14 if rng.random() < 0.75 else rng.randint(0, 4)
        for d in range(-10, horizon + 1):
            if rng.random() < 0.1:
                continue  # hôm đó bận
            for days, a, b in s["pattern"]:
                if day(d).weekday() in days:
                    intervals.append(AvailabilityInterval(job_seeker_id=s["user"].id, start_time=at(day(d), a),
                                                          end_time=at(day(d), b)))

    return users, jobs, apps, list(ratings.values()), reports, notes, intervals, app_meta


def check(users, jobs, apps, ratings, reports, notes, app_meta):
    """Bất biến nghiệp vụ — sai là dừng trước khi ghi DB."""
    by_id = {u.id: u for u in users}
    for j in jobs:
        assert by_id[j.employer_id].created_at <= j.created_at <= NOW and j.created_at < j.time_start, j.title
    busy = {}
    for a in apps:
        j, _ = app_meta[a.id]
        assert j.created_at <= a.created_at < j.time_start and a.created_at <= NOW, j.title
        assert by_id[a.job_seeker_id].created_at <= a.created_at <= a.updated_at <= NOW
        if a.status == "accepted":
            busy.setdefault(a.job_seeker_id, []).append((j.time_start, j.time_end))
    for spans in busy.values():
        spans.sort()
        assert all(e0 <= s1 for (_, e0), (s1, _) in zip(spans, spans[1:])), "nhận 2 việc trùng giờ"
    apps_by_id = {a.id: a for a in apps}
    for r in ratings:
        a = apps_by_id[r.application_id]
        assert a.status == "accepted" and app_meta[a.id][0].time_end < r.created_at <= NOW
    for r in reports:
        assert r.resolved_at is None or r.created_at < r.resolved_at <= NOW
    assert all(n.created_at <= NOW for n in notes)
    assert len({(a.job_id, a.job_seeker_id) for a in apps}) == len(apps), "1 người nộp 2 đơn cho 1 tin"


def main():
    users, jobs, apps, ratings, reports, notes, intervals, app_meta = build()
    check(users, jobs, apps, ratings, reports, notes, app_meta)
    password_hash = hash_secret(PASSWORD)
    for u in users:
        u.password_hash = password_hash
    summary = (  # tính trước commit: commit xong các object bị expire
        f"{sum(u.role == 'job_seeker' for u in users)} người tìm việc, {sum(u.role == 'employer' for u in users)} "
        f"người giao việc ({sum(bool(u.is_blocked) for u in users)} bị khoá)\n"
        f"{len(jobs)} tin ({sum(j.status == 'open' and j.time_end > NOW for j in jobs)} đang mở sắp tới), "
        f"{len(apps)} đơn {dict(Counter(a.status for a in apps))}\n"
        f"{len(ratings)} đánh giá, {len(reports)} báo cáo ({sum(r.status == 'pending' for r in reports)} chờ xử lý), "
        f"{len(notes)} thông báo, {len(intervals)} khoảng rảnh")
    with SessionLocal() as db:
        wipe(db, select(User.id).where(User.email.like(f"%{DOMAIN}")))
        for batch in (users, jobs, apps, ratings, reports, notes, intervals):
            db.add_all(batch)
            db.flush()
        db.commit()
    print(summary)


if __name__ == "__main__":
    main()
