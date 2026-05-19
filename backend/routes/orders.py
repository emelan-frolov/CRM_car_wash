from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from extensions import db
from models import Box, BoxSchedule, Order, OrderService, Service

bp = Blueprint("orders", __name__)


@bp.route("/api/orders", methods=["GET"])
def get_orders():
    page = request.args.get("page", type=int)
    page_size = request.args.get("page_size", type=int)
    search_name = request.args.get("search_name", "", type=str).strip()
    search_phone = request.args.get("search_phone", "", type=str).strip()

    query = Order.query

    if search_name or search_phone:
        from sqlalchemy import or_

        from models import Client

        query = query.join(Client, Order.client_id == Client.id)

        if search_name:
            like = f"%{search_name}%"
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
                query = query.filter(Client.phone.ilike(f"%{clean_phone}%"))

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
    """Получить заказы для расписания (окно 6 часов: -2/+4 от текущего, в пределах 10:00–22:00)"""
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
            Order.status.in_(["pending", "in_progress", "completed"]),
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
    data = request.json

    service_ids = data.get("service_ids", [])
    if not service_ids:
        return jsonify({"error": "At least one service is required"}), 400

    services = Service.query.filter(Service.id.in_(service_ids)).all()
    total_price = sum(s.price for s in services)
    total_duration = sum(s.duration for s in services if s.duration)

    if not total_duration or total_duration <= 0:
        return jsonify({"error": "Не удалось определить длительность услуг"}), 400

    if data.get("scheduled_time"):
        scheduled_time = datetime.fromisoformat(data["scheduled_time"])
        if scheduled_time.minute % 15 != 0 or scheduled_time.second != 0:
            return jsonify(
                {"error": "Scheduled time must be in 15-minute intervals"}
            ), 400
    else:
        scheduled_time = None

    box_id = data.get("box_id")

    # ЗАЩИТА ОТ DOUBLE-BOOKING
    if box_id and scheduled_time:
        Box.query.filter_by(id=box_id).with_for_update().first()

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
                return jsonify(
                    {
                        "error": f"Время пересекается с существующим заказом #{existing.id} "
                        f"({existing.scheduled_time.strftime('%H:%M')}-{existing_end.strftime('%H:%M')}). "
                        f"Выберите другое время или бокс."
                    }
                ), 409

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

    # Автоматически назначаем сотрудника на основе расписания бокса
    if order.box_id and scheduled_time:
        schedule = BoxSchedule.query.filter(
            BoxSchedule.box_id == order.box_id,
            BoxSchedule.date == scheduled_time.date(),
        ).first()

        if schedule:
            if schedule.start_time and schedule.end_time:
                order_time = scheduled_time.time()
                if schedule.start_time <= order_time < schedule.end_time:
                    order.employee_id = schedule.employee_id
            else:
                order.employee_id = schedule.employee_id

    db.session.add(order)
    db.session.flush()

    # Добавляем связи с услугами (с фиксацией цены и % мойщику на момент заказа)
    services_by_id = {s.id: s for s in services}
    for service_id in service_ids:
        service = services_by_id.get(service_id)
        order_service = OrderService(
            order_id=order.id,
            service_id=service_id,
            service_price=service.price if service else None,
            washer_percentage=service.washer_percentage if service else None,
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
    """Получить ближайшие доступные слоты для каждого бокса на сегодня"""
    data = request.json
    total_duration = data.get("total_duration", 0)

    if not total_duration:
        return jsonify({"error": "Требуется total_duration"}), 400

    work_start_hour = 10
    work_end_hour = 22

    boxes = Box.query.filter_by(is_active=True).order_by(Box.order_index).all()
    if not boxes:
        return jsonify({"error": "Нет активных боксов"}), 400

    today = datetime.now().date()
    current_time = datetime.now()

    start_datetime = datetime.combine(today, datetime.min.time())
    end_datetime = datetime.combine(today, datetime.max.time())

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

    result = []

    for box in boxes:
        current_minutes = current_time.minute
        rounded_minutes = ((current_minutes + 14) // 15) * 15

        if rounded_minutes == 60:
            search_time = current_time.replace(
                hour=current_time.hour + 1, minute=0, second=0, microsecond=0
            )
        else:
            search_time = current_time.replace(
                minute=rounded_minutes, second=0, microsecond=0
            )

        if search_time.hour < work_start_hour:
            search_time = datetime.combine(
                today, datetime.strptime("10:00", "%H:%M").time()
            )

        available_slots = []

        while search_time.hour < work_end_hour or (
            search_time.hour == work_end_hour and search_time.minute == 0
        ):
            if search_time < current_time:
                search_time += timedelta(minutes=15)
                continue

            is_free = True
            end_time = search_time + timedelta(minutes=total_duration)

            work_end_datetime = datetime.combine(
                today, datetime.strptime(f"{work_end_hour}:00", "%H:%M").time()
            )
            if end_time > work_end_datetime:
                break

            check_time = search_time
            while check_time < end_time:
                if (box.id, check_time.hour, check_time.minute) in occupied:
                    is_free = False
                    break
                check_time += timedelta(minutes=15)

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
