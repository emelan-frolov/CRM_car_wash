"""
Скрипт для пересоздания базы данных с новой структурой
"""
from app import app
from extensions import db
from models import Box
from sqlalchemy import text

def recreate_database():
    with app.app_context():
        print("Удаление старых таблиц...")
        
        # Удаляем все таблицы
        db.drop_all()
        print("✓ Старые таблицы удалены")
        
        # Создаем новые таблицы
        print("\nСоздание новых таблиц...")
        db.create_all()
        print("✓ Новые таблицы созданы")
        
        # Создаем боксы по умолчанию
        print("\nСоздание боксов по умолчанию...")
        default_boxes = [
            Box(name='Бокс 1', order_index=0, is_active=True),
            Box(name='Бокс 2', order_index=1, is_active=True),
            Box(name='Бокс 3', order_index=2, is_active=True),
        ]
        for box in default_boxes:
            db.session.add(box)
        db.session.commit()
        print("✓ Созданы боксы: Бокс 1, Бокс 2, Бокс 3")
        
        print("\n✅ База данных успешно пересоздана!")
        print("\nТеперь можно запустить сервер: python app.py")

if __name__ == '__main__':
    print("=" * 50)
    print("ПЕРЕСОЗДАНИЕ БАЗЫ ДАННЫХ")
    print("=" * 50)
    print("\n⚠️  ВНИМАНИЕ: Все данные будут удалены!")
    
    confirm = input("\nПродолжить? (yes/no): ")
    if confirm.lower() == 'yes':
        recreate_database()
    else:
        print("Операция отменена")
