from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from auth import _check_admin_schedule, login_required, permission_required
from extensions import db
from models import AdminSchedule, Box, BoxSchedule, Employee, Order, User

bp = Blueprint("schedule", __name__)


@bp.route("/api/admin-schedules", methods=["GET"])
@permission_required("can_view_admin_schedule")
def list_admin_schedules():
    """Получить расписание админов на период (по умолчанию - текущая неделя)."""
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    if start_str:
        start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
    else:
        today = datetime.now().date()
        start_date = today - timedelta(days=today.weekday())

    if end_str:
        end_date = datetime.strptime(end_str, "%Y-%m-%d").date()
    else:
        end_date = start_date + timedelta(days=13)

    schedules = (
        AdminSchedule.query.filter(
            AdminSchedule.date >= start_date, AdminSchedule.date <= end_date
        )
        .order_by(AdminSchedule.date, AdminSchedule.start_time)
        .all()
    )

    return jsonify([s.to_dict() for s in schedules])


@bp.route("/api/admin-schedules", methods=["POST"])
@permission_required("can_view_admin_schedule")
def create_admin_schedule():
    """Назначить смену админу. Проверяет пересечения с другими сменами в это же время."""
    data = request.json or {}
    current_user = request.current_user

    user_id = data.get("user_id")
    date_str = data.get("date")
    start_time_str = data.get("start_time")
    end_time_str = data.get("end_time")

    if not user_id or not date_str or not start_time_str or not end_time_str:
        return jsonify({"error": "Требуются user_id, date, start_time, end_time"}), 400

    try:
        date = datetime.strptime(date_str, "%Y-%m-%d").date()
        start_time = datetime.strptime(start_time_str, "%H:%M").time()
        end_time = datetime.strptime(end_time_str, "%H:%M").time()
    except ValueError:
        return jsonify({"error": "Неверный формат даты/времени"}), 400

    if end_time <= start_time:
        return jsonify(
            {"error": "Время окончания должно быть позже времени начала"}
        ), 400

    # Админам нельзя редактировать прошлое или вмешиваться в текущую смену
    if current_user.role != "owner":
        now = datetime.now()
        new_shift_start = datetime.combine(date, start_time)
        if new_shift_start < now:
            return jsonify(
                {
                    "error": "Администратор может назначать только будущие смены. Только владелец может редактировать прошлое."
                }
            ), 403
        active = AdminSchedule.query.filter(
            AdminSchedule.date == now.date(),
            AdminSchedule.start_time <= now.time(),
            AdminSchedule.end_time > now.time(),
        ).first()
        if active:
            active_start = datetime.combine(active.date, active.start_time)
            active_end = datetime.combine(active.date, active.end_time)
            new_shift_end = datetime.combine(date, end_time)
            if new_shift_start < active_end and new_shift_end > active_start:
                return jsonify(
                    {
                        "error": "Нельзя изменять интервал текущей активной смены. Это может сделать только владелец."
                    }
                ), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404
    if user.role == "owner":
        return jsonify(
            {"error": "Владельцу не нужно назначать смены — он работает всегда"}
        ), 400
    if not user.is_active:
        return jsonify(
            {"error": "Нельзя назначить смену деактивированному пользователю"}
        ), 400

    if user.employee_id:
        emp = Employee.query.get(user.employee_id)
        if emp:
            if emp.status == "fired":
                return jsonify(
                    {"error": "Нельзя назначить смену уволенному сотруднику"}
                ), 400
            if (
                emp.status == "sick_leave"
                and emp.sick_leave_start
                and emp.sick_leave_end
                and emp.sick_leave_start <= date <= emp.sick_leave_end
            ):
                return jsonify(
                    {
                        "error": (
                            f"Сотрудник на больничном с "
                            f"{emp.sick_leave_start.strftime('%d.%m.%Y')} по "
                            f"{emp.sick_leave_end.strftime('%d.%m.%Y')}"
                        )
                    }
                ), 400

    overlapping = AdminSchedule.query.filter(
        AdminSchedule.date == date,
        AdminSchedule.start_time < end_time,
        AdminSchedule.end_time > start_time,
    ).first()

    if overlapping:
        other_user = overlapping.user
        return jsonify(
            {
                "error": f"Время пересекается со сменой администратора {other_user.full_name} ({overlapping.start_time.strftime('%H:%M')}-{overlapping.end_time.strftime('%H:%M')}). В одно время может работать только один админ."
            }
        ), 409

    schedule = AdminSchedule(
        user_id=user_id, date=date, start_time=start_time, end_time=end_time
    )
    db.session.add(schedule)
    db.session.commit()

    return jsonify(schedule.to_dict()), 201


