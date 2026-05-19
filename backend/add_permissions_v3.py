"""
Миграция v3: добавляет права для расписания боксов и смен администраторов
"""

from app import app
from extensions import db
from sqlalchemy import text

NEW_COLUMNS = [
    "can_view_box_schedule",
    "can_edit_box_schedule",
    "can_edit_admin_schedule",
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
