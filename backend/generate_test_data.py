import argparse
from datetime import datetime, time, timedelta

from app import create_app
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
    User,
)


DEMO_PREFIX = "DEMO:"
ADMIN_PASSWORD = "admin123"
OWNER_PASSWORD = "owner123"


POSITIONS = [
    {"name": "Администратор", "salary": 2600, "can_manage_system": True},
    {"name": "Старший мойщик", "salary": 2400, "can_manage_system": False},
    {"name": "Мойщик", "salary": 2100, "can_manage_system": False},
    {"name": "Детейлер", "salary": 3200, "can_manage_system": False},
]


EMPLOYEES = [
    {
        "last_name": "Смирнова",
        "first_name": "Екатерина",
        "middle_name": "Андреевна",
        "phone": "79990000001",
        "position": "Администратор",
        "salary_type": "fixed",
    },
    {
        "last_name": "Волков",
        "first_name": "Дмитрий",
        "middle_name": "Сергеевич",
        "phone": "79990000002",
        "position": "Администратор",
        "salary_type": "fixed",
    },
    {
        "last_name": "Иванов",
        "first_name": "Андрей",
        "middle_name": "Викторович",
        "phone": "79990000003",
        "position": "Старший мойщик",
        "salary_type": "piecework",
    },
    {
        "last_name": "Петров",
        "first_name": "Сергей",
        "middle_name": "Николаевич",
        "phone": "79990000004",
        "position": "Мойщик",
        "salary_type": "piecework",
    },
    {
        "last_name": "Козлова",
        "first_name": "Мария",
        "middle_name": "Игоревна",
        "phone": "79990000005",
        "position": "Детейлер",
        "salary_type": "piecework",
    },
    {
        "last_name": "Никитин",
        "first_name": "Алексей",
        "middle_name": "Павлович",
        "phone": "79990000006",
        "position": "Мойщик",
        "salary_type": "piecework",
    },
    {
        "last_name": "Федоров",
        "first_name": "Павел",
        "middle_name": "Олегович",
        "phone": "79990000007",
        "position": "Старший мойщик",
        "salary_type": "piecework",
    },
    {
        "last_name": "Орлова",
        "first_name": "Анна",
        "middle_name": "Романовна",
        "phone": "79990000008",
        "position": "Мойщик",
        "salary_type": "piecework",
    },
    {
        "last_name": "Захаров",
        "first_name": "Илья",
        "middle_name": "Максимович",
        "phone": "79990000009",
        "position": "Мойщик",
        "salary_type": "piecework",
    },
    {
        "last_name": "Лебедева",
        "first_name": "Ксения",
        "middle_name": "Денисовна",
        "phone": "79990000010",
        "position": "Детейлер",
        "salary_type": "piecework",
    },
]


ADMIN_USERS = [
    {"login": "admin_smirnova", "employee_phone": "79990000001"},
    {"login": "admin_volkov", "employee_phone": "79990000002"},
]


SERVICES = [
    {
        "name": "Бесконтактная мойка",
        "description": "Быстрая наружная мойка кузова",
        "price": 650,
        "duration": 30,
        "washer_percentage": 20,
    },
    {
        "name": "Комплексная мойка",
        "description": "Кузов, коврики, стекла и легкая уборка салона",
        "price": 1400,
        "duration": 45,
        "washer_percentage": 25,
    },
    {
        "name": "Мойка двигателя",
        "description": "Очистка моторного отсека",
        "price": 1600,
        "duration": 45,
        "washer_percentage": 25,
    },
    {
        "name": "Нанесение воска",
        "description": "Защитное покрытие после мойки",
        "price": 900,
        "duration": 30,
        "washer_percentage": 20,
    },
    {
        "name": "Детейлинг салона",
        "description": "Подробная чистка салона",
        "price": 3600,
        "duration": 120,
        "washer_percentage": 30,
    },
    {
        "name": "Полировка кузова",
        "description": "Восстановительная полировка лакокрасочного покрытия",
        "price": 5200,
        "duration": 180,
        "washer_percentage": 35,
    },
    {
        "name": "Химчистка салона",
        "description": "Глубокая химчистка сидений, пола и обшивки",
        "price": 7200,
        "duration": 240,
        "washer_percentage": 30,
    },
    {
        "name": "Чернение резины",
        "description": "Финишная обработка шин",
        "price": 350,
        "duration": 15,
        "washer_percentage": 15,
    },
]


