"""Тесты CRUD заказов и бизнес-логики.

Validates: Requirements 7.4, 7.5, 5.1
"""

from datetime import datetime, timedelta

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from app import create_app
from auth import _generate_token
from extensions import db as _db
from models import Box, Car, Client, Order, OrderService, Service, User


@pytest.fixture
def order_fixtures(app):
    """Создаёт клиента, авто, бокс и услуги для тестов заказов."""
    with app.app_context():
        client_obj = Client(
            first_name="Тест", last_name="Клиент", phone="+79001000001"
        )
        car = Car(license_plate="Т001ТТ77", brand="Toyota", model="Corolla")
        box = Box(name="Бокс 1", is_active=True, order_index=0)
        service1 = Service(
            name="Мойка", price=500.0, duration=30, washer_percentage=20
        )
        service2 = Service(
            name="Полировка", price=1000.0, duration=60, washer_percentage=30
        )

        _db.session.add_all([client_obj, car, box, service1, service2])
        _db.session.commit()

        return {
            "client_id": client_obj.id,
            "car_id": car.id,
            "box_id": box.id,
            "service1_id": service1.id,
            "service2_id": service2.id,
        }


class TestOrdersCRUD:
    """CRUD операции над заказами."""

    def test_create_order(self, client, auth_headers, order_fixtures):
        """Создание заказа с расчётом стоимости и длительности."""
        # Используем время в 15-минутных интервалах
        tomorrow = (datetime.now() + timedelta(days=1)).replace(
            hour=12, minute=0, second=0, microsecond=0
        )

        data = {
            "client_id": order_fixtures["client_id"],
            "car_id": order_fixtures["car_id"],
            "box_id": order_fixtures["box_id"],
            "service_ids": [order_fixtures["service1_id"], order_fixtures["service2_id"]],
            "scheduled_time": tomorrow.isoformat(),
        }
        resp = client.post("/api/orders", json=data, headers=auth_headers)
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["total_price"] == 1500.0  # 500 + 1000
        assert body["total_duration"] == 90   # 30 + 60
        assert body["status"] == "pending"

    def test_create_order_without_services_fails(self, client, auth_headers, order_fixtures):
        """Заказ без услуг — ошибка 400."""
        data = {
            "client_id": order_fixtures["client_id"],
            "car_id": order_fixtures["car_id"],
            "service_ids": [],
        }
        resp = client.post("/api/orders", json=data, headers=auth_headers)
        assert resp.status_code == 400

    def test_update_order_status(self, client, auth_headers, order_fixtures):
        """Обновление статуса заказа."""
        tomorrow = (datetime.now() + timedelta(days=1)).replace(
            hour=14, minute=0, second=0, microsecond=0
        )
        resp = client.post("/api/orders", json={
            "client_id": order_fixtures["client_id"],
            "car_id": order_fixtures["car_id"],
            "box_id": order_fixtures["box_id"],
            "service_ids": [order_fixtures["service1_id"]],
            "scheduled_time": tomorrow.isoformat(),
        }, headers=auth_headers)
        order_id = resp.get_json()["id"]

        resp = client.put(f"/api/orders/{order_id}", json={
            "status": "in_progress",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "in_progress"

    def test_delete_order(self, client, auth_headers, order_fixtures):
        """Удаление заказа (жёсткое, не soft-delete)."""
        tomorrow = (datetime.now() + timedelta(days=1)).replace(
            hour=16, minute=0, second=0, microsecond=0
        )
        resp = client.post("/api/orders", json={
            "client_id": order_fixtures["client_id"],
            "car_id": order_fixtures["car_id"],
            "box_id": order_fixtures["box_id"],
            "service_ids": [order_fixtures["service1_id"]],
            "scheduled_time": tomorrow.isoformat(),
        }, headers=auth_headers)
        order_id = resp.get_json()["id"]

        resp = client.delete(f"/api/orders/{order_id}", headers=auth_headers)
        assert resp.status_code == 204

    def test_scheduled_time_15min_interval(self, client, auth_headers, order_fixtures):
        """Время заказа должно быть кратно 15 минутам."""
        bad_time = (datetime.now() + timedelta(days=1)).replace(
            hour=12, minute=7, second=0, microsecond=0
        )
        resp = client.post("/api/orders", json={
            "client_id": order_fixtures["client_id"],
            "car_id": order_fixtures["car_id"],
            "service_ids": [order_fixtures["service1_id"]],
            "scheduled_time": bad_time.isoformat(),
        }, headers=auth_headers)
        assert resp.status_code == 400


# Feature: codebase-refactoring, Property 4: Order cost and duration calculation
class TestOrderCostDurationProperty:
    """Property: стоимость и длительность заказа = сумма услуг.

    **Validates: Requirements 5.1, 7.5**
    """

    @given(
        prices=st.lists(
            st.floats(min_value=100, max_value=10000, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=5,
        ),
        durations=st.lists(
            st.integers(min_value=15, max_value=120),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=10, deadline=None)
    def test_order_cost_equals_sum_of_services(self, prices, durations):
        """total_price = sum(service prices), total_duration = sum(durations)."""
        # Align lists to same length
        min_len = min(len(prices), len(durations))
        prices = prices[:min_len]
        durations = durations[:min_len]

        app = create_app({
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "TESTING": True,
            "JWT_SECRET": "test-secret",
            "JWT_EXPIRATION_HOURS": 1,
        })
        with app.app_context():
            _db.create_all()

            owner = User(
                login="owner_ord", full_name="Owner",
                role="owner", is_active=True,
            )
            owner.set_password("pass")
            _db.session.add(owner)

            cl = Client(first_name="T", last_name="C", phone="+70000000000")
            car = Car(license_plate="TEST01", brand="T", model="M")
            box = Box(name="Box", is_active=True, order_index=0)
            _db.session.add_all([cl, car, box])
            _db.session.flush()

            services = []
            for i, (p, d) in enumerate(zip(prices, durations)):
                s = Service(name=f"Svc{i}", price=round(p, 2), duration=d, washer_percentage=0)
                _db.session.add(s)
                services.append(s)
            _db.session.commit()

            token = _generate_token(owner)
            headers = {"Authorization": f"Bearer {token}"}

            tomorrow = (datetime.now() + timedelta(days=1)).replace(
                hour=12, minute=0, second=0, microsecond=0
            )

            with app.test_client() as tc:
                resp = tc.post("/api/orders", json={
                    "client_id": cl.id,
                    "car_id": car.id,
                    "box_id": box.id,
                    "service_ids": [s.id for s in services],
                    "scheduled_time": tomorrow.isoformat(),
                }, headers=headers)
                assert resp.status_code == 201
                body = resp.get_json()

                expected_price = sum(round(p, 2) for p in prices)
                expected_duration = sum(durations)

                assert abs(body["total_price"] - expected_price) < 0.01
                assert body["total_duration"] == expected_duration

            _db.drop_all()
