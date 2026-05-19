# Backend CRM Car Wash

## Структура

```
backend/
├── app.py              # Application factory: create_app(), точка входа
├── extensions.py       # db = SQLAlchemy()
├── models.py           # Все ORM-модели
├── auth.py             # Декораторы авторизации (login_required, owner_required, permission_required)
├── utils.py            # Хелперы (get_moscow_time, get_process_executor)
├── routes/
│   ├── __init__.py     # register_blueprints(app)
│   ├── auth.py         # /api/login, /api/register, /api/change-password, /api/auth/me
│   ├── users.py        # /api/users CRUD
│   ├── clients.py      # /api/clients CRUD
│   ├── cars.py         # /api/cars CRUD
│   ├── services.py     # /api/services CRUD
│   ├── boxes.py        # /api/boxes CRUD
│   ├── positions.py    # /api/positions CRUD
│   ├── employees.py    # /api/employees CRUD
│   ├── orders.py       # /api/orders CRUD + status transitions
│   ├── schedule.py     # /api/admin-schedule, /api/employee-schedule, /api/box-schedules
│   ├── statistics.py   # /api/statistics
│   ├── public.py       # /api/public/* (без авторизации)
│   ├── exports.py      # /api/export-orders, /api/export-status, /api/download-export
│   └── health.py       # /api/health
├── tests/
│   ├── conftest.py     # Фикстуры (SQLite in-memory)
│   ├── test_auth.py    # Тесты авторизации
│   ├── test_clients.py # CRUD клиентов
│   ├── test_cars.py    # CRUD авто
│   ├── test_orders.py  # CRUD заказов + бизнес-логика
│   └── test_services.py# CRUD услуг
├── excel_export.py     # Генерация Excel
├── migrate_db.py       # Создание/обновление схемы БД
├── seed_db.py          # Тестовые данные
├── test_api.py         # Smoke-тесты (требуют запущенный сервер)
├── migrations/         # SQL-миграции
├── exports/            # Рабочая папка для Excel-задач
└── requirements.txt
```

## Установка

1. Создайте виртуальное окружение:
```bash
python -m venv venv
source venv/Scripts/activate  # Windows Git Bash
# или: venv\Scripts\activate  # Windows CMD
```

2. Установите зависимости:
```bash
pip install -r requirements.txt
```

3. Создайте файл `.env` на основе `.env.example` и настройте подключение к БД

4. Создайте схему БД:
```bash
python migrate_db.py
```

5. (Опционально) Заполните тестовыми данными:
```bash
python seed_db.py
```

## Запуск

```bash
python app.py
```

Сервер будет доступен на http://localhost:5000

## Тесты

```bash
# Юнит-тесты (не требуют запущенный сервер или PostgreSQL)
pytest

# Smoke-тесты (требуют запущенный сервер)
python test_api.py
```

## Архитектура

Backend использует модульную архитектуру с Flask Blueprints:

- **extensions.py** → экземпляр SQLAlchemy без привязки к app
- **models.py** → все модели, импортирует `db` из extensions
- **auth.py** → декораторы, импортирует models и extensions
- **routes/*.py** → Blueprint'ы, импортируют auth, models, extensions
- **app.py** → фабрика `create_app()`, собирает всё вместе

Импорты идут строго «вниз» по цепочке. Циклические импорты запрещены.
