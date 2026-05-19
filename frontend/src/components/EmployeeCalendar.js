import React, { useState, useEffect } from 'react';
import api from '../api';
import './EmployeeCalendar.css';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function EmployeeCalendar({ employee, onBack }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const loadSchedules = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const response = await api.get(`/box-schedules`, {
        params: { start_date: startDate, end_date: endDate }
      });

      const employeeSchedules = response.data.filter(s => s.employee_id === employee.id);
      setSchedules(employeeSchedules);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки расписания:', error);
      setLoading(false);
    }
  };

  const isSickDay = (dateStr) => {
    if (!employee.sick_leave_start || !employee.sick_leave_end) return false;
    return dateStr >= employee.sick_leave_start && dateStr <= employee.sick_leave_end;
  };

  const isPastDay = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr + 'T00:00:00');
    return date < today;
  };

  const isTodayDay = (dateStr) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
  };

  const getSchedulesForDate = (dateStr) => {
    return schedules.filter(s => s.date === dateStr);
  };

  const buildCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // День недели первого числа (0 = воскресенье, 1 = понедельник)
    let startDay = firstDay.getDay();
    // Преобразуем: Пн=0, Вт=1, ..., Вс=6
    startDay = startDay === 0 ? 6 : startDay - 1;

    const cells = [];
    
    // Пустые ячейки в начале
    for (let i = 0; i < startDay; i++) {
      cells.push({ empty: true, key: `empty-${i}` });
    }
    
    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        empty: false,
        day,
        dateStr,
        key: `day-${day}`
      });
    }
    
    // Дополняем до полных недель
    while (cells.length % 7 !== 0) {
      cells.push({ empty: true, key: `empty-end-${cells.length}` });
    }
    
    // Разбиваем на недели
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    
    return weeks;
  };

  const changeMonth = (offset) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(newDate);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  const weeks = buildCalendarGrid();
  const monthTitle = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  return (
    <div className="calendar-page">
      <div className="calendar-page-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Назад к списку
        </button>
        <h3 className="calendar-employee-title">
          {employee.full_name} — {employee.position_name}
        </h3>
      </div>

      <div className="calendar-month-nav">
        <button onClick={() => changeMonth(-1)}>← Пред</button>
        <h3 className="calendar-month-title">{monthTitle}</h3>
        <button onClick={() => changeMonth(1)}>След →</button>
      </div>

      <div className="calendar-table">
        <div className="calendar-week-row weekdays">
          {WEEKDAYS.map(wd => (
            <div key={wd} className="cal-weekday">{wd}</div>
          ))}
        </div>
        
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="calendar-week-row">
            {week.map(cell => {
              if (cell.empty) {
                return <div key={cell.key} className="cal-cell empty" />;
              }
              
              const daySchedules = getSchedulesForDate(cell.dateStr);
              const sick = isSickDay(cell.dateStr);
              const past = isPastDay(cell.dateStr);
              const today = isTodayDay(cell.dateStr);
              
              const classNames = ['cal-cell'];
              if (sick) classNames.push('sick');
              else if (today) classNames.push('today');
              else if (past) classNames.push('past');
              
              return (
                <div key={cell.key} className={classNames.join(' ')}>
                  <div className="cal-day-num">{cell.day}</div>
                  {daySchedules.slice(0, 2).map((s, i) => (
                    <div key={i} className="cal-shift" title={`${s.box_name} ${s.start_time}-${s.end_time}`}>
                      <div className="cal-shift-box">{s.box_name}</div>
                      <div className="cal-shift-time">{s.start_time}–{s.end_time}</div>
                    </div>
                  ))}
                  {daySchedules.length > 2 && (
                    <div className="cal-shift" style={{ background: '#7f8c8d' }}>
                      +{daySchedules.length - 2}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="calendar-legend">
        <div className="calendar-legend-item">
          <div className="calendar-legend-color past" />
          <span>Прошедшие</span>
        </div>
        <div className="calendar-legend-item">
          <div className="calendar-legend-color today" />
          <span>Сегодня</span>
        </div>
        <div className="calendar-legend-item">
          <div className="calendar-legend-color shift" />
          <span>Смена</span>
        </div>
        <div className="calendar-legend-item">
          <div className="calendar-legend-color sick" />
          <span>Больничный</span>
        </div>
      </div>
    </div>
  );
}

export default EmployeeCalendar;
