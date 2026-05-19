"""
Скрипт для добавления поля is_paid в таблицу orders
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

def add_is_paid_field():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Проверяем существует ли уже поле
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='is_paid'
        """)
        
        if cursor.fetchone():
            print("✅ Поле 'is_paid' уже существует в таблице orders")
        else:
            # Добавляем поле is_paid
            cursor.execute("""
                ALTER TABLE orders 
                ADD COLUMN is_paid BOOLEAN DEFAULT FALSE
            """)
            conn.commit()
            print("✅ Поле 'is_paid' успешно добавлено в таблицу orders")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Готово! Перезапустите backend сервер.")
        
    except psycopg2.Error as e:
        print(f"❌ Ошибка подключения к базе данных:")
        print(f"   {e}")

if __name__ == '__main__':
    add_is_paid_field()
