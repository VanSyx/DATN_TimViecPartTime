"""Dữ liệu mẫu mô phỏng người dùng thật để thử tay các chức năng.

Chạy: docker compose exec backend python seed.py
Chạy lại bao nhiêu lần cũng được: chỉ xóa rồi tạo lại đúng các tài khoản @example.com dưới đây.
Mật khẩu mọi tài khoản: matkhau123. Thời gian tính theo ngày chạy script (giờ Việt Nam).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, or_, select

from app.db import SessionLocal
from app.models import Application, AvailabilityInterval, Job, User
from app.security import hash_secret

PASSWORD = "matkhau123"
VN = timezone(timedelta(hours=7))
TODAY = datetime.now(VN).replace(hour=0, minute=0, second=0, microsecond=0)
T2, T3, T4, T5, T6, T7, CN = range(7)


def next_day(weekday: int) -> datetime:
    """Ngày gần nhất (từ ngày mai trở đi) rơi vào thứ `weekday`."""
    return TODAY + timedelta(days=(weekday - TODAY.weekday() - 1) % 7 + 1)


def at(day: datetime, hhmm: str) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return day.replace(hour=h, minute=m)


def week(days: set[int], start: str, end: str) -> list[tuple[datetime, datetime]]:
    """Lặp 1 khung giờ cho các thứ trong 7 ngày tới — đúng cách người ta khai "chiều T2-T6"."""
    out = []
    for i in range(1, 8):
        d = TODAY + timedelta(days=i)
        if d.weekday() in days:
            out.append((at(d, start), at(d, end)))
    return out


WEEKDAYS, WEEKEND, EVERYDAY = {T2, T3, T4, T5, T6}, {T7, CN}, set(range(7))

# ---------- Người tìm việc ----------
# (key, email, phone, email_verified, mô tả, lịch rảnh, ghi chú cho người test)
SEEKERS = [
    ("lan", "lan.nguyen@example.com", "0912345678", True,
     "Em là sv năm 2 NEU, ở trọ gần Bạch Mai. Em rảnh các buổi chiều trong tuần với cả ngày cuối tuần. "
     "Em làm được dọn dẹp nhà, rửa bát, giặt ủi, trông em nhỏ cũng được ạ (nhà em có 2 đứa em nên quen rồi).",
     week(WEEKDAYS, "13:30", "17:30") + week(WEEKEND, "07:00", "20:00")
     + [(at(next_day(T7), "08:00"), at(next_day(T7), "10:00"))],  # lỡ tay khai trùng
     "Sinh viên, Hai Bà Trưng (~21.004, 105.850). Có 1 khoảng rảnh khai trùng."),
    ("hung", "hung.tran@example.com", "0987111222", True,
     "Chạy xe ôm công nghệ là chính, sáng sớm 5h30 tới 10h thì rảnh. Nhận phụ quán, bưng bê, rửa ly, "
     "khuân vác nhẹ. Nhà ở Cầu Giấy nên ưu tiên việc gần.",
     week(EVERYDAY, "05:30", "10:00"),
     "Tài xế, Cầu Giấy (~21.034, 105.790). Chỉ rảnh sáng sớm."),
    ("hoa", "hoa.le@example.com", "0904555666", True,
     "Cô 52 tuổi, nghỉ hưu. Cô nấu ăn món Bắc ngon, từng chăm bà nội 3 năm nên quen chăm người già. "
     "Cô không làm buổi tối, không đi xa quá 5 cây số.",
     week(WEEKDAYS, "08:00", "14:00"),
     "Nghỉ hưu, Đống Đa (~21.020, 105.826). Chỉ tìm việc gần."),
    ("trang", "trang.pham@example.com", "0935777888", True,
     "Mình làm văn phòng giờ hành chính, tối từ 18h30 với cả ngày chủ nhật thì rảnh. Kèm bé học bài, "
     "trông trẻ, dạy tiếng Anh giao tiếp cơ bản cho bé được. Có xe máy.",
     week(WEEKDAYS, "18:30", "22:00") + week({CN}, "08:00", "21:00"),
     "Dân văn phòng, Thanh Xuân (~20.995, 105.808). Rảnh tối."),
    ("tuananh", "tuananh.vu@example.com", None, False,
     "don nha, khuan do, sua dien nuoc co ban. lam dc cuoi tuan",
     week(WEEKEND, "07:00", "18:00"),
     "SV Bách Khoa gõ KHÔNG DẤU, chưa xác minh email, không có SĐT."),
    ("nam", "nam.do@example.com", "0977333444", True,
     "Chào mọi người, mình tên Nam, 24 tuổi, quê Nam Định, đang ở trọ Hai Bà Trưng. Hiện mình đang thất "
     "nghiệp nên cần việc gấp, việc gì cũng làm được: dọn nhà, rửa bát, phụ quán, bốc vác, trông xe, giao "
     "hàng... Mình chăm chỉ, thật thà, không ngại việc nặng. Ai cần liên hệ mình nha, cảm ơn nhiều!!!",
     week(EVERYDAY, "07:00", "21:00"),
     "Cần việc gấp, mô tả dài lan man, nộp đơn nhiều nơi."),
    ("vy", "vy.huynh@example.com", "0909888999", True,
     "Dọn dẹp nhà cửa, ủi đồ, nấu ăn đơn giản. Rảnh cuối tuần.",
     week(WEEKEND, "08:00", "18:00"),
     "TP.HCM, Bình Thạnh (~10.801, 106.711)."),
    ("duc", "duc.ngo@example.com", "0905123123", True,
     "Sinh viên ĐH Đà Nẵng, IELTS 6.5, thích chơi với con nít. Trông trẻ, dạy kèm tiếng Anh cho bé được.",
     week(WEEKEND, "13:00", "20:00"),
     "Đà Nẵng, Hải Châu (~16.068, 108.215)."),
    ("phuong", "phuong.mai@example.com", None, False, None, [],
     "Vừa đăng ký, chưa điền mô tả, chưa khai lịch rảnh."),
]

# ---------- Chủ nhà / cơ sở ----------
EMPLOYERS = [
    ("huong", "huong.dinh@example.com", "0913000111", "Chị Hương — gia đình 3 tầng ở Ba Đình, có mèo."),
    ("tuan", "cafe.tuan@example.com", "0988000222", "Anh Tuấn — quán cafe nhỏ ở Cầu Giấy, đăng lẻ từng ca."),
    ("mai", "mai.bui@example.com", "0904000333", "Cô Mai — con gái ở xa, thuê người chăm 2 ông bà ở Đống Đa."),
    ("thao", "thao.ly@example.com", "0936000444", "Chị Thảo — căn hộ Times City vừa sửa xong."),
    ("khoa", "khoa.dang@example.com", "0903000555", "Anh Khoa — nhà ở Quận 3, TP.HCM."),
    ("ngoc", "ngoc.phan@example.com", "0905000666", "Chị Ngọc — Đà Nẵng, 2 bé nhỏ."),
    ("nhahang", "nhahang.hangbac@example.com", "0243000777", "Nhà hàng phố Hàng Bạc — tiệc cưới cuối tuần."),
    ("minh", "minh.hoang@example.com", "0916000888", "Anh Minh — Tây Hồ, hay đi công tác, quên đóng tin cũ."),
    ("ly", "ly.trinh@example.com", "0983000999", "Chị Lý — Hà Đông, xa trung tâm ~12 km."),
    ("hai", "hai.cao@example.com", None, "Anh Hải — vừa đăng ký, chưa đăng tin nào."),
]

# (key, employer, tiêu đề, mô tả, (đường, phường, thành phố), (lat, lng), ngày, giờ bắt đầu, giờ kết thúc, lương, trạng thái)
JOBS = [
    ("J1", "huong", "Dọn nhà sáng thứ 7",
     "Nhà mình 3 tầng trong ngõ Đội Cấn, cần 1 bạn dọn dẹp sáng thứ 7: lau nhà, lau cầu thang, dọn bếp, giặt "
     "và phơi đồ. Nhà có sẵn máy hút bụi với đồ lau. Nhà có nuôi mèo nên bạn nào dị ứng lông mèo thì thông cảm nha.",
     ("Ngõ 267 Đội Cấn", "Phường Ngọc Hà", "Hà Nội"), (21.0359, 105.8295), next_day(T7), "08:00", "11:00",
     270_000, "open"),
    ("J2", "huong", "Trông bé trai 5 tuổi buổi tối",
     "Vợ chồng mình đi ăn cưới, cần người trông bé từ 6h tối tới 9h30. Bé ngoan, chỉ cần cho bé ăn tối (mình "
     "nấu sẵn rồi), tắm cho bé và kể chuyện cho bé ngủ. Ưu tiên bạn nữ có kinh nghiệm trông trẻ.",
     ("Ngõ 267 Đội Cấn", "Phường Ngọc Hà", "Hà Nội"), (21.0359, 105.8295), next_day(T4), "18:00", "21:30",
     300_000, "open"),
    ("J3", "tuan", "Phụ quán cafe ca sáng",
     "Quán cafe nhỏ đường Trần Thái Tông cần người phụ ca sáng: pha chế đơn giản (cafe phin, bạc xỉu, trà đá), "
     "rửa ly, lau bàn, dọn quán. Không cần kinh nghiệm, anh chỉ 15 phút là làm được. 30k/h, làm ổn thì nhận dài.",
     ("45 Trần Thái Tông", "Phường Cầu Giấy", "Hà Nội"), (21.0336, 105.7897), next_day(T3), "06:00", "10:00",
     120_000, "open"),
    ("J4", "tuan", "Phụ quán cafe ca sáng thứ 5",
     "Như ca thứ 3: pha chế đơn giản, rửa ly, lau bàn. Sáng thứ 5 quán đông khách văn phòng hơn nên cần nhanh tay.",
     ("45 Trần Thái Tông", "Phường Cầu Giấy", "Hà Nội"), (21.0336, 105.7897), next_day(T5), "06:00", "10:00",
     120_000, "open"),
    ("J5", "mai", "Đi chợ, nấu cơm trưa, chăm bà",
     "Cần người đi chợ, nấu cơm trưa cho 2 ông bà (ăn nhạt, ít dầu mỡ vì bà bị tiểu đường), sau đó dọn rửa và "
     "ngồi nói chuyện với bà một lúc. Bà đi lại chậm, cần người đỡ đi vệ sinh. Ưu tiên cô/chị lớn tuổi có kinh "
     "nghiệm chăm người già.",
     ("Ngõ 72 Tôn Đức Thắng", "Phường Văn Miếu - Quốc Tử Giám", "Hà Nội"), (21.0247, 105.8317), next_day(T2),
     "09:30", "13:30", 280_000, "open"),
    ("J6", "mai", "Nấu cơm trưa cho ông bà (thứ 5)",
     "Giống thứ 2: đi chợ, nấu cơm trưa món Bắc, ăn nhạt. Dọn rửa xong thì về, không cần ở lại.",
     ("Ngõ 72 Tôn Đức Thắng", "Phường Văn Miếu - Quốc Tử Giám", "Hà Nội"), (21.0247, 105.8317), next_day(T5),
     "10:00", "13:00", 220_000, "open"),
    ("J7", "thao", "Tổng vệ sinh căn hộ sau sửa chữa",
     "Căn hộ 2PN 75m2 vừa sơn lại, bụi xi măng với vết sơn nhiều. Cần 1-2 người tổng vệ sinh: lau kính, cạo vết "
     "sơn, lau sàn, vệ sinh nhà tắm. Mình cấp đồ, bạn có dụng cụ riêng thì càng tốt. Làm nhanh gọn mình bo thêm.",
     ("Times City, 458 Minh Khai", "Phường Vĩnh Tuy", "Hà Nội"), (20.9953, 105.8686), next_day(CN), "07:30",
     "12:30", 550_000, "open"),
    ("J8", "khoa", "Dọn dẹp + ủi đồ công sở",
     "Nhà 1 trệt 1 lầu, cần dọn dẹp, lau nhà và ủi khoảng 15 bộ đồ công sở. Hẻm xe máy vào được, gửi xe free.",
     ("Hẻm 102 Võ Văn Tần", "Phường Xuân Hòa", "TP. Hồ Chí Minh"), (10.7769, 106.6880), next_day(T7), "14:00",
     "17:00", 240_000, "open"),
    ("J9", "ngoc", "Trông 2 bé chiều thứ 7",
     "Trông 2 bé (7 tuổi và 4 tuổi) buổi chiều, trời mát thì dẫn bé ra công viên APEC gần nhà chơi. Bạn nào biết "
     "chút tiếng Anh nói chuyện với bé thì càng tốt.",
     ("88 Phan Châu Trinh", "Phường Hải Châu", "Đà Nẵng"), (16.0670, 108.2210), next_day(T7), "13:30", "18:00",
     320_000, "open"),
    ("J10", "nhahang", "Phụ bếp, rửa bát tiệc cưới trưa CN",
     "Nhà hàng có tiệc cưới 40 mâm trưa chủ nhật, cần 3 người phụ bếp: sơ chế rau, rửa bát, bưng bê dọn mâm. "
     "Bao cơm trưa. Mặc áo tối màu, đi giày kín mũi.",
     ("32 Hàng Bạc", "Phường Hoàn Kiếm", "Hà Nội"), (21.0340, 105.8527), next_day(CN), "09:30", "15:00",
     350_000, "open"),
    ("J11", "nhahang", "Rửa bát ca tối",
     "Rửa bát ca tối 17h-22h, nhà hàng đông khách cuối tuần.",
     ("32 Hàng Bạc", "Phường Hoàn Kiếm", "Hà Nội"), (21.0340, 105.8527), TODAY - timedelta(days=5), "17:00",
     "22:00", 250_000, "closed"),
    ("J12", "minh", "Dắt chó đi dạo + tưới cây",
     "Mình đi công tác, cần người qua nhà chiều thứ 3 dắt bé Golden đi dạo 30 phút quanh hồ, cho ăn và tưới cây "
     "ngoài ban công. Chó hiền, rất quấn người.",
     ("Ngõ 31 Xuân Diệu", "Phường Tây Hồ", "Hà Nội"), (21.0620, 105.8290), next_day(T3), "17:00", "18:00",
     100_000, "open"),
    ("J13", "minh", "Tưới cây ban công",
     "Tưới cây giúp mình mấy hôm đi vắng.",
     ("Ngõ 31 Xuân Diệu", "Phường Tây Hồ", "Hà Nội"), (21.0620, 105.8290), TODAY - timedelta(days=3), "17:00",
     "17:30", 50_000, "open"),  # đã qua ngày làm nhưng chủ quên đóng tin
    ("J14", "ly", "Giặt ủi, dọn nhà sáng thứ 7",
     "Nhà mình ở khu đô thị Văn Quán, cần người giặt ủi đồ cả tuần và dọn qua nhà cửa.",
     ("Khu đô thị Văn Quán", "Phường Hà Đông", "Hà Nội"), (20.9770, 105.7870), next_day(T7), "08:00", "11:00",
     250_000, "open"),
]

# (seeker, job, trạng thái)
APPLICATIONS = [
    ("lan", "J1", "pending"),
    ("nam", "J1", "pending"),       # chị Hương có 2 người nộp để chọn
    ("lan", "J7", "accepted"),
    ("nam", "J10", "rejected"),
    ("nam", "J3", "cancelled"),     # Nam đổi ý, rút đơn
    ("hung", "J3", "accepted"),
    ("hung", "J4", "pending"),
    ("hoa", "J5", "accepted"),
    ("hoa", "J6", "pending"),
    ("trang", "J2", "pending"),
    ("tuananh", "J11", "pending"),  # nộp rồi nhà hàng đóng tin mà không trả lời
    ("vy", "J8", "pending"),
]


def main():
    emails = [s[1] for s in SEEKERS] + [e[1] for e in EMPLOYERS]
    password_hash = hash_secret(PASSWORD)
    with SessionLocal() as db:
        old = select(User.id).where(User.email.in_(emails))
        old_jobs = select(Job.id).where(Job.employer_id.in_(old))
        db.execute(delete(Application).where(
            or_(Application.job_seeker_id.in_(old), Application.job_id.in_(old_jobs))))
        db.execute(delete(AvailabilityInterval).where(AvailabilityInterval.job_seeker_id.in_(old)))
        db.execute(delete(Job).where(Job.employer_id.in_(old)))
        db.execute(delete(User).where(User.id.in_(old)))

        users = {}
        for key, email, phone, verified, description, _, _ in SEEKERS:
            users[key] = User(email=email, phone=phone, role="job_seeker", password_hash=password_hash,
                              email_verified=verified, description=description)
        for key, email, phone, _ in EMPLOYERS:
            users[key] = User(email=email, phone=phone, role="employer", password_hash=password_hash,
                              email_verified=True)
        db.add_all(users.values())
        db.flush()

        db.add_all(AvailabilityInterval(job_seeker_id=users[key].id, start_time=s, end_time=e)
                   for key, *_, intervals, _ in SEEKERS for s, e in intervals)

        jobs = {}
        for key, emp, title, desc, (street, ward, city), (lat, lng), day, start, end, salary, status in JOBS:
            jobs[key] = Job(employer_id=users[emp].id, title=title, description=desc, street=street, ward=ward,
                            city=city, lat=lat, lng=lng, time_start=at(day, start), time_end=at(day, end),
                            salary=salary, status=status)
        db.add_all(jobs.values())
        db.flush()

        db.add_all(Application(job_seeker_id=users[s].id, job_id=jobs[j].id, status=st)
                   for s, j, st in APPLICATIONS)
        db.commit()

    print(f"Đã tạo {len(SEEKERS)} người tìm việc, {len(EMPLOYERS)} chủ nhà, {len(JOBS)} tin, "
          f"{len(APPLICATIONS)} đơn. Mật khẩu chung: {PASSWORD}\n")
    for _, email, *_, note in SEEKERS:
        print(f"  [tìm việc] {email:30} {note}")
    for _, email, _, note in EMPLOYERS:
        print(f"  [chủ nhà]  {email:30} {note}")


if __name__ == "__main__":
    main()
