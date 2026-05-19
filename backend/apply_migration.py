#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Скрипт для применения миграций базы данных
"""

import psycopg2
import os
import sys
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Загружаем переменные окружения
load_dotenv()

# Параметры подключения к БД
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'crm_car_wash',
    'user': 'postgres',
    'password': '1234'
}

def apply_migration(migration_file):
    """Применить SQL миграцию"""
    try:
        # Подключаемся к БД
        print(f"Подключение к базе данных {DB_CONFIG['database']}...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Читаем файл миграции
        print(f"Чтение файла миграции: {migration_file}")
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        # Выполняем миграцию
        print("Применение миграции...")
        cursor.execute(sql)
        conn.commit()
        
        print("✅ Миграция успешно применена!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Ошибка при применении миграции: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        raise

def list_migrations():
    """Показать список доступных миграций"""
    migrations_dir = 'migrations'
    if not os.path.exists(migrations_dir):
        print("Папка migrations не найдена")
        return []
    
    migrations = [f for f in os.listdir(migrations_dir) if f.endswith('.sql')]
    migrations.sort()
    
    print("\n📋 Доступные миграции:")
    for i, migration in enumerate(migrations, 1):
        print(f"  {i}. {migration}")
    
    return migrations

if __name__ == '__main__':
    print("=" * 60)
    print("ПРИМЕНЕНИЕ МИГРАЦИЙ БАЗЫ ДАННЫХ")
    print("=" * 60)
    print()
    
    # Если передан аргумент - применяем конкретную миграцию
    if len(sys.argv) > 1:
        migration_file = sys.argv[1]
        if not migration_file.startswith('migrations/'):
            migration_file = f'migrations/{migration_file}'
        apply_migration(migration_file)
    else:
        # Иначе показываем список и даем выбрать
        migrations = list_migrations()
        
        if not migrations:
            print("Нет доступных миграций")
            sys.exit(0)
        
        print("\nВыберите миграцию для применения (или 'all' для всех):")
        choice = input("Введите номер или 'all': ").strip()
        
        if choice.lower() == 'all':
            print("\n🚀 Применение всех миграций...")
            for migration in migrations:
                print(f"\n--- {migration} ---")
                apply_migration(f'migrations/{migration}')
        else:
            try:
                index = int(choice) - 1
                if 0 <= index < len(migrations):
                    apply_migration(f'migrations/{migrations[index]}')
                else:
                    print("❌ Неверный номер миграции")
            except ValueError:
                print("❌ Неверный ввод")
    
    print("\n" + "=" * 60)
    print("ГОТОВО!")
    print("=" * 60)
