"""
Простой скрипт для активации всех боксов через прямой SQL запрос
"""

import psycopg2

# Параметры подключения к базе данных
DB_CONFIG = {
    'dbname': 'crm_car_wash',
    'user': 'postgres',
    'password': '1234',
    'host': 'localhost',
    'port': '5432'
}

def activate_all_boxes():
    try:
        # Подключаемся к базе данных
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Проверяем текущее состояние
        cursor.execute("SELECT id, name, is_active FROM boxes ORDER BY order_index")
        boxes = cursor.fetchall()
        
        if not boxes:
            print("❌ Боксы не найдены в базе данных!")
            print("   Запустите: python migrate_db.py")
            return
        
        print(f"📦 Найдено боксов: {len(boxes)}")
        print("\nТекущее состояние:")
        for box_id, name, is_active in boxes:
            status = "🟢 Активен" if is_active else "🔴 Неактивен"
            print(f"   {status} - {name}")
        
        # Активируем все боксы
        cursor.execute("UPDATE boxes SET is_active = true WHERE is_active = false")
        updated = cursor.rowcount
        
        conn.commit()
        
        print(f"\n✅ Активировано боксов: {updated}")
        
        # Показываем новое состояние
        cursor.execute("SELECT id, name, is_active FROM boxes ORDER BY order_index")
        boxes = cursor.fetchall()
        
        print("\nНовое состояние:")
        for box_id, name, is_active in boxes:
            status = "🟢 Активен" if is_active else "🔴 Неактивен"
            print(f"   {status} - {name}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Готово! Теперь обновите страницу в браузере (F5)")
        
    except psycopg2.Error as e:
        print(f"❌ Ошибка подключения к базе данных:")
        print(f"   {e}")
        print("\nПроверьте что:")
        print("   1. PostgreSQL запущен")
        print("   2. База данных 'crm_car_wash' существует")
        print("   3. Пароль в скрипте правильный (сейчас: 1234)")

if __name__ == '__main__':
    activate_all_boxes()
