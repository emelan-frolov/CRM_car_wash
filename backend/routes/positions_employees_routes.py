from datetime import datetime

from flask import Blueprint, jsonify, request

from extensions import db
from models import AdminSchedule, BoxSchedule, Employee, Position, User


bp = Blueprint("positions_employees", __name__)


@bp.route("/api/positions", methods=["GET"])
def get_positions():
    positions = Position.query.all()
    return jsonify([position.to_dict() for position in positions])


@bp.route("/api/positions", methods=["POST"])
def create_position():
    data = request.json

    existing = Position.query.filter_by(name=data["name"]).first()
    if existing:
        return jsonify({"error": "Должность с таким названием уже существует"}), 400

    position = Position(
        name=data["name"],
        salary=data["salary"],
        can_manage_system=bool(data.get("can_manage_system", False)),
    )
    db.session.add(position)
    db.session.commit()
    return jsonify(position.to_dict()), 201


@bp.route("/api/positions/<int:id>", methods=["PUT"])
def update_position(id):
    position = Position.query.get_or_404(id)
    data = request.json

    if "name" in data:
        existing = Position.query.filter(
            Position.name == data["name"], Position.id != id
        ).first()
        if existing:
            return jsonify({"error": "Должность с таким названием уже существует"}), 400
        position.name = data["name"]

    if "salary" in data:
        position.salary = data["salary"]

    if "can_manage_system" in data:
        position.can_manage_system = bool(data["can_manage_system"])

    db.session.commit()
    return jsonify(position.to_dict())


@bp.route("/api/positions/<int:id>", methods=["DELETE"])
def delete_position(id):
    position = Position.query.get_or_404(id)

    if position.employees:
        return (
            jsonify(
                {
                    "error": "Невозможно удалить должность, есть сотрудники с этой должностью"
                }
            ),
            400,
        )

    db.session.delete(position)
    db.session.commit()
    return "", 204


