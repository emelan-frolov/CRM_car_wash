from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from auth import permission_required
from extensions import db
from models import Box, BoxSchedule, Employee, Order, OrderService, Service

bp = Blueprint("statistics", __name__)


def _parse_period():
    """Парсит query-параметры start_date и end_date.
    Возвращает (start_dt, end_dt). end_dt — НА следующий день после end_date (полуинтервал)."""
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    if start_str:
        start_dt = datetime.strptime(start_str, "%Y-%m-%d")
    else:
        start_dt = datetime.now().replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - timedelta(days=30)

    if end_str:
        end_dt = datetime.strptime(end_str, "%Y-%m-%d") + timedelta(days=1)
    else:
        end_dt = datetime.now().replace(
            hour=0, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)

    return start_dt, end_dt


@bp.route("/api/stats/finance", methods=["GET"])
@permission_required("can_view_statistics")
def stats_finance():
    """Финансовые показатели."""
    from sqlalchemy import func

    start_dt, end_dt = _parse_period()

    base_filter = [
        Order.status == "completed",
        Order.is_paid == True,
        Order.scheduled_time >= start_dt,
        Order.scheduled_time < end_dt,
    ]

    result = (
        db.session.query(
            func.coalesce(func.sum(Order.total_price), 0).label("revenue"),
            func.count(Order.id).label("count"),
        )
        .filter(*base_filter)
        .first()
    )

    total_revenue = float(result.revenue or 0)
    orders_count = int(result.count or 0)
    average_check = round(total_revenue / orders_count, 2) if orders_count > 0 else 0

    price_expr = func.coalesce(OrderService.service_price, Service.price)
    top_services_q = (
        db.session.query(
            Service.id,
            Service.name,
            func.count(OrderService.id).label("count"),
            func.coalesce(func.sum(price_expr), 0).label("revenue"),
        )
        .join(OrderService, OrderService.service_id == Service.id)
        .join(Order, Order.id == OrderService.order_id)
        .filter(*base_filter)
        .group_by(Service.id, Service.name)
        .order_by(func.sum(price_expr).desc())
        .limit(5)
        .all()
    )

    top_services = [
        {
            "id": s.id,
            "name": s.name,
            "count": int(s.count),
            "revenue": float(s.revenue or 0),
        }
        for s in top_services_q
    ]

    daily_q = (
        db.session.query(
            func.date(Order.scheduled_time).label("day"),
            func.coalesce(func.sum(Order.total_price), 0).label("revenue"),
            func.count(Order.id).label("count"),
        )
        .filter(*base_filter)
        .group_by(func.date(Order.scheduled_time))
        .order_by(func.date(Order.scheduled_time))
        .all()
    )

    revenue_by_day = [
        {
            "date": str(row.day),
            "revenue": float(row.revenue or 0),
            "count": int(row.count),
        }
        for row in daily_q
    ]

    return jsonify(
        {
            "total_revenue": total_revenue,
            "orders_count": orders_count,
            "average_check": average_check,
            "top_services": top_services,
            "revenue_by_day": revenue_by_day,
            "period": {
                "start": start_dt.strftime("%Y-%m-%d"),
                "end": (end_dt - timedelta(days=1)).strftime("%Y-%m-%d"),
            },
        }
    )


@bp.route("/api/stats/employees", methods=["GET"])
@permission_required("can_view_statistics")
def stats_employees():
    """HR-аналитика."""
    from sqlalchemy import func
    from sqlalchemy.orm import joinedload

    start_dt, end_dt = _parse_period()
    start_date = start_dt.date()
    end_date = (end_dt - timedelta(days=1)).date()

    employees = Employee.query.options(joinedload(Employee.position)).all()

    result = []

    for emp in employees:
        emp_orders = (
            db.session.query(
                func.count(Order.id).label("count"),
                func.coalesce(func.sum(Order.total_price), 0).label("revenue"),
            )
            .filter(
                Order.employee_id == emp.id,
                Order.status == "completed",
                Order.scheduled_time >= start_dt,
                Order.scheduled_time < end_dt,
            )
            .first()
        )

        orders_count = int(emp_orders.count or 0)
        orders_revenue = float(emp_orders.revenue or 0)

        salary = 0.0
        hours_worked = 0.0

        if emp.salary_type == "fixed":
            shifts = BoxSchedule.query.filter(
                BoxSchedule.employee_id == emp.id,
                BoxSchedule.date >= start_date,
                BoxSchedule.date <= end_date,
            ).all()

            for shift in shifts:
                if shift.start_time and shift.end_time:
                    h = (
                        datetime.combine(shift.date, shift.end_time)
                        - datetime.combine(shift.date, shift.start_time)
                    ).total_seconds() / 3600
                    hours_worked += h
                else:
                    hours_worked += 12

            hourly_rate = emp.position.salary if emp.position else 0
            salary = round(hours_worked * hourly_rate, 2)

        else:
            piecework_sum = (
                db.session.query(
                    func.coalesce(
                        func.sum(
                            func.coalesce(OrderService.service_price, Service.price)
                            * func.coalesce(
                                OrderService.washer_percentage,
                                Service.washer_percentage,
                            )
                            / 100
                        ),
                        0,
                    ).label("total")
                )
                .join(Service, OrderService.service_id == Service.id)
                .join(Order, Order.id == OrderService.order_id)
                .filter(
                    Order.employee_id == emp.id,
                    Order.status == "completed",
                    Order.scheduled_time >= start_dt,
                    Order.scheduled_time < end_dt,
                )
                .first()
            )

            salary = round(float(piecework_sum.total or 0), 2)

        result.append(
            {
                "id": emp.id,
                "full_name": f"{emp.last_name} {emp.first_name}".strip(),
                "position_name": emp.position.name if emp.position else None,
                "salary_type": emp.salary_type,
                "salary_type_display": "Фиксированная"
                if emp.salary_type == "fixed"
                else "Сдельная",
                "status": emp.status,
                "orders_count": orders_count,
                "orders_revenue": orders_revenue,
                "hours_worked": round(hours_worked, 1),
                "salary": salary,
            }
        )

    result.sort(key=lambda x: x["salary"], reverse=True)

    return jsonify(
        {
            "employees": result,
            "period": {
                "start": start_dt.strftime("%Y-%m-%d"),
                "end": end_date.strftime("%Y-%m-%d"),
            },
        }
    )


