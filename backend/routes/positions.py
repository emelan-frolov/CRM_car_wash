from flask import Blueprint, jsonify, request

from extensions import db
from models import Position

bp = Blueprint("positions", __name__)


@bp.route("/api/positions", methods=["GET"])
def get_positions():
    positions = Position.query.all()
    return jsonify([position.to_dict() for position in positions])


@bp.route("/api/positions", methods=["POST"])
def create_position():
    data = request.json

    # Проверка на дубликат названия
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

    # Проверка на дубликат названия (кроме текущей должности)
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

    # Проверка что нет сотрудников с этой должностью
    if position.employees:
        return jsonify(
            {"error": "Невозможно удалить должность, есть сотрудники с этой должностью"}
        ), 400

    db.session.delete(position)
    db.session.commit()
    return "", 204