CLIENTS_AND_CARS = [
    {
        "client": ("Иванов", "Михаил", "Сергеевич", "79991111101", "ivanov.ms@mail.ru"),
        "car": ("А123ВС196", "Toyota", "Camry", "черный"),
    },
    {
        "client": ("Петрова", "Анна", "Олеговна", "79991111102", "petrova.ao@mail.ru"),
        "car": ("В234ОР196", "Kia", "Rio", "белый"),
    },
    {
        "client": ("Сидоров", "Павел", "Игоревич", "79991111103", "sidorov.pi@mail.ru"),
        "car": ("Е345КМ196", "Hyundai", "Solaris", "серебристый"),
    },
    {
        "client": ("Кузнецова", "Елена", "Викторовна", "79991111104", "kuznetsova.ev@mail.ru"),
        "car": ("К456НТ196", "Mazda", "CX-5", "красный"),
    },
    {
        "client": ("Смирнов", "Артем", "Андреевич", "79991111105", "smirnov.aa@mail.ru"),
        "car": ("М567РА196", "Lada", "Vesta", "синий"),
    },
    {
        "client": ("Морозова", "Дарья", "Павловна", "79991111106", "morozova.dp@mail.ru"),
        "car": ("Н678СЕ196", "Volkswagen", "Polo", "серый"),
    },
    {
        "client": ("Волков", "Николай", "Дмитриевич", "79991111107", "volkov.nd@mail.ru"),
        "car": ("О789ТХ196", "Chery", "Arrizo 5 Plus", "белый"),
    },
    {
        "client": ("Федорова", "Ирина", "Александровна", "79991111108", "fedorova.ia@mail.ru"),
        "car": ("Р890УК196", "Nissan", "Qashqai", "черный"),
    },
    {
        "client": ("Орлов", "Максим", "Романович", "79991111109", "orlov.mr@mail.ru"),
        "car": ("С901ХА196", "Skoda", "Octavia", "зеленый"),
    },
    {
        "client": ("Беляева", "Наталья", "Ильинична", "79991111110", "belyaeva.ni@mail.ru"),
        "car": ("Т012ВМ196", "Renault", "Duster", "коричневый"),
    },
    {
        "client": ("Павлов", "Кирилл", "Денисович", "79991111111", "pavlov.kd@mail.ru"),
        "car": ("У123ЕН196", "Geely", "Coolray", "оранжевый"),
    },
    {
        "client": ("Соколова", "Марина", "Евгеньевна", "79991111112", "sokolova.me@mail.ru"),
        "car": ("Х234КС196", "Haval", "Jolion", "синий"),
    },
]


ORDER_TEMPLATES = [
    [(0, "10:00", ["Комплексная мойка"]), (1, "11:30", ["Бесконтактная мойка", "Чернение резины"]), (2, "13:00", ["Мойка двигателя"]), (3, "16:15", ["Комплексная мойка", "Нанесение воска"])],
    [(4, "10:30", ["Бесконтактная мойка"]), (5, "12:00", ["Детейлинг салона"]), (6, "15:00", ["Комплексная мойка"]), (7, "17:00", ["Нанесение воска", "Чернение резины"])],
    [(8, "11:00", ["Комплексная мойка", "Чернение резины"]), (9, "13:00", ["Бесконтактная мойка"]), (10, "14:30", ["Полировка кузова"]), (11, "18:00", ["Комплексная мойка"])],
    [(1, "10:15", ["Детейлинг салона"]), (3, "13:30", ["Комплексная мойка"]), (5, "15:00", ["Мойка двигателя"]), (7, "17:00", ["Бесконтактная мойка", "Нанесение воска"])],
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Создает согласованные тестовые данные для CRM автомойки."
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Запустить без вопроса подтверждения.",
    )
    parser.add_argument(
        "--days-past",
        type=int,
        default=6,
        help="Сколько прошлых дней заполнить заказами.",
    )
    parser.add_argument(
        "--days-future",
        type=int,
        default=4,
        help="Сколько будущих дней заполнить заказами.",
    )
    return parser.parse_args()


