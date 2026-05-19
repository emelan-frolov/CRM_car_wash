"""
Скрипт для проверки работы API
Запустите этот скрипт чтобы убедиться что backend работает корректно
"""

import requests
import json

API_URL = 'http://localhost:5000/api'

def test_health():
    """Проверка что сервер запущен"""
    print("🔍 Проверка здоровья сервера...")
    try:
        response = requests.get(f'{API_URL}/health', timeout=5)
        if response.status_code == 200:
            print("✅ Сервер работает!")
            print(f"   Ответ: {response.json()}")
            return True
        else:
            print(f"❌ Сервер вернул код {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Не удалось подключиться к серверу!")
        print("   Убедитесь что backend запущен (python app.py)")
        return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def test_boxes():
    """Проверка получения боксов"""
    print("\n🔍 Проверка получения боксов...")
    try:
        response = requests.get(f'{API_URL}/boxes', timeout=5)
        if response.status_code == 200:
            boxes = response.json()
            print(f"✅ Получено боксов: {len(boxes)}")
            for box in boxes:
                print(f"   - {box['name']} (ID: {box['id']}, Активен: {box['is_active']})")
            return True
        else:
            print(f"❌ Ошибка получения боксов: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def test_services():
    """Проверка получения услуг"""
    print("\n🔍 Проверка получения услуг...")
    try:
        response = requests.get(f'{API_URL}/services', timeout=5)
        if response.status_code == 200:
            services = response.json()
            print(f"✅ Получено услуг: {len(services)}")
            for service in services:
                print(f"   - {service['name']}: {service['price']}₽ ({service['duration']} мин)")
            return True
        else:
            print(f"❌ Ошибка получения услуг: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def test_orders():
    """Проверка получения заказов"""
    print("\n🔍 Проверка получения заказов...")
    try:
        response = requests.get(f'{API_URL}/orders/schedule', timeout=5)
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ Получено заказов: {len(orders)}")
            for order in orders:
                print(f"   - Заказ #{order['id']}: {order['client_name']} - {order['service_names']}")
            return True
        else:
            print(f"❌ Ошибка получения заказов: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def test_cors():
    """Проверка CORS заголовков"""
    print("\n🔍 Проверка CORS заголовков...")
    try:
        response = requests.options(f'{API_URL}/boxes', 
                                   headers={
                                       'Origin': 'http://localhost:3000',
                                       'Access-Control-Request-Method': 'GET'
                                   },
                                   timeout=5)
        
        cors_header = response.headers.get('Access-Control-Allow-Origin')
        if cors_header:
            print(f"✅ CORS настроен правильно!")
            print(f"   Access-Control-Allow-Origin: {cors_header}")
            return True
        else:
            print("⚠️  CORS заголовки не найдены")
            print("   Это может вызвать проблемы с frontend")
            return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def main():
    print("=" * 60)
    print("🧪 ТЕСТИРОВАНИЕ API CRM CAR WASH")
    print("=" * 60)
    
    results = []
    
    # Запускаем тесты
    results.append(("Здоровье сервера", test_health()))
    
    if results[0][1]:  # Если сервер работает, продолжаем тесты
        results.append(("CORS заголовки", test_cors()))
        results.append(("Боксы", test_boxes()))
        results.append(("Услуги", test_services()))
        results.append(("Заказы", test_orders()))
    
    # Итоги
    print("\n" + "=" * 60)
    print("📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status} - {test_name}")
    
    print(f"\nИтого: {passed}/{total} тестов пройдено")
    
    if passed == total:
        print("\n🎉 Все тесты пройдены! Backend работает корректно.")
        print("   Можете запускать frontend: npm start")
    else:
        print("\n⚠️  Некоторые тесты не прошли.")
        print("   Проверьте что:")
        print("   1. PostgreSQL запущен")
        print("   2. База данных 'crm_car_wash' существует")
        print("   3. Backend сервер запущен (python app.py)")
        print("   4. Выполнена миграция (python migrate_db.py)")

if __name__ == '__main__':
    main()
