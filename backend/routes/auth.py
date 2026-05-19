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
from models import AdminSchedule, Employee, User

bp = Blueprint("auth", __name__)


@bp.route("/api/auth/login", methods=["POST"])
def auth_login():
    """Вход в систему. Возвращает JWT-токен и данные пользователя.

    Для админов проверяется расписание смен — войти можно только в назначенное время.
    Владелец может входить всегда.
    """
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

    # Проверка расписания для админов
    if user.role == "admin":
        check = _check_admin_schedule(user.id)
        if not check["allowed"]:
            return jsonify(
                {"error": check["message"], "next_shift": check.get("next_shift")}
            ), 403

    user.last_login = datetime.now()
    db.session.commit()

    token = _generate_token(user)
    return jsonify({"token": token, "user": user.to_dict()})


@bp.route("/api/auth/me", methods=["GET"])
@login_required
def auth_me():
    """Получить данные текущего пользователя по токену."""
    return jsonify(request.current_user.to_dict())


@bp.route("/api/auth/admins-list", methods=["GET"])
@permission_required("can_view_admin_schedule")
def list_admins_for_schedule():
    """Список активных админов для отображения в расписании смен.

    Доступно тем, у кого есть право can_view_admin_schedule (включая владельца).
    Возвращает только id, login, full_name — без чувствительных полей.
    """
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


@bp.route("/api/auth/change-password", methods=["POST"])
@login_required
def change_own_password():
    """Смена своего пароля любым авторизованным пользователем (включая владельца)."""
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
