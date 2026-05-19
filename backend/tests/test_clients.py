"""Тесты CRUD клиентов.

Validates: Requirements 7.4, 5.6
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app import create_app
from auth import _generate_token
from extensions import db as _db
from models import Client, User


class TestClientsCRUD:
    """CRUD операции над клиентами."""

    def test_create_client(self, client, auth_headers):
        """Создание клиента."""
        data = {
            "first_name": "Иван",
            "last_name": "Иванов",
            "phone": "+79001234567",
        }
        resp = client.post("/api/clients", json=data, headers=auth_headers)
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["first_name"] == "Иван"
        assert body["last_name"] == "Иванов"
        assert body["phone"] == "+79001234567"
        assert body["id"] is not None

    def test_get_clients(self, client, auth_headers):
        """Получение списка клиентов."""
        # Создаём клиента
        client.post("/api/clients", json={
            "first_name": "Пётр", "last_name": "Петров", "phone": "+79002222222",
        }, headers=auth_headers)

        resp = client.get("/api/clients", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert isinstance(body, list)
        assert len(body) >= 1

    def test_update_client(self, client, auth_headers):
        """Обновление клиента."""
        resp = client.post("/api/clients", json={
            "first_name": "Сергей", "last_name": "Сергеев", "phone": "+79003333333",
        }, headers=auth_headers)
        client_id = resp.get_json()["id"]

        resp = client.put(f"/api/clients/{client_id}", json={
            "first_name": "Сергей", "last_name": "Новиков", "phone": "+79003333333",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["last_name"] == "Новиков"

    def test_soft_delete_client(self, client, auth_headers):
        """Мягкое удаление клиента (is_active = False)."""
        resp = client.post("/api/clients", json={
            "first_name": "Удал", "last_name": "Удалёнов", "phone": "+79004444444",
        }, headers=auth_headers)
        client_id = resp.get_json()["id"]

        resp = client.delete(f"/api/clients/{client_id}", headers=auth_headers)
        assert resp.status_code == 204

        # Клиент не появляется в списке активных
        resp = client.get("/api/clients", headers=auth_headers)
        ids = [c["id"] for c in resp.get_json()]
        assert client_id not in ids

    def test_duplicate_phone_rejected(self, client, auth_headers):
        """Дубликат телефона активного клиента — ошибка."""
        client.post("/api/clients", json={
            "first_name": "Один", "last_name": "Первый", "phone": "+79005555555",
        }, headers=auth_headers)

        resp = client.post("/api/clients", json={
            "first_name": "Два", "last_name": "Второй", "phone": "+79005555555",
        }, headers=auth_headers)
        assert resp.status_code == 409


# Feature: codebase-refactoring, Property 3: Soft-delete preserves record
class TestClientSoftDeleteProperty:
    """Property: мягкое удаление сохраняет запись в БД.

    **Validates: Requirements 5.6**
    """

    @given(
        first_name=st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=("L",))),
        last_name=st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=("L",))),
    )
    @settings(max_examples=10, deadline=None)
    def test_soft_delete_preserves_record(self, first_name, last_name):
        """После soft-delete запись остаётся в БД с is_active=False."""
        app = create_app({
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "TESTING": True,
            "JWT_SECRET": "test-secret",
            "JWT_EXPIRATION_HOURS": 1,
        })
        with app.app_context():
            _db.create_all()

            c = Client(
                first_name=first_name,
                last_name=last_name,
                phone=f"+7900{abs(hash(first_name + last_name)) % 10000000:07d}",
            )
            _db.session.add(c)
            _db.session.commit()
            client_id = c.id

            # Soft delete
            c.is_active = False
            _db.session.commit()

            # Запись всё ещё в БД
            record = Client.query.get(client_id)
            assert record is not None
            assert record.is_active is False
            assert record.first_name == first_name
            assert record.last_name == last_name

            # Не появляется в фильтре active
            active = Client.query.filter_by(is_active=True).all()
            assert client_id not in [a.id for a in active]

            _db.drop_all()


# Feature: codebase-refactoring, Property 5: CRUD data round-trip
class TestClientRoundTripProperty:
    """Property: данные, отправленные при создании, возвращаются при чтении.

    **Validates: Requirements 5.1, 7.4**
    """

    @given(
        first_name=st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=("L",))),
        last_name=st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=("L",))),
    )
    @settings(max_examples=10, deadline=None)
    def test_crud_round_trip(self, first_name, last_name):
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
                login="owner_rt", full_name="Owner",
                role="owner", is_active=True,
            )
            owner.set_password("pass")
            _db.session.add(owner)
            _db.session.commit()
            token = _generate_token(owner)
            headers = {"Authorization": f"Bearer {token}"}

            phone = f"+7900{abs(hash(first_name + last_name)) % 10000000:07d}"

            with app.test_client() as tc:
                resp = tc.post("/api/clients", json={
                    "first_name": first_name,
                    "last_name": last_name,
                    "phone": phone,
                }, headers=headers)
                assert resp.status_code == 201
                body = resp.get_json()
                assert body["first_name"] == first_name
                assert body["last_name"] == last_name
                assert body["phone"] == phone
                assert "id" in body
                assert "created_at" in body

            _db.drop_all()
