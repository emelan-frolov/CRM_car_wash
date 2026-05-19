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


@bp.route("/api/services", methods=["GET"])
def get_services():
    page = request.args.get("page", type=int)
    page_size = request.args.get("page_size", type=int)
    search = request.args.get("search", "", type=str).strip()

    query = Service.query.filter_by(is_active=True)

    if search:
        query = query.filter(Service.name.ilike(f"%{search}%"))

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
    data = request.json
    service = Service(
        name=data["name"],
        description=data.get("description"),
        price=data["price"],
        duration=data.get("duration"),
        washer_percentage=data.get("washer_percentage", 0),
    )
    db.session.add(service)
    db.session.flush()
    _record_service_price_history(service)
    db.session.commit()
    return jsonify(service.to_dict()), 201


@bp.route("/api/services/<int:id>", methods=["PUT"])
def update_service(id):
    service = Service.query.get_or_404(id)
    data = request.json
    old_price = service.price
    old_washer_percentage = service.washer_percentage

    service.name = data.get("name", service.name)
    service.description = data.get("description", service.description)
    service.price = data.get("price", service.price)
    service.duration = data.get("duration", service.duration)
    if "washer_percentage" in data:
        service.washer_percentage = data["washer_percentage"]

    price_changed = (
        float(old_price or 0) != float(service.price or 0)
        or float(old_washer_percentage or 0) != float(service.washer_percentage or 0)
    )
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
    # Обработка preflight запроса
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "DELETE, OPTIONS")
        response.headers.add(
            "Access-Control-Allow-Headers", "Content-Type, Authorization"
        )
        return response, 200

    service = Service.query.get_or_404(id)

    # Мягкое удаление - просто помечаем как неактивную
    service.is_active = False
    db.session.commit()
    return "", 204
