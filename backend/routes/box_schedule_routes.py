from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from extensions import db
from models import Box, BoxSchedule, Employee, Order


bp = Blueprint("box_schedules", __name__)


@bp.route("/api/box-schedules", methods=["GET"])
def get_box_schedules():
    from datetime import timedelta

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
            return (
                jsonify({"error": "Неверный формат времени начала. Используйте HH:MM"}),
                400,
            )

    if end_time_str:
        try:
            end_time = datetime.strptime(end_time_str, "%H:%M").time()
        except ValueError:
            return (
                jsonify(
                    {"error": "Неверный формат времени окончания. Используйте HH:MM"}
                ),
                400,
            )

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
            return (
                jsonify(
                    {
                        "error": f"Сотрудник на больничном с {employee .sick_leave_start .strftime ('%d.%m.%Y')} по {employee .sick_leave_end .strftime ('%d.%m.%Y')}"
                    }
                ),
                400,
            )

    existing_schedules = BoxSchedule.query.filter_by(box_id=box_id, date=date).all()

    for existing in existing_schedules:

        if (not existing.start_time and not existing.end_time) or (
            not start_time and not end_time
        ):
            return (
                jsonify({"error": "На этот день уже есть назначение на весь день"}),
                400,
            )

        if start_time and end_time and existing.start_time and existing.end_time:
            if not (end_time <= existing.start_time or start_time >= existing.end_time):
                return (
                    jsonify(
                        {
                            "error": f"Временной промежуток пересекается с существующим назначением ({existing .start_time .strftime ('%H:%M')} - {existing .end_time .strftime ('%H:%M')})"
                        }
                    ),
                    400,
                )

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
    schedule = BoxSchedule.query.get_or_404(id)
    box_id = schedule.box_id
    date = schedule.date

    db.session.delete(schedule)
    db.session.commit()

    update_orders_employees(box_id, date)

    return "", 204


def update_orders_employees(box_id, date):

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
    print(
        f"Обновлено сотрудников в {len (orders )} заказах для бокса {box_id } на {date }"
    )


@bp.route("/api/box-schedules/day", methods=["POST"])
def create_day_schedules():
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
            return (
                jsonify({"error": "Неверный формат даты. Используйте YYYY-MM-DD"}),
                400,
            )

        box = Box.query.get(box_id)
        if not box:
            return jsonify({"error": "Бокс не найден"}), 404

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
                employee_name = f"{employee .last_name } {employee .first_name }"
                return (
                    jsonify(
                        {
                            "error": f"Сотрудник {employee_name } уволен и не может быть назначен"
                        }
                    ),
                    400,
                )

            if (
                employee.status == "sick_leave"
                and employee.sick_leave_start
                and employee.sick_leave_end
            ):
                if employee.sick_leave_start <= date <= employee.sick_leave_end:
                    employee_name = f"{employee .last_name } {employee .first_name }"
                    return (
                        jsonify(
                            {
                                "error": f"Сотрудник {employee_name } на больничном с {employee .sick_leave_start .strftime ('%d.%m.%Y')} по {employee .sick_leave_end .strftime ('%d.%m.%Y')}"
                            }
                        ),
                        400,
                    )

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

            if start_time and end_time:

                other_schedules = BoxSchedule.query.filter(
                    BoxSchedule.employee_id == employee_id,
                    BoxSchedule.date == date,
                    BoxSchedule.box_id != box_id,
                ).all()

                for other in other_schedules:

                    if not other.start_time and not other.end_time:
                        employee_name = (
                            f"{employee .last_name } {employee .first_name }"
                        )
                        other_box = Box.query.get(other.box_id)
                        return (
                            jsonify(
                                {
                                    "error": f'Сотрудник {employee_name } уже назначен на весь день в боксе "{other_box .name }"'
                                }
                            ),
                            400,
                        )

                    if other.start_time and other.end_time:
                        if not (
                            end_time <= other.start_time or start_time >= other.end_time
                        ):
                            employee_name = (
                                f"{employee .last_name } {employee .first_name }"
                            )
                            other_box = Box.query.get(other.box_id)
                            return (
                                jsonify(
                                    {
                                        "error": f'Сотрудник {employee_name } уже назначен на время {other .start_time .strftime ("%H:%M")}-{other .end_time .strftime ("%H:%M")} в боксе "{other_box .name }"'
                                    }
                                ),
                                400,
                            )

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

        update_orders_employees(box_id, date)

        return jsonify({"created": created, "total": len(created)}), 201
    except Exception as e:
        print(f"Ошибка в create_day_schedules: {e }")
        import traceback

        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route("/api/box-schedules/bulk", methods=["POST"])
def bulk_create_box_schedules():
    try:
        data = request.json

        box_id = data.get("box_id")
        employee_id = data.get("employee_id")
        dates = data.get("dates", [])
        start_time_str = data.get("start_time")
        end_time_str = data.get("end_time")

        print(
            f"Получен запрос: box_id={box_id }, employee_id={employee_id }, dates={dates }"
        )

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
            except ValueError as e:
                print(f"Ошибка парсинга даты {date_str }: {e }")
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
                            f"{employee .sick_leave_start .strftime ('%d.%m.%Y')} по "
                            f"{employee .sick_leave_end .strftime ('%d.%m.%Y')}"
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

        print(
            f"Создано: {len (created )}, Обновлено: {len (updated )}, Пропущено: {len (skipped )}"
        )

        return (
            jsonify(
                {
                    "created": created,
                    "updated": updated,
                    "skipped": skipped,
                    "total": len(created) + len(updated),
                }
            ),
            201,
        )
    except Exception as e:
        print(f"Ошибка в bulk_create_box_schedules: {e }")
        import traceback

        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
