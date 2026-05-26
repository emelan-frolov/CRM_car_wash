from datetime import datetime

from flask import Blueprint, jsonify, request

from auth import (
    _check_admin_schedule,
    _generate_token,
    login_required,
    owner_required,
    permission_required,
)
from extensions import db
from models import AdminSchedule, Employee, ServicePriceHistory, User


bp = Blueprint("auth", __name__)


@bp.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.json or {}
    login = (data.get("login") or "").strip()
    password = data.get("password") or ""

    if not login or not password:
        return jsonify({"error": "Логин и пароль обязательны"}), 400

    user = User.query.filter_by(login=login).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Неверный логин или пароль"}), 401

    if not user.is_active:
        return jsonify({"error": "Учётная запись деактивирована"}), 403

    if user.role == "admin":
        check = _check_admin_schedule(user.id)
        if not check["allowed"]:
            return (
                jsonify(
                    {"error": check["message"], "next_shift": check.get("next_shift")}
                ),
                403,
            )

    user.last_login = datetime.now()
    db.session.commit()

    token = _generate_token(user)
    return jsonify({"token": token, "user": user.to_dict()})


@bp.route("/api/auth/me", methods=["GET"])
@login_required
def auth_me():
    return jsonify(request.current_user.to_dict())


@bp.route("/api/auth/admins-list", methods=["GET"])
@permission_required("can_view_admin_schedule")
def list_admins_for_schedule():
    admins = User.query.filter_by(role="admin", is_active=True).all()
    return jsonify(
        [
            {
                "id": u.id,
                "login": u.login,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
            }
            for u in admins
        ]
    )


@bp.route("/api/auth/users", methods=["GET"])
@owner_required
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@bp.route("/api/auth/users", methods=["POST"])
@owner_required
def create_user():
    data = request.json or {}
    login = (data.get("login") or "").strip()
    password = data.get("password") or ""
    employee_id = data.get("employee_id")

    if not login or not password or not employee_id:
        return jsonify({"error": "Логин, пароль и сотрудник обязательны"}), 400

    if len(password) < 6:
        return jsonify({"error": "Пароль должен быть не короче 6 символов"}), 400

    if len(login) < 3:
        return jsonify({"error": "Логин должен быть не короче 3 символов"}), 400

    if User.query.filter_by(login=login).first():
        return jsonify({"error": "Пользователь с таким логином уже существует"}), 409

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({"error": "Сотрудник не найден"}), 404

    if not employee.position or not employee.position.can_manage_system:
        return (
            jsonify(
                {"error": "У должности этого сотрудника нет права управления системой"}
            ),
            400,
        )

    if employee.status != "active":
        return (
            jsonify({"error": "Нельзя создать админа из неактивного сотрудника"}),
            400,
        )

    existing_user = User.query.filter_by(employee_id=employee_id).first()
    if existing_user:
        return (
            jsonify(
                {
                    "error": f"У этого сотрудника уже есть учётная запись: {existing_user .login }"
                }
            ),
            409,
        )

    full_name = f"{employee .last_name } {employee .first_name } {employee .middle_name or ''}".strip()

    user = User(
        login=login,
        full_name=full_name,
        role="admin",
        is_active=True,
        employee_id=employee_id,
        can_view_statistics=bool(data.get("can_view_statistics", False)),
        can_view_admin_schedule=bool(data.get("can_view_admin_schedule", False)),
        can_view_positions=bool(data.get("can_view_positions", False)),
        can_view_employees=bool(data.get("can_view_employees", False)),
        can_create_employees=bool(data.get("can_create_employees", False)),
        can_edit_employees=bool(data.get("can_edit_employees", False)),
        can_fire_employees=bool(data.get("can_fire_employees", False)),
        can_edit_services=bool(data.get("can_edit_services", False)),
        can_view_services=bool(data.get("can_view_services", False)),
        can_create_services=bool(data.get("can_create_services", False)),
        can_delete_services=bool(data.get("can_delete_services", False)),
        can_create_positions=bool(data.get("can_create_positions", False)),
        can_edit_positions=bool(data.get("can_edit_positions", False)),
        can_delete_positions=bool(data.get("can_delete_positions", False)),
        can_export_orders=bool(data.get("can_export_orders", False)),
        can_view_box_schedule=bool(data.get("can_view_box_schedule", False)),
        can_edit_box_schedule=bool(data.get("can_edit_box_schedule", False)),
        can_edit_admin_schedule=bool(data.get("can_edit_admin_schedule", False)),
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify(user.to_dict()), 201


@bp.route("/api/auth/eligible-employees", methods=["GET"])
@owner_required
def list_eligible_employees():
    from sqlalchemy.orm import joinedload

    used_ids = {
        u.employee_id for u in User.query.filter(User.employee_id.isnot(None)).all()
    }

    employees = (
        Employee.query.options(joinedload(Employee.position))
        .filter(Employee.status == "active")
        .all()
    )

    result = []
    for emp in employees:
        if emp.id in used_ids:
            continue
        if not emp.position or not emp.position.can_manage_system:
            continue
        result.append(
            {
                "id": emp.id,
                "full_name": f"{emp .last_name } {emp .first_name } {emp .middle_name or ''}".strip(),
                "phone": emp.phone,
                "position_id": emp.position_id,
                "position_name": emp.position.name,
            }
        )

    return jsonify(result)


@bp.route("/api/auth/users/<int:user_id>", methods=["DELETE"])
@owner_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)

    if user.role == "owner":
        return jsonify({"error": "Нельзя удалить владельца"}), 400

    if user.id == request.current_user.id:
        return jsonify({"error": "Нельзя удалить себя"}), 400

    try:
        AdminSchedule.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        ServicePriceHistory.query.filter_by(changed_by_user_id=user_id).update(
            {"changed_by_user_id": None}, synchronize_session=False
        )

        db.session.delete(user)
        db.session.commit()
        return "", 204
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Ошибка удаления пользователя: {str(e)}"}), 500


