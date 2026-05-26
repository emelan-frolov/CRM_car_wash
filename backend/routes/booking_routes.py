from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from extensions import db
from models import Box, BoxSchedule, Car, Client, Order, OrderService, Service


bp = Blueprint("booking", __name__)


@bp.route("/api/booking/availability", methods=["GET"])
def get_booking_availability():
    from datetime import timedelta

    start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = start_date + timedelta(days=30)

    orders = Order.query.filter(
        Order.scheduled_time >= start_date,
        Order.scheduled_time < end_date,
        Order.status.in_(["pending", "in_progress"]),
    ).all()

    active_boxes_count = Box.query.filter_by(is_active=True).count()
    if active_boxes_count == 0:
        return jsonify({"error": "Нет активных боксов"}), 400

    slots_per_day_per_box = 48
    total_slots_per_day = slots_per_day_per_box * active_boxes_count

    daily_stats = {}
    for order in orders:
        if not order.scheduled_time or not order.total_duration:
            continue

        date_key = order.scheduled_time.date().isoformat()
        if date_key not in daily_stats:
            daily_stats[date_key] = {
                "date": date_key,
                "orders_count": 0,
                "total_duration": 0,
                "occupied_slots": 0,
            }

        daily_stats[date_key]["orders_count"] += 1
        daily_stats[date_key]["total_duration"] += order.total_duration

        daily_stats[date_key]["occupied_slots"] += (order.total_duration + 14) // 15

    result = []
    current_date = start_date
    for i in range(30):
        date_key = current_date.date().isoformat()
        stats = daily_stats.get(
            date_key,
            {
                "date": date_key,
                "orders_count": 0,
                "total_duration": 0,
                "occupied_slots": 0,
            },
        )

        occupancy_percent = (
            (stats["occupied_slots"] / total_slots_per_day * 100)
            if total_slots_per_day > 0
            else 0
        )

        if occupancy_percent >= 80:
            load_level = "high"
        elif occupancy_percent >= 50:
            load_level = "medium"
        else:
            load_level = "low"

        result.append(
            {
                "date": date_key,
                "day_of_week": current_date.strftime("%A"),
                "orders_count": stats["orders_count"],
                "occupied_slots": stats["occupied_slots"],
                "total_slots": total_slots_per_day,
                "occupancy_percent": round(occupancy_percent, 1),
                "load_level": load_level,
                "is_past": current_date.date() < datetime.now().date(),
            }
        )

        current_date += timedelta(days=1)

    return jsonify(result)


@bp.route("/api/booking/timeslots", methods=["POST"])
def get_available_timeslots():
    data = request.json
    date_str = data.get("date")
    total_duration = data.get("total_duration")

    if not date_str or not total_duration:
        return jsonify({"error": "Требуются date и total_duration"}), 400

    try:
        selected_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Неверный формат даты"}), 400

    if selected_date < datetime.now().date():
        return jsonify({"error": "Нельзя записаться на прошедшую дату"}), 400

    boxes = Box.query.filter_by(is_active=True).all()
    if not boxes:
        return jsonify({"error": "Нет активных боксов"}), 400

    work_start_hour = 10
    work_end_hour = 22

    start_datetime = datetime.combine(selected_date, datetime.min.time())
    end_datetime = datetime.combine(selected_date, datetime.max.time())

    orders = Order.query.filter(
        Order.scheduled_time >= start_datetime,
        Order.scheduled_time <= end_datetime,
        Order.status.in_(["pending", "in_progress"]),
    ).all()

    occupied = {}
    for order in orders:
        if not order.scheduled_time or not order.total_duration or not order.box_id:
            continue

        order_start = order.scheduled_time
        order_end = order_start + timedelta(minutes=order.total_duration)

        current = order_start
        while current < order_end:
            key = (order.box_id, current.hour, current.minute)
            occupied[key] = True
            current += timedelta(minutes=15)

    available_slots = []

    for hour in range(work_start_hour, work_end_hour):
        for minute in [0, 15, 30, 45]:
            slot_time = f"{hour :02d}:{minute :02d}"

            free_boxes = []
            for box in boxes:

                is_free = True
                check_datetime = datetime.combine(
                    selected_date, datetime.strptime(slot_time, "%H:%M").time()
                )
                end_check = check_datetime + timedelta(minutes=total_duration)

                if end_check.hour > work_end_hour or (
                    end_check.hour == work_end_hour and end_check.minute > 0
                ):
                    is_free = False
                else:

                    current = check_datetime
                    while current < end_check:
                        if (box.id, current.hour, current.minute) in occupied:
                            is_free = False
                            break
                        current += timedelta(minutes=15)

                if is_free:
                    free_boxes.append({"id": box.id, "name": box.name})

            if free_boxes:
                available_slots.append(
                    {
                        "time": slot_time,
                        "available_boxes": free_boxes,
                        "boxes_count": len(free_boxes),
                    }
                )

    return jsonify(
        {
            "date": date_str,
            "total_duration": total_duration,
            "available_slots": available_slots,
            "total_boxes": len(boxes),
        }
    )


