from flask import Blueprint, jsonify, request

from auth import owner_required
from extensions import db
from models import AdminSchedule, Employee, User

bp = Blueprint("users", __name__)


@bp.route("/api/auth/users", methods=["GET"])
@owner_required
def list_users():
    """Список всех пользователей (только для владельца)."""
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@bp.route("/api/auth/users", methods=["POST"])
@owner_required
def create_user():
    """Создать нового администратора (только владелец).

    Принимает employee_id - ID сотрудника из таблицы employees,
    у которого должность с can_manage_system=True.
    """
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

    # Проверка уникальности логина
    if User.query.filter_by(login=login).first():
        return jsonify({"error": "Пользователь с таким логином уже существует"}), 409

    # Проверка сотрудника
    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({"error": "Сотрудник не найден"}), 404

    if not employee.position or not employee.position.can_manage_system:
        return jsonify(
            {"error": "У должности этого сотрудника нет права управления системой"}
        ), 400

    if employee.status != "active":
        return jsonify(
            {"error": "Нельзя создать админа из неактивного сотрудника"}
        ), 400

    # Проверка что у сотрудника ещё нет учётки
    existing_user = User.query.filter_by(employee_id=employee_id).first()
    if existing_user:
        return jsonify(
            {
                "error": f"У этого сотрудника уже есть учётная запись: {existing_user.login}"
            }
        ), 409

    full_name = f"{employee.last_name} {employee.first_name} {employee.middle_name or ''}".strip()

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
    """Список сотрудников, которые могут стать админами.

    Условия:
    - status = 'active'
    - position.can_manage_system = True
    - ещё нет учётной записи в users
    """
    from sqlalchemy.orm import joinedload

    # ID сотрудников, которые уже имеют учётку
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
                "full_name": f"{emp.last_name} {emp.first_name} {emp.middle_name or ''}".strip(),
                "phone": emp.phone,
                "position_id": emp.position_id,
                "position_name": emp.position.name,
            }
        )

    return jsonify(result)


@bp.route("/api/auth/users/<int:user_id>", methods=["DELETE"])
@owner_required
def delete_user(user_id):
    """Удалить администратора (только владелец, нельзя удалить владельца и себя).

    Каскадно удаляет все смены этого администратора.
    """
    user = User.query.get_or_404(user_id)

    if user.role == "owner":
        return jsonify({"error": "Нельзя удалить владельца"}), 400

    if user.id == request.current_user.id:
        return jsonify({"error": "Нельзя удалить себя"}), 400

    # Удаляем все смены этого админа (FK не позволит удалить юзера, пока есть смены)
    AdminSchedule.query.filter_by(user_id=user_id).delete(synchronize_session=False)

    db.session.delete(user)
    db.session.commit()
    return "", 204


@bp.route("/api/auth/users/<int:user_id>/toggle-active", methods=["POST"])
@owner_required
def toggle_user_active(user_id):
    """Активировать/деактивировать администратора."""
    user = User.query.get_or_404(user_id)

    if user.role == "owner":
        return jsonify({"error": "Нельзя деактивировать владельца"}), 400

    if user.id == request.current_user.id:
        return jsonify({"error": "Нельзя деактивировать себя"}), 400

    user.is_active = not user.is_active
    db.session.commit()
    return jsonify(user.to_dict())


@bp.route("/api/auth/users/<int:user_id>/reset-password", methods=["POST"])
@owner_required
def reset_user_password(user_id):
    """Сменить пароль пользователя (только владелец)."""
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
    """Обновить права администратора (только владелец)."""
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
