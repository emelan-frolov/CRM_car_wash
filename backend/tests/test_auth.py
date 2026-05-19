"""Тесты декораторов авторизации.

Validates: Requirements 7.3, 5.2, 5.3, 5.4, 5.5
"""

from datetime import date, datetime, time, timedelta

import jwt
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app import create_app
from auth import _generate_token
from extensions import db as _db
from models import AdminSchedule, User

PERMISSIONS = [
    "can_view_statistics",
    "can_view_admin_schedule",
    "can_view_positions",
    "can_view_employees",
    "can_create_employees",
    "can_edit_employees",
    "can_fire_employees",
    "can_edit_services",
    "can_view_services",
    "can_create_services",
    "can_delete_services",
    "can_create_positions",
    "can_edit_positions",
    "can_delete_positions",
    "can_export_orders",
    "can_view_box_schedule",
    "can_edit_box_schedule",
    "can_edit_admin_schedule",
]


class TestLoginRequired:
    """Тесты декоратора login_required."""

    def test_valid_token(self, client, auth_headers):
        """Валидный токен owner — доступ разрешён."""
        resp = client.get("/api/auth/users", headers=auth_headers)
        assert resp.status_code == 200

    def test_missing_token(self, client):
        """Без токена — 401."""
        resp = client.get("/api/auth/users")
        assert resp.status_code == 401

    def test_invalid_token(self, client):
        """Невалидный токен — 401."""
        headers = {"Authorization": "Bearer invalid.token.here"}
        resp = client.get("/api/auth/users", headers=headers)
        assert resp.status_code == 401

    def test_expired_token(self, app, client):
        """Истёкший токен — 401."""
        with app.app_context():
            owner = User.query.filter_by(login="test_owner").first()
            if not owner:
                owner = User(
                    login="test_owner", full_name="Test Owner",
                    role="owner", is_active=True,
                )
                owner.set_password("password123")
                _db.session.add(owner)
                _db.session.commit()

            payload = {
                "user_id": owner.id,
                "login": owner.login,
                "role": owner.role,
                "exp": datetime.utcnow() - timedelta(hours=1),
                "iat": datetime.utcnow() - timedelta(hours=2),
            }
            token = jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")

        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get("/api/auth/users", headers=headers)
        assert resp.status_code == 401


class TestOwnerRequired:
    """Тесты декоратора owner_required."""

    def test_owner_access(self, client, auth_headers):
        """Owner имеет доступ к owner-only эндпоинтам."""
        resp = client.get("/api/auth/users", headers=auth_headers)
        assert resp.status_code == 200

    def test_admin_denied(self, app, client):
        """Admin без роли owner — 403."""
        with app.app_context():
            admin = User(
                login="test_admin", full_name="Test Admin",
                role="admin", is_active=True,
            )
            admin.set_password("password123")
            _db.session.add(admin)
            _db.session.commit()

            # Создаём активную смену для админа
            now = datetime.now()
            schedule = AdminSchedule(
                user_id=admin.id,
                date=now.date(),
                start_time=(now - timedelta(hours=1)).time(),
                end_time=(now + timedelta(hours=2)).time(),
            )
            _db.session.add(schedule)
            _db.session.commit()

            token = _generate_token(admin)

        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get("/api/auth/users", headers=headers)
        assert resp.status_code == 403


class TestPermissionRequired:
    """Тесты декоратора permission_required."""

    def test_owner_always_passes(self, client, auth_headers):
        """Owner проходит любую проверку прав."""
        resp = client.get("/api/auth/users", headers=auth_headers)
        assert resp.status_code == 200

    def test_admin_with_permission_and_schedule(self, app, client):
        """Admin с правом и активной сменой — доступ разрешён."""
        with app.app_context():
            admin = User(
                login="perm_admin", full_name="Perm Admin",
                role="admin", is_active=True,
                can_view_statistics=True,
            )
            admin.set_password("password123")
            _db.session.add(admin)
            _db.session.commit()

            now = datetime.now()
            schedule = AdminSchedule(
                user_id=admin.id,
                date=now.date(),
                start_time=(now - timedelta(hours=1)).time(),
                end_time=(now + timedelta(hours=2)).time(),
            )
            _db.session.add(schedule)
            _db.session.commit()

            token = _generate_token(admin)

        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get("/api/stats/finance", headers=headers)
        # statistics endpoint требует can_view_statistics
        assert resp.status_code in (200, 400)  # 200 OK или 400 если нужны параметры

    def test_admin_without_schedule_denied(self, app, client):
        """Admin без активной смены — 401."""
        with app.app_context():
            admin = User(
                login="nosched_admin", full_name="No Schedule Admin",
                role="admin", is_active=True,
                can_view_statistics=True,
            )
            admin.set_password("password123")
            _db.session.add(admin)
            _db.session.commit()

            token = _generate_token(admin)

        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get("/api/stats/finance", headers=headers)
        assert resp.status_code == 401


# Feature: codebase-refactoring, Property 1: Authorization decorator correctness
class TestAuthDecoratorProperty:
    """Property-based тест корректности декораторов авторизации.

    **Validates: Requirements 5.2, 5.3, 5.4, 5.5**
    """

    @given(
        role=st.sampled_from(["owner", "admin"]),
        permission=st.sampled_from(PERMISSIONS),
        has_permission=st.booleans(),
        in_schedule=st.booleans(),
    )
    @settings(max_examples=10, deadline=None)
    def test_auth_decorator_correctness(self, role, permission, has_permission, in_schedule):
        """Проверка детерминированности решений авторизации."""
        app = create_app({
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "TESTING": True,
            "JWT_SECRET": "test-secret",
            "JWT_EXPIRATION_HOURS": 1,
        })

        with app.app_context():
            _db.create_all()

            user = User(
                login=f"user_{role}_{permission}",
                full_name="Test User",
                role=role,
                is_active=True,
            )
            if has_permission:
                setattr(user, permission, True)
            user.set_password("password123")
            _db.session.add(user)
            _db.session.commit()

            if in_schedule:
                now = datetime.now()
                schedule = AdminSchedule(
                    user_id=user.id,
                    date=now.date(),
                    start_time=(now - timedelta(hours=1)).time(),
                    end_time=(now + timedelta(hours=2)).time(),
                )
                _db.session.add(schedule)
                _db.session.commit()

            token = _generate_token(user)
            headers = {"Authorization": f"Bearer {token}"}

            with app.test_client() as test_client:
                # Тестируем owner_required endpoint (/api/auth/users)
                resp = test_client.get("/api/auth/users", headers=headers)

                if role == "owner":
                    # Owner всегда получает доступ
                    assert resp.status_code == 200
                else:
                    # Admin без расписания = 401, с расписанием но не owner = 403
                    if not in_schedule:
                        assert resp.status_code == 401
                    else:
                        assert resp.status_code == 403

            _db.drop_all()
