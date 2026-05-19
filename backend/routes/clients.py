from flask import Blueprint, jsonify, request

from extensions import db
from models import Client

bp = Blueprint("clients", __name__)


@bp.route("/api/clients", methods=["GET"])
def get_clients():
    page = request.args.get("page", type=int)
    page_size = request.args.get("page_size", type=int)
    search = request.args.get("search", "", type=str).strip()

    query = Client.query.filter_by(is_active=True)

    if search:
        # Поиск по ФИО или телефону
        like = f"%{search}%"
        clean_phone = "".join(ch for ch in search if ch.isdigit())
        filters = [
            Client.first_name.ilike(like),
            Client.last_name.ilike(like),
            Client.middle_name.ilike(like),
        ]
        if clean_phone:
            filters.append(Client.phone.ilike(f"%{clean_phone}%"))
        from sqlalchemy import or_

        query = query.filter(or_(*filters))

    # Если параметры пагинации не переданы - возвращаем всё (для совместимости)
    if page is None or page_size is None:
        clients = query.all()
        return jsonify([c.to_dict() for c in clients])

    total = query.count()
    items = (
        query.order_by(Client.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return jsonify(
        {
            "items": [c.to_dict() for c in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@bp.route("/api/clients/search", methods=["GET"])
def search_client():
    phone = request.args.get("phone")
    if not phone:
        return jsonify({"error": "Phone number required"}), 400

    client = Client.query.filter_by(phone=phone, is_active=True).first()
    if client:
        return jsonify(client.to_dict())
    return jsonify({"found": False}), 404


@bp.route("/api/clients", methods=["POST"])
def create_client():
    data = request.json

    phone = data.get("phone")
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400

    try:
        # Проверка существования активного клиента с таким телефоном
        existing_active = Client.query.filter_by(phone=phone, is_active=True).first()
        if existing_active:
            return jsonify(
                {
                    "error": f"Клиент с телефоном {phone} уже существует в системе",
                    "existing_client": existing_active.to_dict(),
                }
            ), 409

        client = Client(
            first_name=data["first_name"],
            last_name=data["last_name"],
            middle_name=data.get("middle_name"),
            phone=phone,
            email=data.get("email"),
        )
        db.session.add(client)
        db.session.commit()
        return jsonify(client.to_dict()), 201

    except Exception as e:
        db.session.rollback()

        # Проверяем, не связана ли ошибка с уникальностью телефона
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return jsonify(
                {"error": f"Клиент с телефоном {phone} уже существует в системе"}
            ), 400

        return jsonify({"error": f"Ошибка создания клиента: {str(e)}"}), 500


@bp.route("/api/clients/<int:id>", methods=["PUT"])
def update_client(id):
    client = Client.query.get_or_404(id)
    data = request.json
    client.first_name = data.get("first_name", client.first_name)
    client.last_name = data.get("last_name", client.last_name)
    client.middle_name = data.get("middle_name", client.middle_name)
    client.phone = data.get("phone", client.phone)
    client.email = data.get("email", client.email)
    db.session.commit()
    return jsonify(client.to_dict())


@bp.route("/api/clients/<int:id>", methods=["DELETE"])
def delete_client(id):
    client = Client.query.get_or_404(id)
    client.is_active = False
    db.session.commit()
    return "", 204
