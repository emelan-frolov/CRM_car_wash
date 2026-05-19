"""Тесты CRUD услуг.

Validates: Requirements 7.4
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app import create_app
from auth import _generate_token
from extensions import db as _db
from models import Service, User


class TestServicesCRUD:
    """CRUD операции над услугами."""

    def test_create_service(self, client, auth_headers):
        """Создание услуги."""
        data = {
            "name": "Мойка кузова",
            "price": 500.0,
            "duration": 30,
            "washer_percentage": 20,
        }
        resp = client.post("/api/services", json=data, headers=auth_headers)
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["name"] == "Мойка кузова"
        assert body["price"] == 500.0
        assert body["duration"] == 30
        assert body["washer_percentage"] == 20

    def test_get_services(self, client, auth_headers):
        """Получение списка услуг."""
        client.post("/api/services", json={
            "name": "Полировка", "price": 1000.0, "duration": 60,
        }, headers=auth_headers)

        resp = client.get("/api/services", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert isinstance(body, list)
        assert len(body) >= 1

    def test_update_service(self, client, auth_headers):
        """Обновление услуги."""
        resp = client.post("/api/services", json={
            "name": "Химчистка", "price": 2000.0, "duration": 120,
        }, headers=auth_headers)
        service_id = resp.get_json()["id"]

        resp = client.put(f"/api/services/{service_id}", json={
            "name": "Химчистка салона", "price": 2500.0, "duration": 120,
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["name"] == "Химчистка салона"
        assert resp.get_json()["price"] == 2500.0

    def test_soft_delete_service(self, client, auth_headers):
        """Мягкое удаление услуги."""
        resp = client.post("/api/services", json={
            "name": "Удаляемая", "price": 100.0, "duration": 15,
        }, headers=auth_headers)
        service_id = resp.get_json()["id"]

        resp = client.delete(f"/api/services/{service_id}", headers=auth_headers)
        assert resp.status_code == 204

        resp = client.get("/api/services", headers=auth_headers)
        ids = [s["id"] for s in resp.get_json()]
        assert service_id not in ids


# Feature: codebase-refactoring, Property 5: CRUD data round-trip
class TestServiceRoundTripProperty:
    """Property: данные round-trip через API для услуг.

    **Validates: Requirements 5.1, 7.4**
    """

    @given(
        name=st.text(min_size=1, max_size=30, alphabet=st.characters(
            whitelist_categories=("L",))),
        price=st.floats(min_value=1.0, max_value=50000.0, allow_nan=False, allow_infinity=False),
        duration=st.integers(min_value=15, max_value=480),
    )
    @settings(max_examples=10, deadline=None)
    def test_crud_round_trip(self, name, price, duration):
        """POST → response содержит отправленные данные."""
        price = round(price, 2)

        app = create_app({
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "TESTING": True,
            "JWT_SECRET": "test-secret",
            "JWT_EXPIRATION_HOURS": 1,
        })
        with app.app_context():
            _db.create_all()

            owner = User(
                login="owner_svc", full_name="Owner",
                role="owner", is_active=True,
            )
            owner.set_password("pass")
            _db.session.add(owner)
            _db.session.commit()
            token = _generate_token(owner)
            headers = {"Authorization": f"Bearer {token}"}

            with app.test_client() as tc:
                resp = tc.post("/api/services", json={
                    "name": name,
                    "price": price,
                    "duration": duration,
                }, headers=headers)
                assert resp.status_code == 201
                body = resp.get_json()
                assert body["name"] == name
                assert abs(body["price"] - price) < 0.01
                assert body["duration"] == duration
                assert "id" in body

            _db.drop_all()
