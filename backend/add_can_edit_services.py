"""
Миграция: добавляет столбец can_edit_services в таблицу users
"""

from app import app
from extensions import db
from sqlalchemy import text


def migrate():
    with app.app_context():
        try:
            db.session.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_services BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            db.session.commit()
            print("✅ Столбец can_edit_services успешно добавлен в таблицу users")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Ошибка миграции: {e}")


if __name__ == "__main__":
    migrate()