@bp.route("/api/employees", methods=["GET"])
def get_employees():
    page = request.args.get("page", type=int)
    page_size = request.args.get("page_size", type=int)
    search = request.args.get("search", "", type=str).strip()

    query = Employee.query

    if search:
        like = f"%{search }%"
        clean_phone = "".join(ch for ch in search if ch.isdigit())
        from sqlalchemy import or_

        filters = [
            Employee.first_name.ilike(like),
            Employee.last_name.ilike(like),
            Employee.middle_name.ilike(like),
        ]
        if clean_phone:
            filters.append(Employee.phone.ilike(f"%{clean_phone }%"))
        query = query.filter(or_(*filters))

    if page is None or page_size is None:
        employees = query.all()
        return jsonify([e.to_dict() for e in employees])

    total = query.count()
    items = (
        query.order_by(Employee.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return jsonify(
        {
            "items": [e.to_dict() for e in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@bp.route("/api/employees", methods=["POST"])
def create_employee():
    data = request.json

    existing = Employee.query.filter_by(phone=data["phone"]).first()
    if existing:
        return jsonify({"error": "Сотрудник с таким телефоном уже существует"}), 400

    position = Position.query.get(data["position_id"])
    if not position:
        return jsonify({"error": "Должность не найдена"}), 404

    if data["salary_type"] not in ["fixed", "piecework"]:
        return (
            jsonify(
                {"error": "Неверный тип зарплаты. Используйте fixed или piecework"}
            ),
            400,
        )

    employee = Employee(
        first_name=data["first_name"],
        last_name=data["last_name"],
        middle_name=data.get("middle_name"),
        phone=data["phone"],
        position_id=data["position_id"],
        salary_type=data["salary_type"],
    )
    db.session.add(employee)
    db.session.commit()
    return jsonify(employee.to_dict()), 201


@bp.route("/api/employees/<int:id>", methods=["PUT"])
def update_employee(id):
    employee = Employee.query.get_or_404(id)
    data = request.json

    if "phone" in data:
        existing = Employee.query.filter(
            Employee.phone == data["phone"], Employee.id != id
        ).first()
        if existing:
            return jsonify({"error": "Сотрудник с таким телефоном уже существует"}), 400
        employee.phone = data["phone"]

    new_position_obj = None
    if "position_id" in data:
        new_position_obj = Position.query.get(data["position_id"])
        if not new_position_obj:
            return jsonify({"error": "Должность не найдена"}), 404
        employee.position_id = data["position_id"]

    if "salary_type" in data:
        if data["salary_type"] not in ["fixed", "piecework"]:
            return (
                jsonify(
                    {"error": "Неверный тип зарплаты. Используйте fixed или piecework"}
                ),
                400,
            )
        employee.salary_type = data["salary_type"]

    if "first_name" in data:
        employee.first_name = data["first_name"]
    if "last_name" in data:
        employee.last_name = data["last_name"]
    if "middle_name" in data:
        employee.middle_name = data["middle_name"]

    linked_user = User.query.filter_by(employee_id=employee.id).first()
    user_action = None
    deleted_admin_schedules_count = 0
    if linked_user:
        new_full_name = f"{employee .last_name } {employee .first_name } {employee .middle_name or ''}".strip()
        linked_user.full_name = new_full_name

        if linked_user.role != "owner":

            effective_position = (
                new_position_obj if "position_id" in data else employee.position
            )

            if not effective_position or not effective_position.can_manage_system:

                today = datetime.now().date()
                deleted_admin_schedules_count = AdminSchedule.query.filter(
                    AdminSchedule.user_id == linked_user.id, AdminSchedule.date >= today
                ).delete(synchronize_session=False)

                past_admin_shifts = AdminSchedule.query.filter(
                    AdminSchedule.user_id == linked_user.id
                ).count()

                if past_admin_shifts == 0:
                    db.session.delete(linked_user)
                    user_action = "deleted"
                else:
                    linked_user.is_active = False
                    user_action = "deactivated"
            else:

                if not linked_user.is_active:
                    linked_user.is_active = True
                    user_action = "reactivated"

    db.session.commit()

    response = employee.to_dict()
    if user_action:
        msg_parts = []
        if user_action == "deleted":
            msg_parts.append("Учётная запись администратора удалена.")
        elif user_action == "deactivated":
            msg_parts.append(
                "Учётная запись администратора деактивирована (есть прошлые смены)."
            )
        elif user_action == "reactivated":
            msg_parts.append("Учётная запись администратора снова активна.")
        if deleted_admin_schedules_count > 0:
            msg_parts.append(
                f"Удалено {deleted_admin_schedules_count } будущих смен из расписания админов."
            )
        response["message"] = " ".join(msg_parts)
    return jsonify(response)


@bp.route("/api/employees/<int:id>", methods=["DELETE"])
def delete_employee(id):
    employee = Employee.query.get_or_404(id)

    linked_user = User.query.filter_by(employee_id=id).first()
    if linked_user and linked_user.role != "owner":
        AdminSchedule.query.filter_by(user_id=linked_user.id).delete(
            synchronize_session=False
        )
        db.session.delete(linked_user)

    db.session.delete(employee)
    db.session.commit()
    return "", 204


@bp.route("/api/employees/<int:id>/fire", methods=["POST"])
def fire_employee(id):
    employee = Employee.query.get_or_404(id)
    data = request.json

    fire_date_str = data.get("fire_date")
    if not fire_date_str:
        return jsonify({"error": "Требуется дата увольнения (fire_date)"}), 400

    try:
        fire_date = datetime.strptime(fire_date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Неверный формат даты. Используйте YYYY-MM-DD"}), 400

    employee.status = "fired"
    employee.fired_date = fire_date
    employee.sick_leave_start = None
    employee.sick_leave_end = None

    today = datetime.now().date()

    box_schedules_count = BoxSchedule.query.filter(
        BoxSchedule.employee_id == id, BoxSchedule.date >= today
    ).delete(synchronize_session=False)

    linked_user = User.query.filter_by(employee_id=id).first()
    deleted_user = False
    admin_schedules_count = 0
    if linked_user and linked_user.role != "owner":

        admin_schedules_count = AdminSchedule.query.filter(
            AdminSchedule.user_id == linked_user.id, AdminSchedule.date >= today
        ).delete(synchronize_session=False)

        past_admin_shifts = AdminSchedule.query.filter(
            AdminSchedule.user_id == linked_user.id
        ).count()

        if past_admin_shifts == 0:

            db.session.delete(linked_user)
            deleted_user = True
        else:

            linked_user.is_active = False
            deleted_user = False

    db.session.commit()

    msg_parts = ["Сотрудник уволен."]
    if box_schedules_count > 0:
        msg_parts.append(
            f"Удалено {box_schedules_count } будущих смен из расписания боксов."
        )
    if linked_user and linked_user.role != "owner":
        if admin_schedules_count > 0:
            msg_parts.append(
                f"Удалено {admin_schedules_count } будущих смен из расписания админов."
            )
        if deleted_user:
            msg_parts.append("Учётная запись администратора удалена.")
        else:
            msg_parts.append(
                "Учётная запись администратора деактивирована (есть прошлые смены)."
            )

    return jsonify({"message": " ".join(msg_parts), "employee": employee.to_dict()})


@bp.route("/api/employees/<int:id>/sick-leave", methods=["POST"])
def set_sick_leave(id):
    employee = Employee.query.get_or_404(id)
    data = request.json

    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")

    if not start_date_str or not end_date_str:
        return jsonify({"error": "Требуются даты начала и окончания больничного"}), 400

    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Неверный формат даты. Используйте YYYY-MM-DD"}), 400

    if end_date < start_date:
        return (
            jsonify({"error": "Дата окончания не может быть раньше даты начала"}),
            400,
        )

    employee.status = "sick_leave"
    employee.sick_leave_start = start_date
    employee.sick_leave_end = end_date

    sick_schedules = BoxSchedule.query.filter(
        BoxSchedule.employee_id == id,
        BoxSchedule.date >= start_date,
        BoxSchedule.date <= end_date,
    ).all()

    for schedule in sick_schedules:
        db.session.delete(schedule)

    linked_user = User.query.filter_by(employee_id=id).first()
    admin_schedules_count = 0
    if linked_user and linked_user.role != "owner":
        admin_schedules_count = AdminSchedule.query.filter(
            AdminSchedule.user_id == linked_user.id,
            AdminSchedule.date >= start_date,
            AdminSchedule.date <= end_date,
        ).delete(synchronize_session=False)

    db.session.commit()

    msg_parts = [
        "Сотрудник отправлен на больничный.",
        f"Удалено {len (sick_schedules )} назначений из расписания боксов.",
    ]
    if admin_schedules_count > 0:
        msg_parts.append(
            f"Удалено {admin_schedules_count } смен из расписания админов."
        )

    return jsonify({"message": " ".join(msg_parts), "employee": employee.to_dict()})


@bp.route("/api/employees/<int:id>/activate", methods=["POST"])
def activate_employee(id):
    employee = Employee.query.get_or_404(id)

    was_fired = employee.status == "fired"

    employee.status = "active"
    employee.sick_leave_start = None
    employee.sick_leave_end = None
    employee.fired_date = None

    if was_fired:
        linked_user = User.query.filter_by(employee_id=id).first()
        if linked_user and not linked_user.is_active and linked_user.role != "owner":
            linked_user.is_active = True

    db.session.commit()

    if was_fired:
        msg = "Сотрудник возвращён в штат."
    else:
        msg = "Сотрудник возвращён к работе."

    return jsonify({"message": msg, "employee": employee.to_dict()})
