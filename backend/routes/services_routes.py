from flask import Blueprint, jsonify, request

from auth import _get_current_user
from extensions import db
from models import OrderService, Service, ServicePriceHistory


bp = Blueprint("services", __name__)


def _record_service_price_history(service, old_price=None, old_washer_percentage=None):
    current_user = _get_current_user()
    db.session.add(
        ServicePriceHistory(
            service_id=service.id,
            old_price=old_price,
            new_price=service.price,
            old_washer_percentage=old_washer_percentage,
            new_washer_percentage=service.washer_percentage,
            changed_by_user_id=current_user.id if current_user else None,
        )
    )


def _prepare_service_payload(data, service=None):
    data = data or {}
    payload = {}

    if service is None or "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return None, "Название услуги обязательно"
        payload["name"] = name

    if service is None or "price" in data:
        try:
            price = float(data.get("price"))
        except (TypeError, ValueError):
            return None, "Стоимость услуги должна быть числом"
        if price <= 0:
            return None, "Стоимость услуги должна быть больше 0"
        payload["price"] = price

    if "duration" in data:
        duration_value = data.get("duration")
        if duration_value in (None, ""):
            payload["duration"] = None
        else:
            try:
                duration = int(duration_value)
            except (TypeError, ValueError):
                return None, "Длительность услуги должна быть целым числом"
            if duration <= 0 or duration % 15 != 0:
                return None, "Длительность услуги должна быть положительной и кратной 15 минутам"
            payload["duration"] = duration
    elif service is None:
        payload["duration"] = None

    if "washer_percentage" in data:
        try:
            washer_percentage = float(data.get("washer_percentage") or 0)
        except (TypeError, ValueError):
            return None, "Процент выплаты должен быть числом"
        if washer_percentage < 0 or washer_percentage > 100:
            return None, "Процент выплаты должен быть от 0 до 100"
        payload["washer_percentage"] = washer_percentage
    elif service is None:
        payload["washer_percentage"] = 0

    if "description" in data:
        payload["description"] = data.get("description")
    elif service is None:
        payload["description"] = None

    return payload, None


@bp.route("/api/services", methods=["GET"])
def get_services():
    page = request.args.get("page", type=int)
    page_size = request.args.get("page_size", type=int)
    search = request.args.get("search", "", type=str).strip()

    query = Service.query.filter_by(is_active=True)

    if search:
        query = query.filter(Service.name.ilike(f"%{search }%"))

    if page is None or page_size is None:
        services = query.all()
        return jsonify([s.to_dict() for s in services])

    total = query.count()
    items = (
        query.order_by(Service.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return jsonify(
        {
            "items": [s.to_dict() for s in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@bp.route("/api/services", methods=["POST"])
def create_service():
    payload, error = _prepare_service_payload(request.json)
    if error:
        return jsonify({"error": error}), 400

    service = Service(
        name=payload["name"],
        description=payload["description"],
        price=payload["price"],
        duration=payload["duration"],
        washer_percentage=payload["washer_percentage"],
    )
    db.session.add(service)
    db.session.flush()
    _record_service_price_history(service)
    db.session.commit()
    return jsonify(service.to_dict()), 201


@bp.route("/api/services/<int:id>", methods=["PUT"])
def update_service(id):
    service = Service.query.get_or_404(id)
    payload, error = _prepare_service_payload(request.json, service)
    if error:
        return jsonify({"error": error}), 400

    old_price = service.price
    old_washer_percentage = service.washer_percentage

    for key, value in payload.items():
        setattr(service, key, value)

    price_changed = float(old_price or 0) != float(service.price or 0) or float(
        old_washer_percentage or 0
    ) != float(service.washer_percentage or 0)
    if price_changed:
        _record_service_price_history(
            service,
            old_price=old_price,
            old_washer_percentage=old_washer_percentage,
        )

    db.session.commit()
    return jsonify(service.to_dict())


@bp.route("/api/services/<int:id>", methods=["DELETE", "OPTIONS"])
def delete_service(id):

    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "DELETE, OPTIONS")
        response.headers.add(
            "Access-Control-Allow-Headers", "Content-Type, Authorization"
        )
        return response, 200

    print(f"\n=== МЯГКОЕ УДАЛЕНИЕ УСЛУГИ ===")
    print(f"ID услуги: {id }")
    service = Service.query.get_or_404(id)
    print(f"Найдена услуга: {service .name }")

    orders_count = OrderService.query.filter_by(service_id=id).count()
    print(f"Услуга используется в {orders_count } заказах")

    service.is_active = False
    db.session.commit()
    print(f"Услуга помечена как неактивная (мягкое удаление)")
    print("=== КОНЕЦ ===\n")
    return "", 204