def confirm_run(args):
    if args.yes:
        return True
    answer = input(
        "Скрипт добавит демо-данные и пересоздаст заказы с пометкой DEMO:. Продолжить? [y/N] "
    )
    return answer.strip().lower() in {"y", "yes", "д", "да"}


def ensure_owner():
    owner = User.query.filter_by(role="owner").first()
    if owner:
        return owner

    owner = User(
        login="owner",
        full_name="Владелец",
        role="owner",
        is_active=True,
    )
    owner.set_password(OWNER_PASSWORD)
    db.session.add(owner)
    db.session.flush()
    return owner


def ensure_positions():
    result = {}
    for item in POSITIONS:
        position = Position.query.filter_by(name=item["name"]).first()
        if not position:
            position = Position(
                name=item["name"],
                salary=item["salary"],
                can_manage_system=item["can_manage_system"],
            )
            db.session.add(position)
            db.session.flush()
        else:
            position.salary = item["salary"]
            position.can_manage_system = item["can_manage_system"]
        result[item["name"]] = position
    return result


def ensure_boxes():
    boxes = []
    for index in range(1, 5):
        name = f"Бокс {index}"
        box = Box.query.filter(Box.name == name, Box.order_index >= 0).first()
        if not box:
            box = Box(name=name, is_active=True, order_index=index - 1)
            db.session.add(box)
            db.session.flush()
        else:
            box.is_active = True
            box.order_index = index - 1
        boxes.append(box)
    return boxes


def ensure_employees(positions):
    result = {}
    for item in EMPLOYEES:
        employee = Employee.query.filter_by(phone=item["phone"]).first()
        position = positions[item["position"]]
        if not employee:
            employee = Employee(
                first_name=item["first_name"],
                last_name=item["last_name"],
                middle_name=item["middle_name"],
                phone=item["phone"],
                position_id=position.id,
                salary_type=item["salary_type"],
                status="active",
            )
            db.session.add(employee)
            db.session.flush()
        else:
            employee.first_name = item["first_name"]
            employee.last_name = item["last_name"]
            employee.middle_name = item["middle_name"]
            employee.position_id = position.id
            employee.salary_type = item["salary_type"]
            employee.status = "active"
            employee.sick_leave_start = None
            employee.sick_leave_end = None
            employee.fired_date = None
        result[item["phone"]] = employee
    return result


def ensure_admin_users(employees):
    users = []
    for item in ADMIN_USERS:
        employee = employees[item["employee_phone"]]
        full_name = f"{employee.last_name} {employee.first_name} {employee.middle_name}".strip()
        user = User.query.filter_by(login=item["login"]).first()
        if not user:
            user = User(
                login=item["login"],
                full_name=full_name,
                role="admin",
                employee_id=employee.id,
                is_active=True,
            )
            user.set_password(ADMIN_PASSWORD)
            db.session.add(user)
            db.session.flush()
        else:
            user.full_name = full_name
            user.role = "admin"
            user.employee_id = employee.id
            user.is_active = True

        for field in [
            "can_view_statistics",
            "can_view_admin_schedule",
            "can_view_positions",
            "can_view_employees",
            "can_create_employees",
            "can_edit_employees",
            "can_fire_employees",
            "can_edit_services",
            "can_view_services",
            "can_create_services",
            "can_delete_services",
            "can_create_positions",
            "can_edit_positions",
            "can_delete_positions",
            "can_export_orders",
            "can_view_box_schedule",
            "can_edit_box_schedule",
            "can_edit_admin_schedule",
        ]:
            setattr(user, field, True)
        users.append(user)
    return users


