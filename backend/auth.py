from datetime import datetime, timedelta
from functools import wraps

import jwt
from flask import current_app, jsonify, request

from extensions import db
from models import AdminSchedule, User


def _generate_token(user):
    payload = {
        "user_id": user.id,
        "login": user.login,
        "role": user.role,
        "exp": datetime.utcnow()
        + timedelta(hours=current_app.config["JWT_EXPIRATION_HOURS"]),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def _decode_token(token):
    try:
        return jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def _get_current_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    payload = _decode_token(token)
    if not payload:
        return None
    user = User.query.get(payload.get("user_id"))
    if not user or not user.is_active:
        return None

    if user.role == "admin":
        check = _check_admin_schedule(user.id)
        if not check["allowed"]:
            return None

    return user


def login_required(f):

    @wraps(f)
    def wrapper(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({"error": "Требуется авторизация"}), 401
        request.current_user = user
        return f(*args, **kwargs)

    return wrapper


def owner_required(f):

    @wraps(f)
    def wrapper(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({"error": "Требуется авторизация"}), 401
        if user.role != "owner":
            return jsonify({"error": "Доступ только для владельца"}), 403
        request.current_user = user
        return f(*args, **kwargs)

    return wrapper


def permission_required(permission):

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = _get_current_user()
            if not user:
                return jsonify({"error": "Требуется авторизация"}), 401
            if not user.has_permission(permission):
                return jsonify({"error": "У вас нет прав на этот раздел"}), 403
            request.current_user = user
            return f(*args, **kwargs)

        return wrapper

    return decorator


def _check_admin_schedule(user_id):
    now = datetime.now()
    today = now.date()
    current_time = now.time().replace(microsecond=0)

    active = AdminSchedule.query.filter(
        AdminSchedule.user_id == user_id,
        AdminSchedule.date == today,
        AdminSchedule.start_time <= current_time,
        AdminSchedule.end_time > current_time,
    ).first()

    if active:
        return {
            "allowed": True,
            "shift_end": active.end_time.strftime("%H:%M"),
            "shift_date": active.date.isoformat(),
        }

    future = (
        AdminSchedule.query.filter(
            db.or_(
                db.and_(
                    AdminSchedule.date == today, AdminSchedule.start_time > current_time
                ),
                AdminSchedule.date > today,
            ),
            AdminSchedule.user_id == user_id,
        )
        .order_by(AdminSchedule.date, AdminSchedule.start_time)
        .first()
    )

    next_info = None
    if future:
        next_info = {
            "date": future.date.isoformat(),
            "start_time": future.start_time.strftime("%H:%M"),
            "end_time": future.end_time.strftime("%H:%M"),
        }
        message = f"Ваша следующая смена: {future .date .strftime ('%d.%m.%Y')} с {future .start_time .strftime ('%H:%M')} до {future .end_time .strftime ('%H:%M')}"
    else:
        message = "У вас нет назначенных смен. Обратитесь к владельцу."

    return {"allowed": False, "message": message, "next_shift": next_info}
