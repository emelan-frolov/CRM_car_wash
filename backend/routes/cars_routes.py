from flask import Blueprint, jsonify, request

from extensions import db
from models import Car


bp = Blueprint("cars", __name__)


@bp.route("/api/cars", methods=["GET"])
def get_cars():
    page = request.args.get("page", type=int)
    page_size = request.args.get("page_size", type=int)
    search = request.args.get("search", "", type=str).strip()

    query = Car.query.filter_by(is_active=True)

    if search:
        like = f"%{search }%"
        from sqlalchemy import or_

        query = query.filter(
            or_(
                Car.license_plate.ilike(like),
                Car.brand.ilike(like),
                Car.model.ilike(like),
            )
        )

    if page is None or page_size is None:
        cars = query.all()
        return jsonify([c.to_dict() for c in cars])

    total = query.count()
    items = (
        query.order_by(Car.id.desc())
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


@bp.route("/api/cars/search", methods=["GET"])
def search_car():
    license_plate = request.args.get("license_plate")
    if not license_plate:
        return jsonify({"error": "License plate required"}), 400

    car = Car.query.filter_by(
        license_plate=license_plate.upper(), is_active=True
    ).first()
    if car:
        return jsonify(car.to_dict())
    return jsonify({"found": False}), 404


@bp.route("/api/cars", methods=["POST"])
def create_car():
    data = request.json

    print(f"\n=== СОЗДАНИЕ АВТОМОБИЛЯ ===")
    print(f"Входные данные: {data }")

    license_plate_input = data.get("license_plate")
    if not license_plate_input:
        return jsonify({"error": "License plate is required"}), 400

    license_plate = license_plate_input.upper()

    try:

        existing_active = Car.query.filter_by(
            license_plate=license_plate, is_active=True
        ).first()
        if existing_active:
            print(
                f"Найден активный автомобиль ID={existing_active .id } с номером {license_plate }"
            )
            return (
                jsonify(
                    {
                        "error": f"Автомобиль с номером {license_plate } уже существует в системе",
                        "existing_car": existing_active.to_dict(),
                    }
                ),
                409,
            )

        print(f"Создание нового автомобиля с номером {license_plate }")
        car = Car(
            license_plate=license_plate,
            brand=data.get("brand"),
            model=data.get("model"),
            color=data.get("color"),
        )
        db.session.add(car)
        db.session.commit()
        print(f"Автомобиль создан успешно: ID={car .id }")
        print("=== КОНЕЦ ===\n")
        return jsonify(car.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        print(f" ОШИБКА создания автомобиля: {e }")
        print(f"Тип ошибки: {type (e ).__name__ }")
        import traceback

        traceback.print_exc()
        print("=== КОНЕЦ ===\n")

        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return (
                jsonify(
                    {
                        "error": f"Автомобиль с номером {license_plate } уже существует в системе"
                    }
                ),
                400,
            )

        return jsonify({"error": f"Ошибка создания автомобиля: {str (e )}"}), 500


@bp.route("/api/cars/<int:id>", methods=["PUT"])
def update_car(id):
    car = Car.query.get_or_404(id)
    data = request.json

    if "license_plate" in data:
        new_plate = data["license_plate"].upper()

        existing = Car.query.filter(
            Car.license_plate == new_plate, Car.is_active == True, Car.id != id
        ).first()
        if existing:
            return (
                jsonify({"error": f"Автомобиль с номером {new_plate } уже существует"}),
                400,
            )
        car.license_plate = new_plate

    car.brand = data.get("brand", car.brand)
    car.model = data.get("model", car.model)
    car.color = data.get("color", car.color)
    db.session.commit()
    return jsonify(car.to_dict())


@bp.route("/api/cars/<int:id>", methods=["DELETE"])
def delete_car(id):
    car = Car.query.get_or_404(id)

    original_plate = car.license_plate
    car.is_active = False
    db.session.commit()

    print(f"Автомобиль ID={id } мягко удален. Номер сохранен: {original_plate }")
    return "", 204
