"""
Скрипт заполнения базы данных тестовыми данными.
Создаёт ~1 000 заказов + все связанные сущности.

Запуск: python seed_db.py
"""

import random
import sys
import time
from datetime import date, datetime, timedelta
from datetime import time as t

try:
    from faker import Faker
except ImportError:
    print("Ошибка: установите faker:  pip install faker")
    sys.exit(1)

from app import app
from extensions import db
from models import (
    AdminSchedule,
    Box,
    BoxSchedule,
    Car,
    Client,
    Employee,
    Order,
    OrderService,
    Position,
    Service,
    ServicePriceHistory,
    Settings,
    User,
)

fake = Faker("ru_RU")
random.seed(42)

# ── справочники ──────────────────────────────────────────────────────────────

CAR_BRANDS = {
    "Toyota": ["Camry", "Corolla", "RAV4", "Land Cruiser", "Hilux"],
    "Lada": ["Vesta", "Granta", "Niva", "Largus", "Priora"],
    "Kia": ["Rio", "Optima", "Sportage", "Sorento", "Cerato"],
    "Hyundai": ["Solaris", "Creta", "Tucson", "Santa Fe", "Elantra"],
    "Volkswagen": ["Polo", "Tiguan", "Touareg", "Golf", "Passat"],
    "Ford": ["Focus", "Mondeo", "Kuga", "Explorer", "Fiesta"],
    "Nissan": ["Qashqai", "X-Trail", "Almera", "Murano", "Juke"],
    "BMW": ["X5", "X3", "3 Series", "5 Series", "7 Series"],
    "Mercedes-Benz": ["E-Class", "C-Class", "GLE", "GLC", "S-Class"],
    "Audi": ["A4", "A6", "Q5", "Q7", "A3"],
    "Renault": ["Duster", "Logan", "Sandero", "Kaptur", "Arkana"],
    "Skoda": ["Octavia", "Rapid", "Kodiaq", "Superb", "Karoq"],
    "Mazda": ["CX-5", "Mazda3", "Mazda6", "CX-9"],
    "Honda": ["CR-V", "Civic", "Accord", "Pilot"],
}
COLORS = ["белый", "чёрный", "серебристый", "серый", "синий", "красный", "бежевый"]
PLATE_LETTERS = "АВЕКМНОРСТУХ"
REGIONS = ["77", "99", "177", "199", "197", "750"]

WORK_START = 10  # 10:00
WORK_END = 22  # 22:00

# ── генераторы уникальных значений ───────────────────────────────────────────


def unique_phone(used: set) -> str:
    while True:
        p = f"7{random.randint(9_000_000_000, 9_999_999_999)}"
        if p not in used:
            used.add(p)
            return p


def unique_plate(used: set) -> str:
    while True:
        p = (
            f"{random.choice(PLATE_LETTERS)}"
            f"{random.randint(1, 999):03d}"
            f"{random.choice(PLATE_LETTERS)}"
            f"{random.choice(PLATE_LETTERS)}"
            f"{random.choice(REGIONS)}"
        )
        if p not in used:
            used.add(p)
            return p


# ── проверка конфликтов заказов ───────────────────────────────────────────────


def slot_free(occupied: dict, box_id: int, start: datetime, end: datetime) -> bool:
    """True если интервал [start, end) не пересекается ни с одним заказом в боксе."""
    key = (box_id, start.date())
    for s, e in occupied.get(key, []):
        if not (end <= s or start >= e):
            return False
    return True


def mark_slot(occupied: dict, box_id: int, start: datetime, end: datetime):
    key = (box_id, start.date())
    occupied.setdefault(key, []).append((start, end))


# ── основная функция ──────────────────────────────────────────────────────────


