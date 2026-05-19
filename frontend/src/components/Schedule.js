import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import './Schedule.css';
import NewOrderModal from './NewOrderModal';

const formatLicensePlateShort = (plate) => {
  if (!plate) return '';
  return plate.slice(0, 6);
};

const formatPhoneNumber = (value) => {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  const limited = cleaned.slice(0, 11);
  
  if (limited.length === 0) return '';
  if (limited.length <= 1) return limited;
  if (limited.length <= 4) return `${limited[0]} (${limited.slice(1)}`;
  if (limited.length <= 7) return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4)}`;
  if (limited.length <= 9) return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7)}`;
  return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7, 9)}-${limited.slice(9, 11)}`;
};

function Schedule() {
  const [boxes, setBoxes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [boxSchedules, setBoxSchedules] = useState([]);

  useEffect(() => {
    loadData();
    
    // Обновление данных каждые 30 секунд
    const dataInterval = setInterval(() => {
      loadData();
    }, 30000);
    
    // Обновление текущего времени каждую секунду
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      
      // Получаем сегодняшнюю дату в формате YYYY-MM-DD
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const [boxesRes, ordersRes, schedulesRes] = await Promise.all([
        api.get(`/boxes`),
        api.get(`/orders/schedule`),
        api.get(`/box-schedules`, {
          params: { start_date: todayStr, end_date: todayStr }
        })
      ]);
      
      const activeBoxes = boxesRes.data.filter(b => b.is_active);
      
      setBoxes(activeBoxes);
      setOrders(ordersRes.data);
      setBoxSchedules(schedulesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  // Генерация временной шкалы: 2 часа назад + 4 часа вперед, но в пределах 10:00–22:00
  // useMemo зависит от часа, чтобы шкала сдвигалась со временем
  const currentHourKey = `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()}-${currentTime.getHours()}`;
  const timeSlots = useMemo(() => {
    const slots = [];
    const now = new Date();
    
    // Границы рабочего дня
    const workStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0);
    const workEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0, 0);
    
    // Желаемое окно: 2 часа назад + 4 часа вперед
    let startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    startTime.setMinutes(0, 0, 0);
    let endTime = new Date(startTime.getTime() + 6 * 60 * 60 * 1000); // 6 часов всего
    
    // Обрезаем по границам рабочего дня
    if (startTime < workStart) startTime = new Date(workStart);
    if (endTime > workEnd) endTime = new Date(workEnd);
    
    // Если окно сместилось из-за обрезания справа - подвинем начало назад
    // (например, сейчас 21:00, окно должно было быть 19:00-01:00, обрезали до 22:00,
    //  но окно всё равно должно показывать 6 часов, поэтому начало = 16:00)
    const desiredDurationMs = 6 * 60 * 60 * 1000;
    if (endTime - startTime < desiredDurationMs) {
      const newStart = new Date(endTime.getTime() - desiredDurationMs);
      if (newStart >= workStart) startTime = newStart;
    }
    // Аналогично, если обрезали слева - подвинем конец вперёд
    if (endTime - startTime < desiredDurationMs) {
      const newEnd = new Date(startTime.getTime() + desiredDurationMs);
      if (newEnd <= workEnd) endTime = newEnd;
    }
    
    // Генерируем слоты по 15 минут
    const totalMinutes = (endTime - startTime) / (60 * 1000);
    const slotsCount = Math.floor(totalMinutes / 15);
    
    for (let i = 0; i < slotsCount; i++) {
      const time = new Date(startTime.getTime() + i * 15 * 60 * 1000);
      slots.push(time);
    }
    
    return slots;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHourKey]);

  const formatTimeSlot = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    // Если это начало часа (00 минут), показываем только часы
    if (minutes === '00') {
      return hours;
    }
    // Иначе показываем только минуты
    return minutes;
  };

  const formatCurrentTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const getEmployeeForBox = (boxId) => {
    const schedule = boxSchedules.find(s => s.box_id === boxId);
    return schedule ? schedule.employee_name : null;
  };

  const isHourStart = (date) => {
    return date.getMinutes() === 0;
  };

  // Получить позицию и ширину заказа на временной шкале
  const getOrderPosition = (order) => {
    if (!order.scheduled_time || !order.service_duration) {
      return null;
    }

    const orderStart = new Date(order.scheduled_time);
    const orderEnd = new Date(orderStart.getTime() + order.service_duration * 60 * 1000);
    const scheduleStart = timeSlots[0];
    const scheduleEnd = new Date(timeSlots[timeSlots.length - 1].getTime() + 15 * 60 * 1000);

    // Если заказ полностью вне видимого диапазона - не показываем
    if (orderEnd <= scheduleStart || orderStart >= scheduleEnd) {
      return null;
    }

    // Обрезаем заказ по границам видимого окна
    const visibleStart = orderStart < scheduleStart ? scheduleStart : orderStart;
    const visibleEnd = orderEnd > scheduleEnd ? scheduleEnd : orderEnd;

    // Вычисляем в каких ЯЧЕЙКАХ находится заказ
    const totalSlots = timeSlots.length; // 24 ячейки
    const startMinutesFromScheduleStart = (visibleStart - scheduleStart) / (60 * 1000);
    const endMinutesFromScheduleStart = (visibleEnd - scheduleStart) / (60 * 1000);
    
    // Номер начальной и конечной ячейки (каждая ячейка = 15 минут)
    const startSlotIndex = Math.floor(startMinutesFromScheduleStart / 15);
    const endSlotIndex = Math.ceil(endMinutesFromScheduleStart / 15);
    
    // Количество ячеек которые занимает заказ
    const slotsCount = endSlotIndex - startSlotIndex;
    
    // Позиция и ширина в процентах (каждая ячейка = 100% / 24)
    const slotWidthPercent = 100 / totalSlots;
    const left = startSlotIndex * slotWidthPercent;
    const width = slotsCount * slotWidthPercent;

    return { left: `${left}%`, width: `${width}%` };
  };

  const getOrderProgress = (order) => {
    if (order.status !== 'in_progress' || !order.scheduled_time || !order.service_duration) {
      return 0;
    }

    const orderStart = new Date(order.scheduled_time);
    const orderEnd = new Date(orderStart.getTime() + order.service_duration * 60 * 1000);
    const now = currentTime;

    if (now < orderStart) return 0;
    if (now > orderEnd) return 100;

    const totalDuration = orderEnd - orderStart;
    const elapsed = now - orderStart;
    return (elapsed / totalDuration) * 100;
  };

  const getOrderColor = (order) => {
    switch (order.status) {
      case 'pending':
        return '#f39c12'; // Оранжевый
      case 'in_progress':
        return '#3498db'; // Синий
      case 'completed':
        return '#2ecc71'; // Зеленый
      default:
        return '#95a5a6'; // Серый
    }
  };

  const isOrderOverdue = (order) => {
    if (order.status !== 'in_progress' || !order.scheduled_time || !order.total_duration) {
      return false;
    }
    const orderStart = new Date(order.scheduled_time);
    const orderEnd = new Date(orderStart.getTime() + order.total_duration * 60 * 1000);
    return currentTime > orderEnd;
  };

  // Завершить заказ (не трогаем поле is_paid - оно остаётся как в БД)
  const handleCompleteOrder = async (orderId) => {
    try {
      await api.put(`/orders/${orderId}`, {
        status: 'completed',
        completed_time: new Date().toISOString()
      });
      setSelectedOrder(null);
      loadData();
    } catch (error) {
      console.error('Ошибка завершения заказа:', error);
      alert('Не удалось завершить заказ');
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await api.put(`/orders/${orderId}`, {
        status: 'cancelled'
      });
      setSelectedOrder(null);
      loadData();
    } catch (error) {
      console.error('Ошибка отмены заказа:', error);
      alert('Не удалось отменить заказ');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await api.delete(`/orders/${orderId}`);
      setSelectedOrder(null);
      loadData();
    } catch (error) {
      console.error('Ошибка удаления заказа:', error);
      alert('Не удалось удалить заказ');
    }
  };

  const handleChangeStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}`, {
        status: newStatus
      });
      // Обновляем выбранный заказ локально
      setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);
      loadData();
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      alert('Не удалось изменить статус заказа');
    }
  };

  const handleMarkAsPaid = async (orderId) => {
    try {
      await api.put(`/orders/${orderId}`, {
        is_paid: true
      });
      // Обновляем выбранный заказ локально
      setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, is_paid: true } : prev);
      loadData();
    } catch (error) {
      console.error('Ошибка пометки оплаты:', error);
      alert('Не удалось пометить заказ как оплаченный');
    }
  };

  const handleOrderClick = (order) => {
    // Если кликнули на тот же заказ - закрываем панель
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(null);
    } else {
      setSelectedOrder(order);
    }
  };

  // Проверка, является ли время текущим (интервал ПОСЛЕ этой метки)
  const isCurrentTime = (time) => {
    const now = currentTime;
    const nextSlot = new Date(time.getTime() + 15 * 60 * 1000);
    // Проверяем что текущее время БОЛЬШЕ этой метки и МЕНЬШЕ следующей
    return now > time && now <= nextSlot;
  };

  const getCurrentTimePosition = () => {
    const scheduleStart = timeSlots[0];
    const scheduleEnd = new Date(timeSlots[timeSlots.length - 1].getTime() + 15 * 60 * 1000);
    const now = currentTime;

    if (now < scheduleStart || now > scheduleEnd) return null;

    // Вычисляем позицию так же как для заказов - через ячейки
    const totalSlots = timeSlots.length; // 24 ячейки
    const minutesFromScheduleStart = (now - scheduleStart) / (60 * 1000);
    
    // Позиция в процентах от начала (каждая ячейка = 100% / 24)
    const slotWidthPercent = 100 / totalSlots;
    const left = (minutesFromScheduleStart / 15) * slotWidthPercent;

    return `${left}%`;
  };

  if (loading) {
    return (
      <div className="loading" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <div>Загрузка расписания...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', color: '#e74c3c' }}>❌</div>
        <div style={{ color: '#e74c3c', marginBottom: '1rem' }}>Ошибка загрузки данных</div>
        <div style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>{error}</div>
        <button 
          className="btn btn-primary" 
          style={{ marginTop: '1rem' }}
          onClick={loadData}
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="schedule-container">
      <div className="schedule-header-section">
        <div className="schedule-legend">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#f39c12' }}></span>
            <span>Ожидает</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#3498db' }}></span>
            <span>В работе</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#2ecc71' }}></span>
            <span>Завершен</span>
          </div>
        </div>
        <button 
          className="btn btn-success" 
          style={{ fontSize: '1.1rem', padding: '0.75rem 2rem', margin: '0.1rem 0' }}
          onClick={() => setShowNewOrderModal(true)}
        >
          + Новый заказ
        </button>
      </div>

      {/* Панель управления выбранным заказом или пустое место */}
      {selectedOrder ? (
        <div className="order-control-panel">
          <div className="order-control-info">
            <div className="order-info-row">
              <strong>Клиент:</strong> {selectedOrder.client_name} | {formatPhoneNumber(selectedOrder.client_phone)}
            </div>
            <div className="order-info-row">
              <strong>Автомобиль:</strong> {selectedOrder.car_license_plate} | {selectedOrder.car_info || 'Марка/модель не указаны'}
            </div>
            <div className="order-info-row">
              <strong>Статус:</strong> {
                selectedOrder.status === 'pending' ? 'Ожидает' :
                selectedOrder.status === 'in_progress' ? 'В работе' :
                selectedOrder.status === 'completed' ? 'Завершен' : selectedOrder.status
              } | <strong>Оплата:</strong> {selectedOrder.is_paid ? 'Оплачен' : 'Не оплачен'}
            </div>
          </div>
          <div className="order-control-buttons">
            {selectedOrder.status !== 'in_progress' && (
              <button 
                className="btn btn-primary"
                onClick={() => handleChangeStatus(selectedOrder.id, 'in_progress')}
              >
                В работе
              </button>
            )}
            {selectedOrder.status !== 'pending' && selectedOrder.status !== 'completed' && (
              <button 
                className="btn"
                style={{ backgroundColor: '#f39c12', color: 'white' }}
                onClick={() => handleChangeStatus(selectedOrder.id, 'pending')}
              >
                В ожидании
              </button>
            )}
            {selectedOrder.status !== 'completed' && (
              <button 
                className="btn btn-success"
                onClick={() => handleCompleteOrder(selectedOrder.id)}
              >
                Завершить
              </button>
            )}
            {!selectedOrder.is_paid && (
              <button 
                className="btn"
                style={{ backgroundColor: '#27ae60', color: 'white' }}
                onClick={() => handleMarkAsPaid(selectedOrder.id)}
              >
                Оплачен
              </button>
            )}
            <button 
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('ВНИМАНИЕ! Вы действительно хотите УДАЛИТЬ этот заказ?\n\nЭто действие нельзя отменить!')) {
                  handleDeleteOrder(selectedOrder.id);
                }
              }}
            >
              Удалить
            </button>
          </div>
        </div>
      ) : (
        <div className="order-control-placeholder"></div>
      )}

      {boxes.length === 0 ? (
        <div className="card empty-schedule">
          <div className="empty-schedule-icon">📦</div>
          <div className="empty-schedule-text">Боксы не настроены</div>
          <div className="empty-schedule-hint">
            Перейдите в раздел "Настройки" чтобы добавить боксы
          </div>
          <button 
            className="btn btn-primary" 
            style={{ marginTop: '1rem' }}
            onClick={loadData}
          >
            🔄 Обновить
          </button>
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#7f8c8d' }}>
            <strong>Отладка:</strong><br/>
            Загружено боксов: {boxes.length}<br/>
            API URL: /boxes
          </div>
        </div>
      ) : (
        <div className="schedule-wrapper" style={{ overflowX: 'auto' }}>
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="box-header-cell">Боксы</th>
                <th className="timeline-header-cell">
                  <div className="timeline-slots">
                    {timeSlots.map((time, index) => {
                      const nextTime = index < timeSlots.length - 1 ? timeSlots[index + 1] : null;
                      const shouldHighlight = nextTime && isCurrentTime(time);
                      
                      return (
                        <div key={index} className="timeline-slot-wrapper">
                          <div className={`time-slot ${isHourStart(time) ? 'hour-mark' : ''}`}>
                            {formatTimeSlot(time)}
                          </div>
                          {shouldHighlight && <div className="timeline-slot-highlight"></div>}
                        </div>
                      );
                    })}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {boxes.map((box) => {
                const boxOrders = orders.filter(o => o.box_id === box.id);
                const employeeName = getEmployeeForBox(box.id);
                
                return (
                  <tr key={box.id}>
                    <td className="box-name-cell">
                      <div className="box-name">{box.name}</div>
                      {employeeName && (
                        <div className="box-employee">{employeeName}</div>
                      )}
                    </td>
                    <td className="timeline-cell">
                      <div className="timeline-grid">
                        {/* Сетка временных слотов */}
                        {timeSlots.map((time, index) => (
                          <div
                            key={index}
                            className="grid-slot-wrapper"
                          >
                            <div className={`grid-slot ${isHourStart(time) ? 'hour-mark' : ''}`}></div>
                          </div>
                        ))}
                        
                        {/* Заказы как карточки */}
                        {boxOrders.map((order) => {
                          const position = getOrderPosition(order);
                          if (!position) return null;

                          const progress = getOrderProgress(order);
                          const color = getOrderColor(order);
                          const isOverdue = isOrderOverdue(order);
                          const isUnpaid = !order.is_paid;

                          return (
                            <div
                              key={order.id}
                              className={`order-card ${isOverdue ? 'order-overdue' : ''} ${isUnpaid ? 'order-unpaid' : ''}`}
                              style={{
                                left: position.left,
                                width: position.width,
                                backgroundColor: color
                              }}
                              title={`${order.client_name}\n${order.car_license_plate || ''} ${order.car_info || ''}\n${order.service_names}\n${isUnpaid ? '❌ НЕ ОПЛАЧЕН' : '✓ Оплачен'}\nКликните для управления`}
                              onClick={() => handleOrderClick(order)}
                            >
                              {order.status === 'in_progress' && (
                                <div
                                  className="order-card-progress"
                                  style={{
                                    width: `${progress}%`
                                  }}
                                ></div>
                              )}
                              <div className="order-card-content">
                                <div className="order-plate">{formatLicensePlateShort(order.car_license_plate)}</div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Индикатор текущего времени */}
                        {getCurrentTimePosition() && (
                          <div
                            className="current-time-line"
                            style={{ left: getCurrentTimePosition() }}
                          ></div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно нового заказа */}
      <NewOrderModal
        isOpen={showNewOrderModal}
        onClose={() => setShowNewOrderModal(false)}
        onSuccess={loadData}
      />
    </div>
  );
}

export default Schedule;