@bp.route("/api/admin-schedules/<int:schedule_id>", methods=["DELETE"])
@permission_required("can_view_admin_schedule")
def delete_admin_schedule(schedule_id):
    """Удалить смену админа."""
    schedule = AdminSchedule.query.get_or_404(schedule_id)
    current_user = request.current_user

    if current_user.role != "owner":
        now = datetime.now()
        shift_start = datetime.combine(schedule.date, schedule.start_time)
        shift_end = datetime.combine(schedule.date, schedule.end_time)

        if shift_start <= now < shift_end:
            return jsonify(
                {
                    "error": "Нельзя удалить текущую активную смену. Это может сделать только владелец."
                }
            ), 403
        if shift_end <= now:
            return jsonify(
                {
                    "error": "Нельзя удалять прошедшие смены. Это может сделать только владелец."
                }
            ), 403

    db.session.delete(schedule)
    db.session.commit()
    return "", 204


@bp.route("/api/admin-schedules/<int:schedule_id>", methods=["PUT"])
@permission_required("can_view_admin_schedule")
def update_admin_schedule(schedule_id):
    """Изменить смену админа."""
    schedule = AdminSchedule.query.get_or_404(schedule_id)
    current_user = request.current_user
    data = request.json or {}

    if current_user.role != "owner":
        now = datetime.now()
        shift_start = datetime.combine(schedule.date, schedule.start_time)
        shift_end = datetime.combine(schedule.date, schedule.end_time)

        if shift_start <= now < shift_end:
            return jsonify(
                {
                    "error": "Нельзя редактировать текущую активную смену. Это может сделать только владелец."
                }
            ), 403
        if shift_end <= now:
            return jsonify(
                {
                    "error": "Нельзя редактировать прошедшие смены. Это может сделать только владелец."
                }
            ), 403

    new_start = schedule.start_time
    new_end = schedule.end_time
    new_date = schedule.date
    new_user_id = schedule.user_id

    if "start_time" in data:
        try:
            new_start = datetime.strptime(data["start_time"], "%H:%M").time()
        except ValueError:
            return jsonify({"error": "Неверный формат start_time"}), 400

    if "end_time" in data:
        try:
            new_end = datetime.strptime(data["end_time"], "%H:%M").time()
        except ValueError:
            return jsonify({"error": "Неверный формат end_time"}), 400

    if "date" in data:
        try:
            new_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Неверный формат date"}), 400

    if "user_id" in data:
        new_user_id = data["user_id"]
        user = User.query.get(new_user_id)
        if not user or user.role == "owner":
            return jsonify({"error": "Некорректный пользователь"}), 400

    if new_end <= new_start:
        return jsonify({"error": "Время окончания должно быть позже начала"}), 400

    target_user = User.query.get(new_user_id)
    if target_user and target_user.employee_id:
        emp = Employee.query.get(target_user.employee_id)
        if emp:
            if emp.status == "fired":
                return jsonify(
                    {"error": "Нельзя назначить смену уволенному сотруднику"}
                ), 400
            if (
                emp.status == "sick_leave"
                and emp.sick_leave_start
                and emp.sick_leave_end
                and emp.sick_leave_start <= new_date <= emp.sick_leave_end
            ):
                return jsonify(
                    {
                        "error": (
                            f"Сотрудник на больничном с "
                            f"{emp.sick_leave_start.strftime('%d.%m.%Y')} по "
                            f"{emp.sick_leave_end.strftime('%d.%m.%Y')}"
                        )
                    }
                ), 400

    if current_user.role != "owner":
        now = datetime.now()
        new_shift_start = datetime.combine(new_date, new_start)
        if new_shift_start < now:
            return jsonify(
                {
                    "error": "Администратор не может перенести смену в прошлое или на текущее время"
                }
            ), 403

    overlapping = AdminSchedule.query.filter(
        AdminSchedule.id != schedule_id,
        AdminSchedule.date == new_date,
        AdminSchedule.start_time < new_end,
        AdminSchedule.end_time > new_start,
    ).first()

    if overlapping:
        return jsonify(
            {
                "error": f"Время пересекается со сменой {overlapping.user.full_name} ({overlapping.start_time.strftime('%H:%M')}-{overlapping.end_time.strftime('%H:%M')})"
            }
        ), 409

    schedule.user_id = new_user_id
    schedule.date = new_date
    schedule.start_time = new_start
    schedule.end_time = new_end
    db.session.commit()

    return jsonify(schedule.to_dict())