def ensure_services(owner):
    result = {}
    for item in SERVICES:
        service = Service.query.filter_by(name=item["name"]).first()
        old_price = None
        old_percentage = None
        if not service:
            service = Service(
                name=item["name"],
                description=item["description"],
                price=item["price"],
                duration=item["duration"],
                washer_percentage=item["washer_percentage"],
                is_active=True,
            )
            db.session.add(service)
            db.session.flush()
        else:
            old_price = service.price
            old_percentage = service.washer_percentage
            service.description = item["description"]
            service.price = item["price"]
            service.duration = item["duration"]
            service.washer_percentage = item["washer_percentage"]
            service.is_active = True

        has_history = ServicePriceHistory.query.filter_by(service_id=service.id).first()
        if not has_history:
            db.session.add(
                ServicePriceHistory(
                    service_id=service.id,
                    old_price=old_price,
                    new_price=service.price,
                    old_washer_percentage=old_percentage,
                    new_washer_percentage=service.washer_percentage,
                    changed_by_user_id=owner.id,
                )
            )
        result[item["name"]] = service
    return result


def ensure_clients_and_cars():
    clients = []
    cars = []
    for item in CLIENTS_AND_CARS:
        last_name, first_name, middle_name, phone, email = item["client"]
        plate, brand, model, color = item["car"]

        client = Client.query.filter_by(phone=phone).first()
        if not client:
            client = Client(
                last_name=last_name,
                first_name=first_name,
                middle_name=middle_name,
                phone=phone,
                email=email,
                is_active=True,
            )
            db.session.add(client)
            db.session.flush()
        else:
            client.last_name = last_name
            client.first_name = first_name
            client.middle_name = middle_name
            client.email = email
            client.is_active = True

        car = Car.query.filter_by(license_plate=plate).first()
        if not car:
            car = Car(
                license_plate=plate,
                brand=brand,
                model=model,
                color=color,
                is_active=True,
            )
            db.session.add(car)
            db.session.flush()
        else:
            car.brand = brand
            car.model = model
            car.color = color
            car.is_active = True

        clients.append(client)
        cars.append(car)
    return clients, cars


def clear_demo_orders():
    demo_orders = Order.query.filter(Order.notes.like(f"{DEMO_PREFIX}%")).all()
    for order in demo_orders:
        db.session.delete(order)
    db.session.flush()


def clear_demo_schedules(admin_users, employees, start_date, end_date):
    admin_ids = [user.id for user in admin_users]
    employee_ids = [employee.id for employee in employees.values()]

    if admin_ids:
        AdminSchedule.query.filter(
            AdminSchedule.user_id.in_(admin_ids),
            AdminSchedule.date >= start_date,
            AdminSchedule.date <= end_date,
        ).delete(synchronize_session=False)

    if employee_ids:
        BoxSchedule.query.filter(
            BoxSchedule.employee_id.in_(employee_ids),
            BoxSchedule.date >= start_date,
            BoxSchedule.date <= end_date,
        ).delete(synchronize_session=False)
    db.session.flush()


def create_admin_schedules(admin_users, today):
    for offset in range(14):
        date = today + timedelta(days=offset)
        shifts = [
            (admin_users[0], time(9, 0), time(15, 0)),
            (admin_users[1], time(15, 0), time(22, 0)),
        ]
        for user, start_time, end_time in shifts:
            db.session.add(
                AdminSchedule(
                    user_id=user.id,
                    date=date,
                    start_time=start_time,
                    end_time=end_time,
                )
            )


def create_box_schedules(boxes, employees, start_date, end_date):
    morning = [
        employees["79990000003"],
        employees["79990000004"],
        employees["79990000005"],
        employees["79990000006"],
    ]
    evening = [
        employees["79990000007"],
        employees["79990000008"],
        employees["79990000009"],
        employees["79990000010"],
    ]

    current = start_date
    while current <= end_date:
        day_shift = (current - start_date).days
        for index, box in enumerate(boxes):
            db.session.add(
                BoxSchedule(
                    box_id=box.id,
                    employee_id=morning[(index + day_shift) % len(morning)].id,
                    date=current,
                    start_time=time(10, 0),
                    end_time=time(16, 0),
                )
            )
            db.session.add(
                BoxSchedule(
                    box_id=box.id,
                    employee_id=evening[(index + day_shift) % len(evening)].id,
                    date=current,
                    start_time=time(16, 0),
                    end_time=time(22, 0),
                )
            )
        current += timedelta(days=1)


def parse_hhmm(value):
    return datetime.strptime(value, "%H:%M").time()


