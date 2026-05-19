-- Миграция: Подготовка к мягкому удалению с суффиксами
-- Дата: 2026-05-12
-- Описание: При мягком удалении к уникальным полям добавляется суффикс _del_ID
--           Это позволяет повторно использовать номера телефонов и гос. номера

-- ============================================
-- КЛИЕНТЫ: Увеличиваем размер поля phone и удаляем ограничения
-- ============================================

-- Увеличиваем размер поля phone для хранения суффикса _del_ID
ALTER TABLE clients ALTER COLUMN phone TYPE VARCHAR(50);

-- Удаляем ВСЕ существующие ограничения и индексы на phone
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_phone_key;
DROP INDEX IF EXISTS clients_phone_unique;
DROP INDEX IF EXISTS clients_phone_unique_active;
DROP INDEX IF EXISTS clients_phone_idx;

-- Создаем новый обычный уникальный индекс на телефон
CREATE UNIQUE INDEX clients_phone_unique ON clients (phone);

COMMENT ON COLUMN clients.phone IS 
'Телефон клиента. При мягком удалении к номеру добавляется суффикс _del_{ID} для освобождения номера.';


-- ============================================
-- АВТОМОБИЛИ: Увеличиваем размер поля license_plate и удаляем ограничения
-- ============================================

-- Увеличиваем размер поля license_plate для хранения суффикса _del_ID
ALTER TABLE cars ALTER COLUMN license_plate TYPE VARCHAR(50);

-- Удаляем ВСЕ существующие ограничения и индексы на license_plate
ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_license_plate_key;
DROP INDEX IF EXISTS cars_license_plate_unique;
DROP INDEX IF EXISTS cars_license_plate_unique_active;
DROP INDEX IF EXISTS cars_license_plate_idx;

-- Создаем новый обычный уникальный индекс на гос. номер
CREATE UNIQUE INDEX cars_license_plate_unique ON cars (license_plate);

COMMENT ON COLUMN cars.license_plate IS 
'Гос. номер автомобиля. При мягком удалении к номеру добавляется суффикс _del_{ID} для освобождения номера.';


-- ============================================
-- СОТРУДНИКИ: Уникальность телефона
-- ============================================

-- Удаляем старые индексы
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_phone_key;
DROP INDEX IF EXISTS employees_phone_unique;
DROP INDEX IF EXISTS employees_phone_idx;

-- Создаем новый индекс
CREATE UNIQUE INDEX employees_phone_unique ON employees (phone);


-- ============================================
-- ДОЛЖНОСТИ: Уникальность названия
-- ============================================

-- Удаляем старые индексы
ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_name_key;
DROP INDEX IF EXISTS positions_name_unique;
DROP INDEX IF EXISTS positions_name_idx;

-- Создаем новый индекс
CREATE UNIQUE INDEX positions_name_unique ON positions (name);


-- ============================================
-- ОЧИСТКА: Удаляем суффиксы у активных записей (если есть)
-- ============================================

-- Если у активных клиентов есть суффиксы - удаляем их
UPDATE clients 
SET phone = SPLIT_PART(phone, '_del_', 1)
WHERE is_active = TRUE AND phone LIKE '%_del_%';

-- Если у активных автомобилей есть суффиксы - удаляем их
UPDATE cars 
SET license_plate = SPLIT_PART(license_plate, '_del_', 1)
WHERE is_active = TRUE AND license_plate LIKE '%_del_%';


-- ============================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ============================================

-- Показываем все индексы на уникальные поля
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('clients', 'cars', 'employees', 'positions')
    AND indexname LIKE '%unique%'
ORDER BY tablename, indexname;

-- Показываем размеры полей
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name IN ('clients', 'cars')
    AND column_name IN ('phone', 'license_plate')
ORDER BY table_name, column_name;