@bp.route("/api/admin-schedules/current", methods=["GET"])
@login_required
def get_current_shift():
    """Получить текущую активную смену для авторизованного пользователя."""
    user = request.current_user
    if user.role == "owner":
        return jsonify({"is_owner": True, "allowed": True})

    check = _check_admin_schedule(user.id)
    return jsonify(check)


@bp.route("/api/box-schedules", methods=["GET"])
def get_box_schedules():
    """Получить расписание назначений на период"""
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    if start_date_str:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    else:
        start_date = datetime.now().date()

    if end_date_str:
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    else:
        end_date = start_date + timedelta(days=14)

    schedules = BoxSchedule.query.filter(
        BoxSchedule.date >= start_date, BoxSchedule.date <= end_date
    ).all()

    return jsonify([schedule.to_dict() for schedule in schedules])


@bp.route("/api/box-schedules", methods=["POST"])
def create_box_schedule():
    """Назначить сотрудника на бокс на определенную дату с временным промежутком"""
    data = request.json

    box_id = data.get("box_id")
    employee_id = data.get("employee_id")
    date_str = data.get("date")
    start_time_str = data.get("start_time")
    end_time_str = data.get("end_time")

    if not box_id or not employee_id or not date_str:
        return jsonify({"error": "Требуются box_id, employee_id и date"}), 400

    try:
        date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Неверный формат даты. Используйте YYYY-MM-DD"}), 400

    start_time = None
    end_time = None
    if start_time_str:
        try:
            start_time = datetime.strptime(start_time_str, "%H:%M").time()
        except ValueError:
            return jsonify(
                {"error": "Неверный формат времени начала. Используйте HH:MM"}
            ), 400

    if end_time_str:
        try:
            end_time = datetime.strptime(end_time_str, "%H:%M").time()
        except ValueError:
            return jsonify(
                {"error": "Неверный формат времени окончания. Используйте HH:MM"}
            ), 400

    box = Box.query.get(box_id)
    if not box:
        return jsonify({"error": "Бокс не найден"}), 404

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({"error": "Сотрудник не найден"}), 404

    if employee.status == "fired":
        return jsonify({"error": "Нельзя назначить уволенного сотрудника"}), 400

    if (
        employee.status == "sick_leave"
        and employee.sick_leave_start
        and employee.sick_leave_end
    ):
        if employee.sick_leave_start <= date <= employee.sick_leave_end:
            return jsonify(
                {
                    "error": f"Сотрудник на больничном с {employee.sick_leave_start.strftime('%d.%m.%Y')} по {employee.sick_leave_end.strftime('%d.%m.%Y')}"
                }
            ), 400

    existing_schedules = BoxSchedule.query.filter_by(box_id=box_id, date=date).all()

    for existing in existing_schedules:
        if (not existing.start_time and not existing.end_time) or (
            not start_time and not end_time
        ):
            return jsonify(
                {"error": "На этот день уже есть назначение на весь день"}
            ), 400

        if start_time and end_time and existing.start_time and existing.end_time:
            if not (end_time <= existing.start_time or start_time >= existing.end_time):
                return jsonify(
                    {
                        "error": f"Временной промежуток пересекается с существующим назначением ({existing.start_time.strftime('%H:%M')} - {existing.end_time.strftime('%H:%M')})"
                    }
                ), 400

    schedule = BoxSchedule(
        box_id=box_id,
        employee_id=employee_id,
        date=date,
        start_time=start_time,
        end_time=end_time,
    )
    db.session.add(schedule)
    db.session.commit()
    return jsonify(schedule.to_dict()), 201