def employee_for_order(box, scheduled_at):
    schedules = BoxSchedule.query.filter_by(
        box_id=box.id,
        date=scheduled_at.date(),
    ).all()
    order_time = scheduled_at.time()
    for schedule in schedules:
        if schedule.start_time and schedule.end_time:
            if schedule.start_time <= order_time < schedule.end_time:
                return schedule.employee_id
        else:
            return schedule.employee_id
    return None


def order_status_for_date(order_date, today, index):
    if order_date < today:
        return "completed", True
    if order_date > today:
        return "pending", False
    statuses = [
        ("completed", True),
        ("in_progress", False),
        ("pending", False),
        ("pending", False),
    ]
    return statuses[index % len(statuses)]


def create_orders(boxes, clients, cars, services, start_date, end_date, today):
    order_count = 0
    current = start_date
    while current <= end_date:
        day_index = (current - start_date).days
        for box_index, box in enumerate(boxes):
            templates = ORDER_TEMPLATES[box_index % len(ORDER_TEMPLATES)]
            for local_index, (client_index, start_text, service_names) in enumerate(templates):
                client_index = (client_index + day_index) % len(clients)
                order_start = datetime.combine(current, parse_hhmm(start_text))
                selected_services = [services[name] for name in service_names]
                total_price = sum(service.price for service in selected_services)
                total_duration = sum(service.duration or 0 for service in selected_services)
                status, is_paid = order_status_for_date(
                    current,
                    today,
                    box_index + local_index,
                )
                completed_time = (
                    order_start + timedelta(minutes=total_duration)
                    if status == "completed"
                    else None
                )

                order = Order(
                    client_id=clients[client_index].id,
                    car_id=cars[client_index].id,
                    box_id=box.id,
                    employee_id=employee_for_order(box, order_start),
                    status=status,
                    scheduled_time=order_start,
                    completed_time=completed_time,
                    total_price=total_price,
                    total_duration=total_duration,
                    is_paid=is_paid,
                    notes=f"{DEMO_PREFIX} тестовый заказ без пересечения",
                )
                db.session.add(order)
                db.session.flush()

                for service in selected_services:
                    db.session.add(
                        OrderService(
                            order_id=order.id,
                            service_id=service.id,
                            service_price=service.price,
                            washer_percentage=service.washer_percentage,
                        )
                    )
                order_count += 1
        current += timedelta(days=1)
    return order_count


def generate_data(args):
    app = create_app()
    today = datetime.now().date()
    order_start_date = today - timedelta(days=args.days_past)
    order_end_date = today + timedelta(days=args.days_future)
    schedule_end_date = max(order_end_date, today + timedelta(days=13))

    with app.app_context():
        db.create_all()

        owner = ensure_owner()
        positions = ensure_positions()
        boxes = ensure_boxes()
        employees = ensure_employees(positions)
        admin_users = ensure_admin_users(employees)
        services = ensure_services(owner)
        clients, cars = ensure_clients_and_cars()

        clear_demo_orders()
        clear_demo_schedules(admin_users, employees, order_start_date, schedule_end_date)

        create_admin_schedules(admin_users, today)
        create_box_schedules(boxes, employees, order_start_date, schedule_end_date)
        order_count = create_orders(
            boxes,
            clients,
            cars,
            services,
            order_start_date,
            order_end_date,
            today,
        )

        db.session.commit()

        print("Тестовые данные созданы.")
        print(f"Боксы: {len(boxes)}")
        print(f"Должности: {len(POSITIONS)}")
        print(f"Сотрудники: {len(EMPLOYEES)}")
        print(f"Администраторы: {len(ADMIN_USERS)}")
        print(f"Услуги: {len(SERVICES)}")
        print(f"Клиенты и автомобили: {len(CLIENTS_AND_CARS)}")
        print(f"Заказы: {order_count}")
        print("")
        print("Учетные записи:")
        print(f"owner / {OWNER_PASSWORD}")
        for item in ADMIN_USERS:
            print(f"{item['login']} / {ADMIN_PASSWORD}")


def main():
    args = parse_args()
    if not confirm_run(args):
        print("Операция отменена.")
        return
    generate_data(args)


if __name__ == "__main__":
    main()
