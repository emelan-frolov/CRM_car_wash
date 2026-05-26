from datetime import datetime, time, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import joinedload

from extensions import db
from models import Box, BoxSchedule, Client, Order, OrderService, Service


bp = Blueprint("orders", __name__)
BLOCKING_ORDER_STATUSES = ["pending", "in_progress", "completed"]


@bp.route("/api/orders", methods=["GET"])
def get_orders():
    page = request.args.get("page", type=int)
    page_size = request.args.get("page_size", type=int)
    search_name = request.args.get("search_name", "", type=str).strip()
    search_phone = request.args.get("search_phone", "", type=str).strip()

    query = Order.query

    if search_name or search_phone:
        from sqlalchemy import or_

        query = query.join(Client, Order.client_id == Client.id)

        if search_name:
            like = f"%{search_name }%"
            query = query.filter(
                or_(
                    Client.first_name.ilike(like),
                    Client.last_name.ilike(like),
                    Client.middle_name.ilike(like),
                )
            )

        if search_phone:
            clean_phone = "".join(ch for ch in search_phone if ch.isdigit())
            if clean_phone:
                query = query.filter(Client.phone.ilike(f"%{clean_phone }%"))

    if page is None or page_size is None:
        orders = query.all()
        return jsonify([o.to_dict() for o in orders])

    total = query.count()
    items = (
        query.order_by(Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return jsonify(
        {
            "items": [o.to_dict() for o in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@bp.route("/api/orders/schedule", methods=["GET"])
def get_schedule():
    from datetime import timedelta

    from sqlalchemy.orm import joinedload

    now = datetime.now()

    work_start = now.replace(hour=10, minute=0, second=0, microsecond=0)
    work_end = now.replace(hour=22, minute=0, second=0, microsecond=0)

    start_time = (now - timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(hours=6)

    if start_time < work_start:
        start_time = work_start
    if end_time > work_end:
        end_time = work_end

    desired = timedelta(hours=6)
    if end_time - start_time < desired:
        new_start = end_time - desired
        if new_start >= work_start:
            start_time = new_start
    if end_time - start_time < desired:
        new_end = start_time + desired
        if new_end <= work_end:
            end_time = new_end

    earliest_start = start_time - timedelta(hours=6)

    orders = (
        Order.query.options(
            joinedload(Order.client),
            joinedload(Order.car),
            joinedload(Order.box),
            joinedload(Order.employee),
            joinedload(Order.order_services).joinedload(OrderService.service),
        )
        .filter(
            Order.scheduled_time >= earliest_start,
            Order.scheduled_time < end_time,
        Order.status.in_(BLOCKING_ORDER_STATUSES),
        )
        .all()
    )

    filtered = []
    for order in orders:
        if not order.scheduled_time:
            continue
        order_end = order.scheduled_time + timedelta(minutes=order.total_duration or 0)
        if order_end > start_time and order.scheduled_time < end_time:
            filtered.append(order)

    return jsonify([order.to_dict() for order in filtered])


@bp.route("/api/orders", methods=["POST"])
def create_order():
    data = request.json or {}

    service_ids = data.get("service_ids", [])
    if not service_ids:
        return jsonify({"error": "At least one service is required"}), 400

    try:
        service_ids = [int(service_id) for service_id in service_ids]
    except (TypeError, ValueError):
        return jsonify({"error": "Некорректный список услуг"}), 400

    service_ids = list(dict.fromkeys(service_ids))
    services = Service.query.filter(
        Service.id.in_(service_ids), Service.is_active == True
    ).all()

    if len(services) != len(service_ids):
        return jsonify({"error": "Одна или несколько услуг не найдены или неактивны"}), 400

    total_price = sum(s.price for s in services)
    total_duration = sum(s.duration for s in services if s.duration)

    if not total_duration or total_duration <= 0:
        return jsonify({"error": "Не удалось определить длительность услуг"}), 400

    box_id = data.get("box_id")
    if not box_id:
        return jsonify({"error": "Выберите бокс"}), 400
    try:
        box_id = int(box_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Некорректный бокс"}), 400

    if not data.get("scheduled_time"):
        return jsonify({"error": "Выберите дату и время записи"}), 400

    if data.get("scheduled_time"):
        try:
            scheduled_time = datetime.fromisoformat(data["scheduled_time"])
        except (ValueError, TypeError):
            return jsonify({"error": "Неверный формат даты и времени"}), 400

    if scheduled_time.minute % 15 != 0 or scheduled_time.second != 0:
        return (
            jsonify({"error": "Время записи должно быть кратно 15 минутам"}),
            400,
        )

    box = Box.query.filter_by(id=box_id, is_active=True).with_for_update().first()
    if not box:
        return jsonify({"error": "Бокс не найден или неактивен"}), 404

    order_end = scheduled_time + timedelta(minutes=total_duration)
    existing_orders = Order.query.filter(
        Order.box_id == box_id,
        Order.status.in_(BLOCKING_ORDER_STATUSES),
        Order.scheduled_time.isnot(None),
    ).all()

    for existing in existing_orders:
        existing_end = existing.scheduled_time + timedelta(
            minutes=existing.total_duration or 0
        )

        if scheduled_time < existing_end and order_end > existing.scheduled_time:
            db.session.rollback()
            return (
                jsonify(
                    {
                        "error": f"Время пересекается с существующим заказом #{existing .id } "
                        f"({existing .scheduled_time .strftime ('%H:%M')}-{existing_end .strftime ('%H:%M')}). "
                        f"Выберите другое время или бокс."
                    }
                ),
                409,
            )

    order = Order(
        client_id=data["client_id"],
        car_id=data["car_id"],
        box_id=box_id,
        status=data.get("status", "pending"),
        scheduled_time=scheduled_time,
        total_price=total_price,
        total_duration=total_duration,
        notes=data.get("notes"),
    )

    if order.box_id and scheduled_time:
        schedules = BoxSchedule.query.filter(
            BoxSchedule.box_id == order.box_id,
            BoxSchedule.date == scheduled_time.date(),
        ).all()
        order_time = scheduled_time.time()

        for schedule in schedules:
            if schedule.start_time and schedule.end_time:
                if schedule.start_time <= order_time < schedule.end_time:
                    order.employee_id = schedule.employee_id
                    break
            else:
                order.employee_id = schedule.employee_id
                break

    db.session.add(order)
    db.session.flush()

    services_by_id = {s.id: s for s in services}
    for service_id in service_ids:
        service = services_by_id.get(service_id)
        order_service = OrderService(
            order_id=order.id,
            service_id=service_id,
            service_price=service.price,
            washer_percentage=service.washer_percentage,
        )
        db.session.add(order_service)

    db.session.commit()

    return jsonify(order.to_dict()), 201


@bp.route("/api/orders/<int:id>", methods=["PUT"])
def update_order(id):
    order = Order.query.get_or_404(id)
    data = request.json
    order.status = data.get("status", order.status)
    if data.get("completed_time"):
        order.completed_time = datetime.fromisoformat(data["completed_time"])
    if "is_paid" in data:
        order.is_paid = data["is_paid"]
    order.notes = data.get("notes", order.notes)
    db.session.commit()
    return jsonify(order.to_dict())


@bp.route("/api/orders/<int:id>", methods=["DELETE"])
def delete_order(id):
    order = Order.query.get_or_404(id)
    db.session.delete(order)
    db.session.commit()
    return "", 204


@bp.route("/api/orders/available-slots-today", methods=["POST"])
def get_available_slots_today():
    data = request.json or {}
    total_duration = data.get("total_duration", 0)

    try:
        total_duration = int(total_duration)
    except (TypeError, ValueError):
        total_duration = 0

    if total_duration <= 0:
        return jsonify({"error": "Требуется total_duration"}), 400

    boxes = (
        Box.query.filter(Box.is_active.is_(True), Box.order_index >= 0)
        .order_by(Box.order_index)
        .all()
    )
    if not boxes:
        return jsonify({"error": "Нет активных боксов"}), 400

    today = datetime.now().date()
    current_time = datetime.now()

    start_datetime = datetime.combine(today, datetime.min.time())
    end_datetime = datetime.combine(today, datetime.max.time())
    work_start_datetime = datetime.combine(today, time(10, 0))
    work_end_datetime = datetime.combine(today, time(22, 0))

    orders = Order.query.filter(
        Order.scheduled_time >= start_datetime,
        Order.scheduled_time <= end_datetime,
        Order.status.in_(BLOCKING_ORDER_STATUSES),
    ).all()

    occupied_by_box = {}
    for order in orders:
        if not order.scheduled_time or not order.total_duration or not order.box_id:
            continue

        order_start = order.scheduled_time
        order_end = order_start + timedelta(minutes=order.total_duration)
        occupied_by_box.setdefault(order.box_id, []).append((order_start, order_end))

    result = []

    search_start = current_time.replace(second=0, microsecond=0)
    if search_start < current_time:
        search_start += timedelta(minutes=1)
    minutes_to_add = (15 - search_start.minute % 15) % 15
    search_start += timedelta(minutes=minutes_to_add)
    if search_start < work_start_datetime:
        search_start = work_start_datetime

    for box in boxes:
        search_time = search_start
        available_slots = []

        while search_time < work_end_datetime:
            end_time = search_time + timedelta(minutes=total_duration)

            if end_time > work_end_datetime:
                break

            is_free = all(
                end_time <= busy_start or search_time >= busy_end
                for busy_start, busy_end in occupied_by_box.get(box.id, [])
            )

            if is_free:
                available_slots.append(search_time.strftime("%H:%M"))

            search_time += timedelta(minutes=15)

        result.append(
            {
                "box_id": box.id,
                "box_name": box.name,
                "available_slots": available_slots,
                "is_available": len(available_slots) > 0,
            }
        )

    return jsonify(
        {"date": today.isoformat(), "total_duration": total_duration, "boxes": result}
    )