@bp.route("/api/public/current-occupancy", methods=["GET"])
def public_current_occupancy():
    from datetime import time as time_cls

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
                status_detail = f"до {free_at .strftime ('%H:%M')}"
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
                "upcoming_at": (
                    upcoming_order.scheduled_time.strftime("%H:%M")
                    if upcoming_order and upcoming_order.scheduled_time
                    else None
                ),
            }
        )

    return jsonify(result)


@bp.route("/api/public/book", methods=["POST"])
def public_book():
    import re as _re

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
    try:
        service_ids = [int(service_id) for service_id in service_ids]
    except (TypeError, ValueError):
        return jsonify({"error": "Некорректный список услуг"}), 400
    service_ids = list(dict.fromkeys(service_ids))

    box_id = data.get("box_id")
    scheduled_time_str = data.get("scheduled_time", "")
    notes = data.get("notes", "")

    if not box_id:
        return jsonify({"error": "Выберите бокс"}), 400

    if not scheduled_time_str:
        return jsonify({"error": "Укажите дату и время"}), 400

    try:
        scheduled_time = datetime.fromisoformat(scheduled_time_str)
    except (ValueError, TypeError):
        return jsonify({"error": "Неверный формат даты/времени"}), 400

    if scheduled_time <= datetime.now():
        return jsonify({"error": "Нельзя записаться на прошедшее время"}), 400

    if scheduled_time.minute % 15 != 0 or scheduled_time.second != 0:
        return jsonify({"error": "Время записи должно быть кратно 15 минутам"}), 400

    services = Service.query.filter(
        Service.id.in_(service_ids), Service.is_active == True
    ).all()
    if len(services) != len(service_ids):
        return jsonify({"error": "Одна или несколько услуг не найдены или неактивны"}), 400

    total_price = sum(s.price for s in services)
    total_duration = sum(s.duration or 0 for s in services)
    if total_duration <= 0:
        return jsonify({"error": "Не удалось определить длительность услуг"}), 400

    box = Box.query.filter_by(id=box_id, is_active=True).with_for_update().first()
    if not box:
        return jsonify({"error": "Бокс не найден или неактивен"}), 404

    order_end = scheduled_time + timedelta(minutes=total_duration)
    existing_orders = Order.query.filter(
        Order.box_id == box_id,
        Order.status.in_(["pending", "in_progress"]),
        Order.scheduled_time.isnot(None),
    ).all()

    for existing in existing_orders:
        existing_end = existing.scheduled_time + timedelta(
            minutes=existing.total_duration or 0
        )
        if scheduled_time < existing_end and order_end > existing.scheduled_time:
            db.session.rollback()
            return jsonify({"error": "Выбранное время уже занято"}), 409

    client = Client.query.filter_by(phone=phone, is_active=True).first()
    if not client:
        client = Client(first_name="-", last_name="Клиент", phone=phone, is_active=True)
        db.session.add(client)
        db.session.flush()

    car = Car.query.filter_by(license_plate=license_plate, is_active=True).first()
    if not car:
        car = Car(license_plate=license_plate, is_active=True)
        db.session.add(car)
        db.session.flush()

    order = Order(
        client_id=client.id,
        car_id=car.id,
        box_id=box_id,
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
    return (
        jsonify(
            {
                "success": True,
                "order_id": order.id,
                "message": "Запись успешно создана! Ждём вас.",
            }
        ),
        201,
    )
