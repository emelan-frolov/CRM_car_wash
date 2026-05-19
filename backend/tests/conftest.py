"""Фикстуры для юнит-тестов backend."""

import pytest

from app import create_app
from extensions import db as _db
from models import User
from auth import _generate_token


@pytest.fixture
def app():
    """Создаёт тестовое Flask-приложение с SQLite in-memory."""
    app = create_app({
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "TESTING": True,
        "JWT_SECRET": "test-secret",
        "JWT_EXPIRATION_HOURS": 1,
    })
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def auth_headers(app):
    """Создаёт owner-пользователя и возвращает headers с JWT."""
    with app.app_context():
        owner = User(
            login="test_owner",
            full_name="Test Owner",
            role="owner",
            is_active=True,
        )
        owner.set_password("password123")
        _db.session.add(owner)
        _db.session.commit()

        token = _generate_token(owner)
        return {"Authorization": f"Bearer {token}"}