@bp.route("/api/box-schedules/<int:id>", methods=["DELETE"])
def delete_box_schedule(id):
    """Удалить назначение сотрудника"""
    schedule = BoxSchedule.query.get_or_404(id)
    box_id = schedule.box_id
    date = schedule.date

    db.session.delete(schedule)
    db.session.commit()

    _update_orders_employees(box_id, date)

    return "", 204


def _update_orders_employees(box_id, date):
    """Обновляет назначенных сотрудников в заказах на основе расписания боксов"""
    start_datetime = datetime.combine(date, datetime.min.time())
    end_datetime = datetime.combine(date, datetime.max.time())

    orders = Order.query.filter(
        Order.box_id == box_id,
        Order.scheduled_time >= start_datetime,
        Order.scheduled_time <= end_datetime,
        Order.status.in_(["pending", "in_progress"]),
    ).all()

    schedules = BoxSchedule.query.filter_by(box_id=box_id, date=date).all()

    for order in orders:
        if not order.scheduled_time:
            continue

        order_time = order.scheduled_time.time()
        assigned_employee = None

        for schedule in schedules:
            if schedule.start_time and schedule.end_time:
                if schedule.start_time <= order_time < schedule.end_time:
                    assigned_employee = schedule.employee_id
                    break
            else:
                assigned_employee = schedule.employee_id
                break

        order.employee_id = assigned_employee

    db.session.commit()