def seed():
    ts = time.time()

    answer = input("Очистить существующие данные? (y/n): ").strip().lower()
    if answer == "y":
        print("Очистка...")
        for model in [
            OrderService,
            Order,
            BoxSchedule,
            AdminSchedule,
            ServicePriceHistory,
            Employee,
            Position,
            Car,
            Client,
            Service,
            Box,
            User,
            Settings,
        ]:
            model.query.delete()
        db.session.commit()
        print("  ✓ база очищена")

    print("\nГенерация данных...")
    counts = {}

    # ── 1. SETTINGS ───────────────────────────────────────────────────────────
    settings_data = [
        ("car_wash_name", "АвтоСияние"),
        ("car_wash_address", "г. Москва, ул. Примерная, 42"),
        ("car_wash_phone", "74951234567"),
        ("work_start", "10:00"),
        ("work_end", "22:00"),
        ("currency", "₽"),
    ]
    for key, val in settings_data:
        db.session.add(Settings(key=key, value=val))
    db.session.flush()
    counts["Settings"] = len(settings_data)

    # ── 2. BOXES ──────────────────────────────────────────────────────────────
    boxes = []
    for i in range(1, 5):  # 4 бокса
        b = Box(name=f"Бокс {i}", is_active=True, order_index=i - 1)
        boxes.append(b)
    db.session.add_all(boxes)
    db.session.flush()
    counts["Box"] = len(boxes)

    # ── 3. POSITIONS ──────────────────────────────────────────────────────────
    pos_washer = Position(name="Мойщик", salary=300, can_manage_system=False)
    pos_senior = Position(name="Старший мойщик", salary=450, can_manage_system=False)
    pos_admin = Position(name="Администратор", salary=500, can_manage_system=True)
    db.session.add_all([pos_washer, pos_senior, pos_admin])
    db.session.flush()
    counts["Position"] = 3

    # ── 4. EMPLOYEES ──────────────────────────────────────────────────────────
    used_phones: set = set()
    employees = []
    now = datetime.now()

    # 3 администратора (can_manage_system=True → могут получить учётку)
    admin_employees = []
    ADMIN_NAMES = [
        ("Иван", "Петров", "Сергеевич"),
        ("Мария", "Сидорова", "Александровна"),
        ("Алексей", "Козлов", "Владимирович"),
    ]
    for fn, ln, mn in ADMIN_NAMES:
        emp = Employee(
            first_name=fn,
            last_name=ln,
            middle_name=mn,
            phone=unique_phone(used_phones),
            position_id=pos_admin.id,
            salary_type="fixed",
            status="active",
        )
        admin_employees.append(emp)
        employees.append(emp)

    # 12 рядовых мойщиков
    for i in range(12):
        pos = random.choice([pos_washer, pos_senior])
        if i < 10:
            status, sick_s, sick_e, fired = "active", None, None, None
        elif i < 11:
            sick_s = (now - timedelta(days=5)).date()
            sick_e = (now + timedelta(days=9)).date()
            status, fired = "sick_leave", None
        else:
            status = "fired"
            sick_s = sick_e = None
            fired = fake.date_between(start_date="-1y", end_date="-30d")

        emp = Employee(
            first_name=fake.first_name(),
            last_name=fake.last_name(),
            middle_name=fake.middle_name() if random.random() < 0.8 else None,
            phone=unique_phone(used_phones),
            position_id=pos.id,
            salary_type=random.choices(["fixed", "piecework"], weights=[7, 3])[0],
            status=status,
            sick_leave_start=sick_s,
            sick_leave_end=sick_e,
            fired_date=fired,
        )
        employees.append(emp)

    db.session.add_all(employees)
    db.session.flush()
    counts["Employee"] = len(employees)

    # ── 5. USERS (владелец + 3 администратора) ────────────────────────────────
    owner = User(
        login="owner",
        full_name="Владелец Системы",
        role="owner",
        is_active=True,
        employee_id=None,
        can_view_statistics=True,
        can_view_admin_schedule=True,
        can_view_positions=True,
        can_view_employees=True,
        can_create_employees=True,
        can_edit_employees=True,
        can_fire_employees=True,
        can_edit_services=True,
        can_view_services=True,
        can_create_services=True,
        can_delete_services=True,
        can_create_positions=True,
        can_edit_positions=True,
        can_delete_positions=True,
        can_export_orders=True,
        can_view_box_schedule=True,
        can_edit_box_schedule=True,
        can_edit_admin_schedule=True,
    )
    owner.set_password("owner123")
    db.session.add(owner)

    admin_users = []
    admin_creds = [
        ("admin1", "admin123", admin_employees[0]),
        ("admin2", "admin123", admin_employees[1]),
        ("admin3", "admin123", admin_employees[2]),
    ]
    for login, pwd, emp in admin_creds:
        u = User(
            login=login,
            full_name=f"{emp.last_name} {emp.first_name} {emp.middle_name or ''}".strip(),
            role="admin",
            is_active=True,
            employee_id=emp.id,
            can_view_statistics=True,
            can_view_admin_schedule=True,
            can_view_box_schedule=True,
            can_edit_box_schedule=True,
            can_view_employees=True,
            can_view_positions=True,
            can_export_orders=False,
            # остальные права — False по умолчанию
        )
        u.set_password(pwd)
        admin_users.append(u)

    db.session.add_all(admin_users)
    db.session.flush()
    counts["User"] = 1 + len(admin_users)

    # ── 6. ADMIN SCHEDULES (смены на ближайшие 30 дней) ──────────────────────
    admin_scheds = []
    for u in admin_users:
        current_day = now.date()
        for _ in range(30):
            # каждый день кто-то из трёх дежурит (без пересечений в один день)
            # просто каждому назначим по 10 дней
            if random.random() < 0.33:
                s_hour = random.choice([9, 10])
                e_hour = random.choice([18, 19, 20, 21, 22])
                admin_scheds.append(
                    AdminSchedule(
                        user_id=u.id,
                        date=current_day,
                        start_time=t(s_hour, 0),
                        end_time=t(e_hour, 0),
                    )
                )
            current_day += timedelta(days=1)

    db.session.add_all(admin_scheds)
    db.session.flush()
    counts["AdminSchedule"] = len(admin_scheds)

    # ── 7. SERVICES ──────────────────────────────────────────────────────────
    services_raw = [
        ("Экспресс-мойка", 500, 30, 30.0),
        ("Стандартная мойка", 800, 60, 35.0),
        ("Мойка с пылесосом", 1100, 75, 35.0),
        ("Химчистка салона", 2500, 120, 40.0),
        ("Полировка кузова", 5000, 180, 45.0),
        ("Нанесение воска", 1500, 90, 35.0),
        ("Детейлинг полный", 12000, 360, 50.0),
        ("Мойка двигателя", 2000, 120, 40.0),
    ]
    services = []
    for name, price, dur, pct in services_raw:
        s = Service(
            name=name, price=price, duration=dur, washer_percentage=pct, is_active=True
        )
        services.append(s)
    db.session.add_all(services)
    db.session.flush()
    counts["Service"] = len(services)

    # ── 8. CLIENTS ────────────────────────────────────────────────────────────
    clients = []
    two_years_ago = now - timedelta(days=730)
    for _ in range(250):
        c = Client(
            first_name=fake.first_name(),
            last_name=fake.last_name(),
            middle_name=fake.middle_name() if random.random() < 0.7 else None,
            phone=unique_phone(used_phones),
            email=fake.email() if random.random() < 0.55 else None,
            is_active=True,
            created_at=fake.date_time_between(start_date=two_years_ago, end_date=now),
        )
        clients.append(c)
    db.session.add_all(clients)
    db.session.flush()
    counts["Client"] = len(clients)

    # ── 9. CARS ───────────────────────────────────────────────────────────────
    used_plates: set = set()
    cars = []
    for _ in range(350):
        brand = random.choice(list(CAR_BRANDS.keys()))
        car = Car(
            license_plate=unique_plate(used_plates),
            brand=brand,
            model=random.choice(CAR_BRANDS[brand]),
            color=random.choice(COLORS),
            is_active=True,
            created_at=fake.date_time_between(start_date=two_years_ago, end_date=now),
        )
        cars.append(car)
    db.session.add_all(cars)
    db.session.flush()
    counts["Car"] = len(cars)

    # ── 10. BOX SCHEDULES ─────────────────────────────────────────────────────
    active_workers = [
        e for e in employees if e.status != "fired" and e.position_id != pos_admin.id
    ]
    box_scheds = []
    sched_start = (now - timedelta(days=180)).date()
    sched_end = (now + timedelta(days=30)).date()
    cur = sched_start

    while cur <= sched_end:
        workers_today = [
            e
            for e in active_workers
            if not (
                e.status == "sick_leave"
                and e.sick_leave_start
                and e.sick_leave_end
                and e.sick_leave_start <= cur <= e.sick_leave_end
            )
        ]
        random.shuffle(workers_today)
        assigned = set()
        for box in boxes:
            candidates = [e for e in workers_today if e.id not in assigned]
            if not candidates:
                break
            emp = random.choice(candidates)
            assigned.add(emp.id)
            box_scheds.append(
                BoxSchedule(
                    box_id=box.id,
                    employee_id=emp.id,
                    date=cur,
                    start_time=t(WORK_START, 0),
                    end_time=t(WORK_END, 0),
                )
            )

        if len(box_scheds) >= 4000:
            db.session.add_all(box_scheds)
            db.session.flush()
            box_scheds = []
        cur += timedelta(days=1)

    if box_scheds:
        db.session.add_all(box_scheds)
        db.session.flush()
    counts["BoxSchedule"] = BoxSchedule.query.count()

    # ── 11. ORDERS (1 000 штук, без конфликтов) ───────────────────────────────
    print("  Генерация заказов (1 000 шт.)...")
    TARGET = 1000
    occupied: dict = {}  # (box_id, date) → [(start, end), ...]
    order_objs = []
    os_data = []  # (order_obj, [service_id, ...])
    attempts = 0
    created = 0

    # 900 прошлых, 100 будущих
    PAST_N = 900
    FUTURE_N = 100

    def make_order(future: bool):
        nonlocal attempts
        for _ in range(50):  # не более 50 попыток на один заказ
            attempts += 1
            if future:
                day = now.date() + timedelta(days=random.randint(1, 30))
            else:
                day = now.date() - timedelta(days=random.randint(0, 180))

            # выбираем 1-2 услуги (крупные услуги — реже)
            svc_count = random.choices([1, 2, 3], weights=[6, 3, 1])[0]
            chosen_svcs = random.sample(services, k=svc_count)
            duration = sum(s.duration for s in chosen_svcs)
            price = sum(s.price for s in chosen_svcs)

            # случайный слот кратный 15 минутам
            max_start = (WORK_END - WORK_START) * 60 - duration
            if max_start <= 0:
                chosen_svcs = [services[0]]
                duration = services[0].duration
                price = services[0].price
                max_start = (WORK_END - WORK_START) * 60 - duration

            offset = random.randint(0, max_start // 15) * 15
            start_dt = datetime.combine(day, t(WORK_START, 0)) + timedelta(
                minutes=offset
            )
            end_dt = start_dt + timedelta(minutes=duration)

            box = random.choice(boxes)
            if not slot_free(occupied, box.id, start_dt, end_dt):
                continue  # конфликт — пробуем ещё раз

            mark_slot(occupied, box.id, start_dt, end_dt)

            # статус
            if future:
                status = "pending"
                completed_at = None
                is_paid = False
            else:
                if start_dt < now - timedelta(days=1):
                    status = "completed" if random.random() < 0.92 else "cancelled"
                else:
                    r = random.random()
                    status = (
                        "completed"
                        if r < 0.7
                        else ("in_progress" if r < 0.85 else "pending")
                    )
                completed_at = end_dt if status == "completed" else None
                is_paid = status == "completed" and random.random() < 0.88

            created_offset = timedelta(
                days=random.randint(1, 7), hours=random.randint(0, 23)
            )
            notes = fake.sentence(nb_words=6) if random.random() < 0.25 else None

            o = Order(
                client_id=random.choice(clients).id,
                car_id=random.choice(cars).id,
                box_id=box.id,
                employee_id=None,
                status=status,
                scheduled_time=start_dt,
                completed_time=completed_at,
                total_price=price,
                total_duration=duration,
                is_paid=is_paid,
                notes=notes,
                created_at=start_dt - created_offset,
            )
            order_objs.append(o)
            os_data.append((o, [s.id for s in chosen_svcs]))
            return True
        return False  # не удалось разместить

    for i in range(PAST_N):
        make_order(future=False)
    for i in range(FUTURE_N):
        make_order(future=True)

    # сохраняем батчами по 200
    for batch_start in range(0, len(order_objs), 200):
        batch = order_objs[batch_start : batch_start + 200]
        db.session.add_all(batch)
        db.session.flush()

        svc_rows = []
        for o, sids in os_data[batch_start : batch_start + 200]:
            for sid in sids:
                svc = Service.query.get(sid)
                svc_rows.append(
                    OrderService(
                        order_id=o.id,
                        service_id=sid,
                        service_price=svc.price,
                        washer_percentage=svc.washer_percentage,
                    )
                )
        db.session.add_all(svc_rows)
        db.session.commit()
        print(
            f"    сохранено заказов: {min(batch_start + 200, len(order_objs))} / {len(order_objs)}"
        )

    counts["Order"] = len(order_objs)
    counts["OrderService"] = OrderService.query.count()

    # ── итог ──────────────────────────────────────────────────────────────────
    elapsed = round(time.time() - ts, 1)
    print(f"\n✅ Готово за {elapsed} сек.  Попыток размещения заказов: {attempts}\n")
    print("Создано записей:")
    for k, v in counts.items():
        print(f"  {k:<18} {v}")

    print("\nУчётные записи:")
    print("  Владелец  —  login: owner    пароль: owner123")
    print("  Админ 1   —  login: admin1   пароль: admin123")
    print("  Админ 2   —  login: admin2   пароль: admin123")
    print("  Админ 3   —  login: admin3   пароль: admin123")


if __name__ == "__main__":
    with app.app_context():
        seed()
