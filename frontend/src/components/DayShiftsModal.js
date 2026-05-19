import React, { useState, useEffect } from 'react';
import api from '../api';
import './DayShiftsModal.css';

function DayShiftsModal({ isOpen, onClose, onSuccess, selectedDate, selectedBox, employees, selectedCells = [] }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEmployeeAvailableOnDate = (employee, dateStr) => {
    // Уволенные сотрудники недоступны всегда
    if (employee.status === 'fired') {
      return false;
    }
    
    // Активные сотрудники доступны всегда
    if (employee.status === 'active') {
      return true;
    }
    
    // Для сотрудников на больничном проверяем дату
    if (employee.status === 'sick_leave' && employee.sick_leave_start && employee.sick_leave_end) {
      const checkDate = new Date(dateStr + 'T00:00:00');
      const sickStart = new Date(employee.sick_leave_start + 'T00:00:00');
      const sickEnd = new Date(employee.sick_leave_end + 'T00:00:00');
      
      // Сотрудник недоступен только в период больничного
      return checkDate < sickStart || checkDate > sickEnd;
    }
    
    return true;
  };

  const getAvailableEmployees = () => {
    // Если выбрано несколько ячеек, проверяем доступность для всех дат
    if (selectedCells.length > 0) {
      return employees.filter(emp => {
        // Сотрудник должен быть доступен на все выбранные даты
        return selectedCells.every(cell => isEmployeeAvailableOnDate(emp, cell.date));
      });
    }
    
    // Для одной даты просто проверяем доступность
    return employees.filter(emp => isEmployeeAvailableOnDate(emp, selectedDate));
  };

  useEffect(() => {
    if (isOpen && selectedDate && selectedBox) {
      loadExistingShifts();
    }
  }, [isOpen, selectedDate, selectedBox]);

  const loadExistingShifts = async () => {
    try {
      const response = await api.get(`/box-schedules`, {
        params: {
          start_date: selectedDate,
          end_date: selectedDate
        }
      });
      
      const boxShifts = response.data.filter(
        s => s.box_id === selectedBox.id && s.date === selectedDate
      );
      
      if (boxShifts.length > 0) {
        setShifts(boxShifts.map(s => ({
          id: s.id,
          employee_id: s.employee_id,
          start_time: s.start_time || '10:00',
          end_time: s.end_time || '22:00'
        })));
      } else {
        // Добавляем одну пустую смену по умолчанию
        setShifts([{ employee_id: '', start_time: '10:00', end_time: '22:00' }]);
      }
    } catch (err) {
      console.error('Ошибка загрузки смен:', err);
      setShifts([{ employee_id: '', start_time: '10:00', end_time: '22:00' }]);
    }
  };

  const addShift = () => {
    setShifts([...shifts, { employee_id: '', start_time: '10:00', end_time: '22:00' }]);
  };

  const removeShift = (index) => {
    if (shifts.length === 1) {
      setError('Должна быть хотя бы одна смена');
      return;
    }
    setShifts(shifts.filter((_, i) => i !== index));
  };

  const updateShift = (index, field, value) => {
    const newShifts = [...shifts];
    newShifts[index][field] = value;
    setShifts(newShifts);
  };

  const validateShifts = () => {
    // Проверка что все смены заполнены
    for (let i = 0; i < shifts.length; i++) {
      if (!shifts[i].employee_id) {
        setError(`Выберите сотрудника для смены ${i + 1}`);
        return false;
      }
      
      if (!shifts[i].start_time || !shifts[i].end_time) {
        setError(`Укажите время для смены ${i + 1}`);
        return false;
      }
      
      // Проверка что время окончания больше времени начала
      if (shifts[i].start_time >= shifts[i].end_time) {
        setError(`Время окончания должно быть больше времени начала для смены ${i + 1}`);
        return false;
      }
    }
    
    // Проверка пересечения смен
    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        const shift1 = shifts[i];
        const shift2 = shifts[j];
        
        // Проверка пересечения времени
        if (!(shift1.end_time <= shift2.start_time || shift1.start_time >= shift2.end_time)) {
          setError(`Смены ${i + 1} и ${j + 1} пересекаются по времени`);
          return false;
        }
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateShifts()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Если выбрано несколько ячеек - применяем смены ко всем
      if (selectedCells.length > 0) {
        // Группируем ячейки по боксам
        const cellsByBox = {};
        selectedCells.forEach(cell => {
          if (!cellsByBox[cell.boxId]) {
            cellsByBox[cell.boxId] = [];
          }
          cellsByBox[cell.boxId].push(cell.date);
        });
        
        // Создаем смены для каждого бокса и даты
        const promises = [];
        for (const [boxId, dates] of Object.entries(cellsByBox)) {
          for (const date of dates) {
            promises.push(
              api.post(`/box-schedules/day`, {
                box_id: parseInt(boxId),
                date: date,
                shifts: shifts.map(s => ({
                  employee_id: parseInt(s.employee_id),
                  start_time: s.start_time,
                  end_time: s.end_time
                }))
              })
            );
          }
        }
        
        await Promise.all(promises);
      } else {
        // Одна ячейка - обычное сохранение
        await api.post(`/box-schedules/day`, {
          box_id: selectedBox.id,
          date: selectedDate,
          shifts: shifts.map(s => ({
            employee_id: parseInt(s.employee_id),
            start_time: s.start_time,
            end_time: s.end_time
          }))
        });
      }
      
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Ошибка сохранения смен:', err);
      setError(err.response?.data?.error || 'Ошибка сохранения смен');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShifts([{ employee_id: '', start_time: '10:00', end_time: '22:00' }]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      weekday: 'long'
    });
  };

  const availableEmployees = getAvailableEmployees();

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content day-shifts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 Настройка смен</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        {selectedCells.length > 0 && (
          <div style={{ 
            padding: '1rem', 
            background: '#e3f2fd', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            border: '2px solid #3498db'
          }}>
            <div style={{ fontSize: '1rem', color: '#2c3e50', fontWeight: '600' }}>
              🎯 Массовое назначение: смены будут применены к {selectedCells.length} выбранным ячейкам
            </div>
          </div>
        )}

        <div className="modal-info">
          <div className="info-item">
            <span className="info-label">Бокс:</span>
            <span className="info-value">{selectedBox?.name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Дата:</span>
            <span className="info-value">{formatDate(selectedDate)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="shifts-container">
              {shifts.map((shift, index) => (
                <div key={index} className="shift-row">
                  <div className="shift-number">{index + 1}</div>
                  
                  <div className="shift-fields">
                    <div className="form-group">
                      <label>Сотрудник *</label>
                      <select
                        value={shift.employee_id}
                        onChange={(e) => updateShift(index, 'employee_id', e.target.value)}
                        required
                      >
                        <option value="">Выберите сотрудника</option>
                        {availableEmployees.map(emp => {
                          const onSickLeave = emp.status === 'sick_leave';
                          return (
                            <option key={emp.id} value={emp.id}>
                              {emp.full_name} - {emp.position_name}
                              {onSickLeave ? ' (вне больничного)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {availableEmployees.length === 0 && (
                        <small style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
                          ⚠️ Нет доступных сотрудников на выбранную дату
                        </small>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Время начала *</label>
                      <input
                        type="time"
                        value={shift.start_time}
                        onChange={(e) => updateShift(index, 'start_time', e.target.value)}
                        required
                        min="10:00"
                        max="22:00"
                      />
                    </div>

                    <div className="form-group">
                      <label>Время окончания *</label>
                      <input
                        type="time"
                        value={shift.end_time}
                        onChange={(e) => updateShift(index, 'end_time', e.target.value)}
                        required
                        min="10:00"
                        max="22:00"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    onClick={() => removeShift(index)}
                    disabled={shifts.length === 1}
                    title="Удалить смену"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={addShift}
              style={{ marginTop: '1rem' }}
            >
              + Добавить смену
            </button>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-cancel" onClick={handleClose}>
              Отмена
            </button>
            <button 
              type="submit" 
              className="btn btn-success"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : '✓ Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DayShiftsModal;
