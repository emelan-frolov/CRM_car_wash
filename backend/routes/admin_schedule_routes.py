from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from auth import _check_admin_schedule, login_required, permission_required
from extensions import db
from models import AdminSchedule, Employee, User


bp = Blueprint("admin_schedules", __name__)


@bp.route("/api/admin-schedules", methods=["GET"])
@permission_required("can_view_admin_schedule")
def list_admin_schedules():
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
        return (
            jsonify({"error": "Время окончания должно быть позже времени начала"}),
            400,
        )

    if current_user.role != "owner":
        now = datetime.now()
        new_shift_start = datetime.combine(date, start_time)
        if new_shift_start < now:
            return (
                jsonify(
                    {
                        "error": "Администратор может назначать только будущие смены. Только владелец может редактировать прошлое."
                    }
                ),
                403,
            )

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
                return (
                    jsonify(
                        {
                            "error": "Нельзя изменять интервал текущей активной смены. Это может сделать только владелец."
                        }
                    ),
                    403,
                )

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404
    if user.role == "owner":
        return (
            jsonify(
                {"error": "Владельцу не нужно назначать смены - он работает всегда"}
            ),
            400,
        )
    if not user.is_active:
        return (
            jsonify({"error": "Нельзя назначить смену деактивированному пользователю"}),
            400,
        )

    if user.employee_id:
        emp = Employee.query.get(user.employee_id)
        if emp:
            if emp.status == "fired":
                return (
                    jsonify({"error": "Нельзя назначить смену уволенному сотруднику"}),
                    400,
                )
            if (
                emp.status == "sick_leave"
                and emp.sick_leave_start
                and emp.sick_leave_end
                and emp.sick_leave_start <= date <= emp.sick_leave_end
            ):
                return (
                    jsonify(
                        {
                            "error": (
                                f"Сотрудник на больничном с "
                                f"{emp .sick_leave_start .strftime ('%d.%m.%Y')} по "
                                f"{emp .sick_leave_end .strftime ('%d.%m.%Y')}"
                            )
                        }
                    ),
                    400,
                )

    overlapping = AdminSchedule.query.filter(
        AdminSchedule.date == date,
        AdminSchedule.start_time < end_time,
        AdminSchedule.end_time > start_time,
    ).first()

    if overlapping:
        other_user = overlapping.user
        return (
            jsonify(
                {
                    "error": f"Время пересекается со сменой администратора {other_user .full_name } ({overlapping .start_time .strftime ('%H:%M')}-{overlapping .end_time .strftime ('%H:%M')}). В одно время может работать только один админ."
                }
            ),
            409,
        )

    schedule = AdminSchedule(
        user_id=user_id, date=date, start_time=start_time, end_time=end_time
    )
    db.session.add(schedule)
    db.session.commit()

    return jsonify(schedule.to_dict()), 201


@bp.route("/api/admin-schedules/<int:schedule_id>", methods=["DELETE"])
@permission_required("can_view_admin_schedule")
def delete_admin_schedule(schedule_id):
    schedule = AdminSchedule.query.get_or_404(schedule_id)
    current_user = request.current_user

    if current_user.role != "owner":
        now = datetime.now()
        shift_start = datetime.combine(schedule.date, schedule.start_time)
        shift_end = datetime.combine(schedule.date, schedule.end_time)

        if shift_start <= now < shift_end:
            return (
                jsonify(
                    {
                        "error": "Нельзя удалить текущую активную смену. Это может сделать только владелец."
                    }
                ),
                403,
            )
        if shift_end <= now:
            return (
                jsonify(
                    {
                        "error": "Нельзя удалять прошедшие смены. Это может сделать только владелец."
                    }
                ),
                403,
            )

    db.session.delete(schedule)
    db.session.commit()
    return "", 204


@bp.route("/api/admin-schedules/<int:schedule_id>", methods=["PUT"])
@permission_required("can_view_admin_schedule")
def update_admin_schedule(schedule_id):
    schedule = AdminSchedule.query.get_or_404(schedule_id)
    current_user = request.current_user
    data = request.json or {}

    if current_user.role != "owner":
        now = datetime.now()
        shift_start = datetime.combine(schedule.date, schedule.start_time)
        shift_end = datetime.combine(schedule.date, schedule.end_time)

        if shift_start <= now < shift_end:
            return (
                jsonify(
                    {
                        "error": "Нельзя редактировать текущую активную смену. Это может сделать только владелец."
                    }
                ),
                403,
            )
        if shift_end <= now:
            return (
                jsonify(
                    {
                        "error": "Нельзя редактировать прошедшие смены. Это может сделать только владелец."
                    }
                ),
                403,
            )

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
                return (
                    jsonify({"error": "Нельзя назначить смену уволенному сотруднику"}),
                    400,
                )
            if (
                emp.status == "sick_leave"
                and emp.sick_leave_start
                and emp.sick_leave_end
                and emp.sick_leave_start <= new_date <= emp.sick_leave_end
            ):
                return (
                    jsonify(
                        {
                            "error": (
                                f"Сотрудник на больничном с "
                                f"{emp .sick_leave_start .strftime ('%d.%m.%Y')} по "
                                f"{emp .sick_leave_end .strftime ('%d.%m.%Y')}"
                            )
                        }
                    ),
                    400,
                )

    if current_user.role != "owner":
        now = datetime.now()
        new_shift_start = datetime.combine(new_date, new_start)
        if new_shift_start < now:
            return (
                jsonify(
                    {
                        "error": "Администратор не может перенести смену в прошлое или на текущее время"
                    }
                ),
                403,
            )

    overlapping = AdminSchedule.query.filter(
        AdminSchedule.id != schedule_id,
        AdminSchedule.date == new_date,
        AdminSchedule.start_time < new_end,
        AdminSchedule.end_time > new_start,
    ).first()

    if overlapping:
        return (
            jsonify(
                {
                    "error": f"Время пересекается со сменой {overlapping .user .full_name } ({overlapping .start_time .strftime ('%H:%M')}-{overlapping .end_time .strftime ('%H:%M')})"
                }
            ),
            409,
        )

    schedule.user_id = new_user_id
    schedule.date = new_date
    schedule.start_time = new_start
    schedule.end_time = new_end
    db.session.commit()

    return jsonify(schedule.to_dict())


@bp.route("/api/admin-schedules/current", methods=["GET"])
@login_required
def get_current_shift():
    user = request.current_user
    if user.role == "owner":
        return jsonify({"is_owner": True, "allowed": True})

    check = _check_admin_schedule(user.id)
    return jsonify(check)
