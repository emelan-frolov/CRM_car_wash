"""
Миграция v2: добавляет новые столбцы прав в таблицу users
"""

from app import app
from extensions import db
from sqlalchemy import text

NEW_COLUMNS = [
    "can_view_services",
    "can_create_services",
    "can_delete_services",
    "can_create_positions",
    "can_edit_positions",
    "can_delete_positions",
    "can_export_orders",
]


def migrate():
    with app.app_context():
        for col in NEW_COLUMNS:
            try:
                db.session.execute(
                    text(
                        f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} BOOLEAN NOT NULL DEFAULT FALSE"
                    )
                )
                db.session.commit()
                print(f"✅ Столбец {col} добавлен")
            except Exception as e:
                db.session.rollback()
                print(f"⚠️  {col}: {e}")


if __name__ == "__main__":
    migrate()