@bp.route("/api/auth/users/<int:user_id>/toggle-active", methods=["POST"])
@owner_required
def toggle_user_active(user_id):
    user = User.query.get_or_404(user_id)

    if user.role == "owner":
        return jsonify({"error": "Нельзя деактивировать владельца"}), 400

    if user.id == request.current_user.id:
        return jsonify({"error": "Нельзя деактивировать себя"}), 400

    user.is_active = not user.is_active
    db.session.commit()
    return jsonify(user.to_dict())


@bp.route("/api/auth/change-password", methods=["POST"])
@login_required
def change_own_password():
    user = request.current_user
    data = request.json or {}

    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password or not new_password:
        return jsonify({"error": "Текущий и новый пароль обязательны"}), 400

    if not user.check_password(current_password):
        return jsonify({"error": "Текущий пароль введён неверно"}), 401

    if len(new_password) < 6:
        return jsonify({"error": "Новый пароль должен быть не короче 6 символов"}), 400

    if current_password == new_password:
        return jsonify({"error": "Новый пароль должен отличаться от текущего"}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"ok": True, "message": "Пароль успешно изменён"})


@bp.route("/api/auth/users/<int:user_id>/reset-password", methods=["POST"])
@owner_required
def reset_user_password(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    new_password = data.get("password") or ""

    if len(new_password) < 6:
        return jsonify({"error": "Пароль должен быть не короче 6 символов"}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"ok": True})


@bp.route("/api/auth/users/<int:user_id>/permissions", methods=["PUT"])
@owner_required
def update_user_permissions(user_id):
    user = User.query.get_or_404(user_id)

    if user.role == "owner":
        return jsonify({"error": "Владелец имеет все права автоматически"}), 400

    data = request.json or {}

    permission_fields = [
        "can_view_statistics",
        "can_view_admin_schedule",
        "can_view_positions",
        "can_edit_positions",
        "can_delete_positions",
        "can_create_positions",
        "can_view_employees",
        "can_create_employees",
        "can_edit_employees",
        "can_fire_employees",
        "can_edit_services",
        "can_view_services",
        "can_create_services",
        "can_delete_services",
        "can_export_orders",
        "can_view_box_schedule",
        "can_edit_box_schedule",
        "can_edit_admin_schedule",
    ]
    for field in permission_fields:
        if field in data:
            setattr(user, field, bool(data[field]))

    db.session.commit()
    return jsonify(user.to_dict())