@bp.route("/api/stats/boxes", methods=["GET"])
@permission_required("can_view_statistics")
def stats_boxes():
    """Операционная эффективность."""
    from sqlalchemy import extract, func

    start_dt, end_dt = _parse_period()
    start_date = start_dt.date()
    end_date = (end_dt - timedelta(days=1)).date()

    base_filter = [
        Order.status.in_(["completed", "in_progress"]),
        Order.scheduled_time >= start_dt,
        Order.scheduled_time < end_dt,
    ]

    hourly_q = (
        db.session.query(
            extract("hour", Order.scheduled_time).label("hour"),
            func.count(Order.id).label("count"),
            func.coalesce(func.sum(Order.total_duration), 0).label("total_minutes"),
        )
        .filter(*base_filter)
        .group_by(extract("hour", Order.scheduled_time))
        .order_by(extract("hour", Order.scheduled_time))
        .all()
    )

    hourly_map = {
        int(row.hour): {"count": int(row.count), "minutes": int(row.total_minutes or 0)}
        for row in hourly_q
    }

    by_hour = []
    for h in range(10, 22):
        data = hourly_map.get(h, {"count": 0, "minutes": 0})
        by_hour.append(
            {"hour": h, "count": data["count"], "busy_minutes": data["minutes"]}
        )

    boxes = Box.query.filter_by(is_active=True).all()
    boxes_utilization = []

    days_in_period = (end_date - start_date).days + 1

    for box in boxes:
        box_orders = (
            db.session.query(
                func.count(Order.id).label("count"),
                func.coalesce(func.sum(Order.total_duration), 0).label("busy_minutes"),
                func.coalesce(func.sum(Order.total_price), 0).label("revenue"),
            )
            .filter(Order.box_id == box.id, *base_filter)
            .first()
        )

        busy_minutes = int(box_orders.busy_minutes or 0)
        orders_count = int(box_orders.count or 0)
        revenue = float(box_orders.revenue or 0)

        shifts = BoxSchedule.query.filter(
            BoxSchedule.box_id == box.id,
            BoxSchedule.date >= start_date,
            BoxSchedule.date <= end_date,
        ).all()

        available_minutes = 0
        for shift in shifts:
            if shift.start_time and shift.end_time:
                m = (
                    datetime.combine(shift.date, shift.end_time)
                    - datetime.combine(shift.date, shift.start_time)
                ).total_seconds() / 60
                available_minutes += int(m)
            else:
                available_minutes += 12 * 60

        if available_minutes == 0:
            available_minutes = 12 * 60 * days_in_period

        utilization = (
            round((busy_minutes / available_minutes) * 100, 1)
            if available_minutes > 0
            else 0
        )

        boxes_utilization.append(
            {
                "id": box.id,
                "name": box.name,
                "orders_count": orders_count,
                "busy_minutes": busy_minutes,
                "busy_hours": round(busy_minutes / 60, 1),
                "available_minutes": available_minutes,
                "available_hours": round(available_minutes / 60, 1),
                "utilization_percent": min(100, utilization),
                "revenue": revenue,
            }
        )

    return jsonify(
        {
            "by_hour": by_hour,
            "boxes_utilization": boxes_utilization,
            "period": {
                "start": start_dt.strftime("%Y-%m-%d"),
                "end": end_date.strftime("%Y-%m-%d"),
            },
        }
    )
