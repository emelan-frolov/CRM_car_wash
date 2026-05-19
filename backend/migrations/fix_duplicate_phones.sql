-- Миграция: Исправление дубликатов телефонов и номеров
-- Дата: 2026-05-12
-- Описание: Находит и исправляет ситуации, когда есть удаленные записи
--           без суффикса, блокирующие создание новых записей

-- ============================================
-- ДИАГНОСТИКА: Показываем проблемные записи
-- ============================================

-- Клиенты с одинаковыми телефонами
SELECT 
    phone,
    COUNT(*) as count,
    STRING_AGG(CAST(id AS TEXT) || ' (active=' || CAST(is_active AS TEXT) || ')', ', ') as records
FROM clients
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Автомобили с одинаковыми номерами
SELECT 
    license_plate,
    COUNT(*) as count,
    STRING_AGG(CAST(id AS TEXT) || ' (active=' || CAST(is_active AS TEXT) || ')', ', ') as records
FROM cars
GROUP BY license_plate
HAVING COUNT(*) > 1
ORDER BY count DESC;


-- ============================================
-- ИСПРАВЛЕНИЕ: Добавляем суффиксы к удаленным записям
-- ============================================

-- Добавляем суффикс к телефонам удаленных клиентов (если его еще нет)
UPDATE clients 
SET phone = phone || '_del_' || id
WHERE is_active = FALSE 
  AND phone NOT LIKE '%_del_%';

-- Добавляем суффикс к номерам удаленных автомобилей (если его еще нет)
UPDATE cars 
SET license_plate = license_plate || '_del_' || id
WHERE is_active = FALSE 
  AND license_plate NOT LIKE '%_del_%';


-- ============================================
-- ПРОВЕРКА: Показываем результаты
-- ============================================

-- Должно быть 0 дубликатов среди активных клиентов
SELECT 
    'Активные клиенты с дубликатами телефонов' as check_name,
    COUNT(*) as problem_count
FROM (
    SELECT phone
    FROM clients
    WHERE is_active = TRUE
    GROUP BY phone
    HAVING COUNT(*) > 1
) duplicates;

-- Должно быть 0 дубликатов среди активных автомобилей
SELECT 
    'Активные автомобили с дубликатами номеров' as check_name,
    COUNT(*) as problem_count
FROM (
    SELECT license_plate
    FROM cars
    WHERE is_active = TRUE
    GROUP BY license_plate
    HAVING COUNT(*) > 1
) duplicates;

-- Показываем все удаленные записи с суффиксами
SELECT 
    'Удаленные клиенты' as type,
    id,
    phone,
    first_name,
    last_name,
    is_active
FROM clients
WHERE is_active = FALSE
ORDER BY id DESC
LIMIT 10;

SELECT 
    'Удаленные автомобили' as type,
    id,
    license_plate,
    brand,
    model,
    is_active
FROM cars
WHERE is_active = FALSE
ORDER BY id DESC
LIMIT 10;
