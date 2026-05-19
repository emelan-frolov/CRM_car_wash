-- Миграция: Добавление мягкого удаления для услуг
-- Дата: 2026-05-12

-- Добавляем поле is_active в таблицу services
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Устанавливаем значение TRUE для всех существующих услуг
UPDATE services 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- Добавляем поле created_at если его нет
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Комментарий к полю
COMMENT ON COLUMN services.is_active IS 'Флаг активности услуги (мягкое удаление). FALSE = удалена, но сохраняется в истории заказов';
