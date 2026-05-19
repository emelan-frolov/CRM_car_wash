from flask import Blueprint, jsonify, request

from extensions import db
from models import Box, Settings

bp = Blueprint("boxes", __name__)


@bp.route("/api/boxes", methods=["GET"])
def get_boxes():
    boxes = Box.query.order_by(Box.order_index).all()
    return jsonify([box.to_dict() for box in boxes])


@bp.route("/api/boxes", methods=["POST"])
def create_box():
    data = request.json
    box = Box(
        name=data["name"],
        is_active=data.get("is_active", True),
        order_index=data.get("order_index", 0),
    )
    db.session.add(box)
    db.session.commit()
    return jsonify(box.to_dict()), 201


@bp.route("/api/boxes/<int:id>", methods=["PUT"])
def update_box(id):
    box = Box.query.get_or_404(id)
    data = request.json
    box.name = data.get("name", box.name)
    box.is_active = data.get("is_active", box.is_active)
    box.order_index = data.get("order_index", box.order_index)
    db.session.commit()
    return jsonify(box.to_dict())


@bp.route("/api/boxes/<int:id>", methods=["DELETE"])
def delete_box(id):
    box = Box.query.get_or_404(id)
    db.session.delete(box)
    db.session.commit()
    return "", 204


@bp.route("/api/settings", methods=["GET"])
def get_settings():
    settings = Settings.query.all()
    return jsonify({s.key: s.value for s in settings})


@bp.route("/api/settings", methods=["POST"])
def update_settings():
    data = request.json
    for key, value in data.items():
        setting = Settings.query.filter_by(key=key).first()
        if setting:
            setting.value = str(value)
        else:
            setting = Settings(key=key, value=str(value))
            db.session.add(setting)
    db.session.commit()
    return jsonify({"message": "Settings updated"})
