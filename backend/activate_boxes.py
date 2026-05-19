"""
Скрипт для активации всех боксов в базе данных
"""

from app import app
from extensions import db
from models import Box

def activate_all_boxes():
    with app.app_context():
        boxes = Box.query.all()
        
        if not boxes:
            print("❌ Боксы не найдены в базе данных!")
            print("   Запустите: python migrate_db.py")
            return
        
        print(f"📦 Найдено боксов: {len(boxes)}")
        print()
        
        for box in boxes:
            if not box.is_active:
                box.is_active = True
                print(f"✅ Активирован: {box.name}")
            else:
                print(f"✓  Уже активен: {box.name}")
        
        db.session.commit()
        print()
        print("🎉 Все боксы активированы!")
        print()
        print("Текущее состояние:")
        for box in Box.query.order_by(Box.order_index).all():
            status = "🟢 Активен" if box.is_active else "🔴 Неактивен"
            print(f"   {status} - {box.name}")

if __name__ == '__main__':
    activate_all_boxes()
