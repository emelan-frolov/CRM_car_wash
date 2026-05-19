import re as _re
from datetime import datetime, timedelta
from datetime import time as time_cls

from flask import Blueprint, jsonify, request

from extensions import db
from models import Box, BoxSchedule, Car, Client, Order, OrderService, Service

bp = Blueprint("public", __name__)


@bp.route("/api/public/current-occupancy", methods=["GET"])
def public_current_occupancy():
    """Текущая занятость боксов — публичный эндпоинт для клиентов."""
    today = datetime.now().date()
    now = datetime.now()

    boxes = Box.query.filter_by(is_active=True).order_by(Box.order_index).all()

    today_schedules = BoxSchedule.query.filter_by(date=today).all()
    boxes_with_workers = {s.box_id for s in today_schedules}

    result = []
    for box in boxes:
        has_worker = box.id in boxes_with_workers

        current_order = Order.query.filter(
            Order.box_id == box.id,
            Order.status == "in_progress",
        ).first()

        upcoming_order = (
            Order.query.filter(
                Order.box_id == box.id,
                Order.status == "pending",
                Order.scheduled_time >= now,
                Order.scheduled_time < datetime.combine(today, time_cls(23, 59)),
            )
            .order_by(Order.scheduled_time)
            .first()
        )

        if current_order:
            status = "busy"
            status_label = "Занят"
            if current_order.scheduled_time and current_order.total_duration:
                free_at = current_order.scheduled_time + timedelta(
                    minutes=current_order.total_duration
                )
                status_detail = f"до {free_at.strftime('%H:%M')}"
            else:
                status_detail = None
        elif has_worker:
            status = "free"
            status_label = "Свободен"
            status_detail = None
        else:
            status = "no_worker"
            status_label = "Закрыт"
            status_detail = None

        result.append(
            {
                "box_id": box.id,
                "box_name": box.name,
                "has_worker": has_worker,
                "status": status,
                "status_label": status_label,
                "status_detail": status_detail,
                "upcoming_at": upcoming_order.scheduled_time.strftime("%H:%M")
                if upcoming_order and upcoming_order.scheduled_time
                else None,
            }
        )

    return jsonify(result)


@bp.route("/api/public/book", methods=["POST"])
def public_book():
    """Создать запись от клиента — публичный эндпоинт."""
    data = request.json or {}

    phone = _re.sub(r"\D", "", data.get("phone", ""))
    if len(phone) < 10:
        return jsonify({"error": "Укажите корректный номер телефона"}), 400

    license_plate = (data.get("license_plate") or "").strip().upper()
    if not license_plate:
        return jsonify({"error": "Укажите гос. номер"}), 400

    service_ids = data.get("service_ids", [])
    if not service_ids:
        return jsonify({"error": "Выберите хотя бы одну услугу"}), 400

    box_id = data.get("box_id")
    scheduled_time_str = data.get("scheduled_time", "")
    notes = data.get("notes", "")

    if not scheduled_time_str:
        return jsonify({"error": "Укажите дату и время"}), 400

    try:
        scheduled_time = datetime.fromisoformat(scheduled_time_str)
    except (ValueError, TypeError):
        return jsonify({"error": "Неверный формат даты/времени"}), 400

    if scheduled_time <= datetime.now():
        return jsonify({"error": "Нельзя записаться на прошедшее время"}), 400

    # Найти или создать клиента
    client = Client.query.filter_by(phone=phone, is_active=True).first()
    if not client:
        client = Client(first_name="—", last_name="Клиент", phone=phone, is_active=True)
        db.session.add(client)
        db.session.flush()

    # Найти или создать автомобиль
    car = Car.query.filter_by(license_plate=license_plate, is_active=True).first()
    if not car:
        car = Car(license_plate=license_plate, is_active=True)
        db.session.add(car)
        db.session.flush()

    # Получить услуги
    services = Service.query.filter(
        Service.id.in_(service_ids), Service.is_active == True
    ).all()
    if not services:
        return jsonify({"error": "Услуги не найдены"}), 404

    total_price = sum(s.price for s in services)
    total_duration = sum(s.duration or 0 for s in services) or None

    order = Order(
        client_id=client.id,
        car_id=car.id,
        box_id=box_id if box_id else None,
        scheduled_time=scheduled_time,
        total_price=total_price,
        total_duration=total_duration,
        status="pending",
        notes=notes,
    )
    db.session.add(order)
    db.session.flush()

    for svc in services:
        db.session.add(
            OrderService(
                order_id=order.id,
                service_id=svc.id,
                service_price=svc.price,
                washer_percentage=svc.washer_percentage,
            )
        )

    db.session.commit()
    return jsonify(
        {
            "success": True,
            "order_id": order.id,
            "message": "Запись успешно создана! Ждём вас.",
        }
    ), 201