@bp.route("/api/box-schedules/day", methods=["POST"])
def create_day_schedules():
    """Создать несколько смен для одного бокса на один день"""
    try:
        data = request.json

        box_id = data.get("box_id")
        date_str = data.get("date")
        shifts = data.get("shifts", [])

        if not box_id or not date_str or not shifts:
            return jsonify({"error": "Требуются box_id, date и shifts"}), 400

        try:
            date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"error": "Неверный формат даты. Используйте YYYY-MM-DD"}
            ), 400

        box = Box.query.get(box_id)
        if not box:
            return jsonify({"error": "Бокс не найден"}), 404

        # Удаляем все существующие назначения на этот день для этого бокса
        BoxSchedule.query.filter_by(box_id=box_id, date=date).delete()

        created = []

        for shift in shifts:
            employee_id = shift.get("employee_id")
            start_time_str = shift.get("start_time")
            end_time_str = shift.get("end_time")

            if not employee_id:
                continue

            employee = Employee.query.get(employee_id)
            if not employee:
                continue

            if employee.status == "fired":
                employee_name = f"{employee.last_name} {employee.first_name}"
                return jsonify(
                    {
                        "error": f"Сотрудник {employee_name} уволен и не может быть назначен"
                    }
                ), 400

            if (
                employee.status == "sick_leave"
                and employee.sick_leave_start
                and employee.sick_leave_end
            ):
                if employee.sick_leave_start <= date <= employee.sick_leave_end:
                    employee_name = f"{employee.last_name} {employee.first_name}"
                    return jsonify(
                        {
                            "error": f"Сотрудник {employee_name} на больничном с {employee.sick_leave_start.strftime('%d.%m.%Y')} по {employee.sick_leave_end.strftime('%d.%m.%Y')}"
                        }
                    ), 400

            start_time = None
            end_time = None

            if start_time_str:
                try:
                    start_time = datetime.strptime(start_time_str, "%H:%M").time()
                except ValueError:
                    continue

            if end_time_str:
                try:
                    end_time = datetime.strptime(end_time_str, "%H:%M").time()
                except ValueError:
                    continue

            # Проверка что сотрудник не назначен на другой бокс в это же время
            if start_time and end_time:
                other_schedules = BoxSchedule.query.filter(
                    BoxSchedule.employee_id == employee_id,
                    BoxSchedule.date == date,
                    BoxSchedule.box_id != box_id,
                ).all()

                for other in other_schedules:
                    if not other.start_time and not other.end_time:
                        employee_name = f"{employee.last_name} {employee.first_name}"
                        other_box = Box.query.get(other.box_id)
                        return jsonify(
                            {
                                "error": f'Сотрудник {employee_name} уже назначен на весь день в боксе "{other_box.name}"'
                            }
                        ), 400

                    if other.start_time and other.end_time:
                        if not (
                            end_time <= other.start_time or start_time >= other.end_time
                        ):
                            employee_name = (
                                f"{employee.last_name} {employee.first_name}"
                            )
                            other_box = Box.query.get(other.box_id)
                            return jsonify(
                                {
                                    "error": f'Сотрудник {employee_name} уже назначен на время {other.start_time.strftime("%H:%M")}-{other.end_time.strftime("%H:%M")} в боксе "{other_box.name}"'
                                }
                            ), 400

            schedule = BoxSchedule(
                box_id=box_id,
                employee_id=employee_id,
                date=date,
                start_time=start_time,
                end_time=end_time,
            )
            db.session.add(schedule)
            db.session.flush()
            created.append(schedule.to_dict())

        db.session.commit()

        _update_orders_employees(box_id, date)

        return jsonify({"created": created, "total": len(created)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route("/api/box-schedules/bulk", methods=["POST"])
def bulk_create_box_schedules():
    """Массовое назначение сотрудника на несколько дат"""
    try:
        data = request.json

        box_id = data.get("box_id")
        employee_id = data.get("employee_id")
        dates = data.get("dates", [])
        start_time_str = data.get("start_time")
        end_time_str = data.get("end_time")

        if not box_id or not employee_id or not dates:
            return jsonify({"error": "Требуются box_id, employee_id и dates"}), 400

        box = Box.query.get(box_id)
        if not box:
            return jsonify({"error": "Бокс не найден"}), 404

        employee = Employee.query.get(employee_id)
        if not employee:
            return jsonify({"error": "Сотрудник не найден"}), 404

        if employee.status == "fired":
            return jsonify({"error": "Нельзя назначить уволенного сотрудника"}), 400

        start_time = None
        end_time = None
        if start_time_str:
            try:
                start_time = datetime.strptime(start_time_str, "%H:%M").time()
            except ValueError:
                return jsonify({"error": "Неверный формат времени начала"}), 400

        if end_time_str:
            try:
                end_time = datetime.strptime(end_time_str, "%H:%M").time()
            except ValueError:
                return jsonify({"error": "Неверный формат времени окончания"}), 400

        created = []
        updated = []
        skipped = []

        for date_str in dates:
            try:
                date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                skipped.append({"date": date_str, "reason": "Неверный формат даты"})
                continue

            if (
                employee.status == "sick_leave"
                and employee.sick_leave_start
                and employee.sick_leave_end
                and employee.sick_leave_start <= date <= employee.sick_leave_end
            ):
                skipped.append(
                    {
                        "date": date_str,
                        "reason": (
                            f"Сотрудник на больничном с "
                            f"{employee.sick_leave_start.strftime('%d.%m.%Y')} по "
                            f"{employee.sick_leave_end.strftime('%d.%m.%Y')}"
                        ),
                    }
                )
                continue

            if not start_time and not end_time:
                existing = BoxSchedule.query.filter_by(box_id=box_id, date=date).first()
                if existing:
                    existing.employee_id = employee_id
                    existing.start_time = None
                    existing.end_time = None
                    updated.append(existing.to_dict())
                else:
                    schedule = BoxSchedule(
                        box_id=box_id,
                        employee_id=employee_id,
                        date=date,
                        start_time=None,
                        end_time=None,
                    )
                    db.session.add(schedule)
                    db.session.flush()
                    created.append(schedule.to_dict())
            else:
                schedule = BoxSchedule(
                    box_id=box_id,
                    employee_id=employee_id,
                    date=date,
                    start_time=start_time,
                    end_time=end_time,
                )
                db.session.add(schedule)
                db.session.flush()
                created.append(schedule.to_dict())

        db.session.commit()

        return jsonify(
            {
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "total": len(created) + len(updated),
            }
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route("/api/booking/availability", methods=["GET"])
def get_booking_availability():
    """Получить загруженность по дням для календаря записи"""
    start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = start_date + timedelta(days=30)

    orders = Order.query.filter(
        Order.scheduled_time >= start_date,
        Order.scheduled_time < end_date,
        Order.status.in_(["pending", "in_progress"]),
    ).all()

    active_boxes_count = Box.query.filter_by(is_active=True).count()
    if active_boxes_count == 0:
        return jsonify({"error": "Нет активных боксов"}), 400

    slots_per_day_per_box = 48
    total_slots_per_day = slots_per_day_per_box * active_boxes_count

    daily_stats = {}
    for order in orders:
        if not order.scheduled_time or not order.total_duration:
            continue

        date_key = order.scheduled_time.date().isoformat()
        if date_key not in daily_stats:
            daily_stats[date_key] = {
                "date": date_key,
                "orders_count": 0,
                "total_duration": 0,
                "occupied_slots": 0,
            }

        daily_stats[date_key]["orders_count"] += 1
        daily_stats[date_key]["total_duration"] += order.total_duration
        daily_stats[date_key]["occupied_slots"] += (order.total_duration + 14) // 15

    result = []
    current_date = start_date
    for i in range(30):
        date_key = current_date.date().isoformat()
        stats = daily_stats.get(
            date_key,
            {
                "date": date_key,
                "orders_count": 0,
                "total_duration": 0,
                "occupied_slots": 0,
            },
        )

        occupancy_percent = (
            (stats["occupied_slots"] / total_slots_per_day * 100)
            if total_slots_per_day > 0
            else 0
        )

        if occupancy_percent >= 80:
            load_level = "high"
        elif occupancy_percent >= 50:
            load_level = "medium"
        else:
            load_level = "low"

        result.append(
            {
                "date": date_key,
                "day_of_week": current_date.strftime("%A"),
                "orders_count": stats["orders_count"],
                "occupied_slots": stats["occupied_slots"],
                "total_slots": total_slots_per_day,
                "occupancy_percent": round(occupancy_percent, 1),
                "load_level": load_level,
                "is_past": current_date.date() < datetime.now().date(),
            }
        )

        current_date += timedelta(days=1)

    return jsonify(result)


@bp.route("/api/booking/timeslots", methods=["POST"])
def get_available_timeslots():
    """Получить доступные временные слоты для конкретной даты и длительности услуг"""
    data = request.json
    date_str = data.get("date")
    total_duration = data.get("total_duration")

    if not date_str or not total_duration:
        return jsonify({"error": "Требуются date и total_duration"}), 400

    try:
        selected_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Неверный формат даты"}), 400

    if selected_date < datetime.now().date():
        return jsonify({"error": "Нельзя записаться на прошедшую дату"}), 400

    boxes = Box.query.filter_by(is_active=True).all()
    if not boxes:
        return jsonify({"error": "Нет активных боксов"}), 400

    work_start_hour = 10
    work_end_hour = 22

    start_datetime = datetime.combine(selected_date, datetime.min.time())
    end_datetime = datetime.combine(selected_date, datetime.max.time())

    orders = Order.query.filter(
        Order.scheduled_time >= start_datetime,
        Order.scheduled_time <= end_datetime,
        Order.status.in_(["pending", "in_progress"]),
    ).all()

    occupied = {}
    for order in orders:
        if not order.scheduled_time or not order.total_duration or not order.box_id:
            continue

        order_start = order.scheduled_time
        order_end = order_start + timedelta(minutes=order.total_duration)

        current = order_start
        while current < order_end:
            key = (order.box_id, current.hour, current.minute)
            occupied[key] = True
            current += timedelta(minutes=15)

    available_slots = []

    for hour in range(work_start_hour, work_end_hour):
        for minute in [0, 15, 30, 45]:
            slot_time = f"{hour:02d}:{minute:02d}"

            free_boxes = []
            for box in boxes:
                is_free = True
                check_datetime = datetime.combine(
                    selected_date, datetime.strptime(slot_time, "%H:%M").time()
                )
                end_check = check_datetime + timedelta(minutes=total_duration)

                if end_check.hour > work_end_hour or (
                    end_check.hour == work_end_hour and end_check.minute > 0
                ):
                    is_free = False
                else:
                    current = check_datetime
                    while current < end_check:
                        if (box.id, current.hour, current.minute) in occupied:
                            is_free = False
                            break
                        current += timedelta(minutes=15)

                if is_free:
                    free_boxes.append({"id": box.id, "name": box.name})

            if free_boxes:
                available_slots.append(
                    {
                        "time": slot_time,
                        "available_boxes": free_boxes,
                        "boxes_count": len(free_boxes),
                    }
                )

    return jsonify(
        {
            "date": date_str,
            "total_duration": total_duration,
            "available_slots": available_slots,
            "total_boxes": len(boxes),
        }
    )
