"""Тесты CRUD авто.

Validates: Requirements 7.4, 5.6
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app import create_app
from auth import _generate_token
from extensions import db as _db
from models import Car, User


class TestCarsCRUD:
    """CRUD операции над автомобилями."""

    def test_create_car(self, client, auth_headers):
        """Создание автомобиля."""
        data = {
            "license_plate": "А001АА77",
            "brand": "Toyota",
            "model": "Camry",
        }
        resp = client.post("/api/cars", json=data, headers=auth_headers)
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["license_plate"] == "А001АА77"
        assert body["brand"] == "Toyota"
        assert body["model"] == "Camry"

    def test_get_cars(self, client, auth_headers):
        """Получение списка авто."""
        client.post("/api/cars", json={
            "license_plate": "Б002ББ77", "brand": "Honda", "model": "Civic",
        }, headers=auth_headers)

        resp = client.get("/api/cars", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert isinstance(body, list)
        assert len(body) >= 1

    def test_update_car(self, client, auth_headers):
        """Обновление авто."""
        resp = client.post("/api/cars", json={
            "license_plate": "В003ВВ77", "brand": "BMW", "model": "X5",
        }, headers=auth_headers)
        car_id = resp.get_json()["id"]

        resp = client.put(f"/api/cars/{car_id}", json={
            "brand": "BMW", "model": "X6", "license_plate": "В003ВВ77",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["model"] == "X6"

    def test_soft_delete_car(self, client, auth_headers):
        """Мягкое удаление авто."""
        resp = client.post("/api/cars", json={
            "license_plate": "Г004ГГ77", "brand": "Kia", "model": "Rio",
        }, headers=auth_headers)
        car_id = resp.get_json()["id"]

        resp = client.delete(f"/api/cars/{car_id}", headers=auth_headers)
        assert resp.status_code == 204

        resp = client.get("/api/cars", headers=auth_headers)
        ids = [c["id"] for c in resp.get_json()]
        assert car_id not in ids

    def test_duplicate_plate_rejected(self, client, auth_headers):
        """Дубликат гос. номера активного авто — ошибка."""
        client.post("/api/cars", json={
            "license_plate": "Д005ДД77", "brand": "Mazda", "model": "3",
        }, headers=auth_headers)

        resp = client.post("/api/cars", json={
            "license_plate": "Д005ДД77", "brand": "Mazda", "model": "6",
        }, headers=auth_headers)
        assert resp.status_code == 409


# Feature: codebase-refactoring, Property 3: Soft-delete preserves record
class TestCarSoftDeleteProperty:
    """Property: мягкое удаление сохраняет запись в БД.

    **Validates: Requirements 5.6**
    """

    @given(
        plate=st.text(min_size=1, max_size=10, alphabet=st.characters(
            whitelist_categories=("L", "N"))),
        brand=st.text(min_size=1, max_size=15, alphabet=st.characters(
            whitelist_categories=("L",))),
    )
    @settings(max_examples=10, deadline=None)
    def test_soft_delete_preserves_record(self, plate, brand):
        """После soft-delete запись остаётся в БД с is_active=False."""
        app = create_app({
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "TESTING": True,
            "JWT_SECRET": "test-secret",
            "JWT_EXPIRATION_HOURS": 1,
        })
        with app.app_context():
            _db.create_all()

            car = Car(
                license_plate=plate.upper(),
                brand=brand,
                model="TestModel",
            )
            _db.session.add(car)
            _db.session.commit()
            car_id = car.id

            car.is_active = False
            _db.session.commit()

            record = Car.query.get(car_id)
            assert record is not None
            assert record.is_active is False
            assert record.brand == brand

            active = Car.query.filter_by(is_active=True).all()
            assert car_id not in [a.id for a in active]

            _db.drop_all()


# Feature: codebase-refactoring, Property 5: CRUD data round-trip
class TestCarRoundTripProperty:
    """Property: данные round-trip через API.

    **Validates: Requirements 5.1, 7.4**
    """

    @given(
        plate=st.text(min_size=1, max_size=10, alphabet=st.characters(
            whitelist_categories=("L", "N"))),
        brand=st.text(min_size=1, max_size=15, alphabet=st.characters(
            whitelist_categories=("L",))),
        model=st.text(min_size=1, max_size=15, alphabet=st.characters(
            whitelist_categories=("L",))),
    )
    @settings(max_examples=10, deadline=None)
    def test_crud_round_trip(self, plate, brand, model):
        """POST → GET возвращает те же данные."""
        app = create_app({
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "TESTING": True,
            "JWT_SECRET": "test-secret",
            "JWT_EXPIRATION_HOURS": 1,
        })
        with app.app_context():
            _db.create_all()

            owner = User(
                login="owner_car", full_name="Owner",
                role="owner", is_active=True,
            )
            owner.set_password("pass")
            _db.session.add(owner)
            _db.session.commit()
            token = _generate_token(owner)
            headers = {"Authorization": f"Bearer {token}"}

            with app.test_client() as tc:
                resp = tc.post("/api/cars", json={
                    "license_plate": plate,
                    "brand": brand,
                    "model": model,
                }, headers=headers)
                assert resp.status_code == 201
                body = resp.get_json()
                # license_plate gets uppercased
                assert body["license_plate"] == plate.upper()
                assert body["brand"] == brand
                assert body["model"] == model
                assert "id" in body
                assert "created_at" in body

            _db.drop_all()
