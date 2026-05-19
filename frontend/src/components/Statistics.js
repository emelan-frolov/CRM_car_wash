import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './Statistics.css';

const formatMoney = (n) => {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n || 0) + ' ₽';
};

// Получение даты в формате YYYY-MM-DD
const formatDate = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Statistics() {
  const [tab, setTab] = useState('finance'); // 'finance' | 'employees' | 'boxes'
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 29);
    return {
      start: formatDate(monthAgo),
      end: formatDate(today),
      preset: 'month'
    };
  });
  
  const [financeData, setFinanceData] = useState(null);
  const [employeesData, setEmployeesData] = useState(null);
  const [boxesData, setBoxesData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const setPreset = (preset) => {
    const today = new Date();
    let start;
    
    if (preset === 'today') {
      start = new Date(today);
    } else if (preset === 'week') {
      start = new Date(today);
      start.setDate(start.getDate() - 6);
    } else if (preset === 'month') {
      start = new Date(today);
      start.setDate(start.getDate() - 29);
    } else if (preset === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
    } else {
      return;
    }
    
    setPeriod({
      start: formatDate(start),
      end: formatDate(today),
      preset
    });
  };
  
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { start_date: period.start, end_date: period.end };
      
      if (tab === 'finance') {
        const res = await api.get(`/stats/finance`, { params });
        setFinanceData(res.data);
      } else if (tab === 'employees') {
        const res = await api.get(`/stats/employees`, { params });
        setEmployeesData(res.data);
      } else if (tab === 'boxes') {
        const res = await api.get(`/stats/boxes`, { params });
        setBoxesData(res.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  }, [tab, period.start, period.end]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  return (
    <div className="stats-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Статистика</h2>
      </div>
      
      <div className="stats-tabs">
        <button 
          className={`stats-tab ${tab === 'finance' ? 'active' : ''}`}
          onClick={() => setTab('finance')}
        >
          Финансы
        </button>
        <button 
          className={`stats-tab ${tab === 'employees' ? 'active' : ''}`}
          onClick={() => setTab('employees')}
        >
          Сотрудники
        </button>
        <button 
          className={`stats-tab ${tab === 'boxes' ? 'active' : ''}`}
          onClick={() => setTab('boxes')}
        >
          Боксы
        </button>
      </div>
      
      <div className="stats-period">
        <div className="stats-period-presets">
          <button 
            className={`stats-period-preset ${period.preset === 'today' ? 'active' : ''}`}
            onClick={() => setPreset('today')}
          >Сегодня</button>
          <button 
            className={`stats-period-preset ${period.preset === 'week' ? 'active' : ''}`}
            onClick={() => setPreset('week')}
          >Неделя</button>
          <button 
            className={`stats-period-preset ${period.preset === 'month' ? 'active' : ''}`}
            onClick={() => setPreset('month')}
          >Месяц</button>
          <button 
            className={`stats-period-preset ${period.preset === 'year' ? 'active' : ''}`}
            onClick={() => setPreset('year')}
          >Год</button>
        </div>
        <div className="stats-period-dates">
          <input 
            type="date"
            value={period.start}
            onChange={(e) => setPeriod({ ...period, start: e.target.value, preset: 'custom' })}
          />
          <span>—</span>
          <input 
            type="date"
            value={period.end}
            onChange={(e) => setPeriod({ ...period, end: e.target.value, preset: 'custom' })}
          />
        </div>
      </div>
      
      {loading && <div className="loading">Загрузка...</div>}
      
      {!loading && tab === 'finance' && financeData && (
        <FinanceTab data={financeData} />
      )}
      
      {!loading && tab === 'employees' && employeesData && (
        <EmployeesTab data={employeesData} />
      )}
      
      {!loading && tab === 'boxes' && boxesData && (
        <BoxesTab data={boxesData} />
      )}
    </div>
  );
}

function FinanceTab({ data }) {
  const maxRevenue = Math.max(...(data.top_services || []).map(s => s.revenue), 1);
  
  return (
    <>
      <div className="stats-cards">
        <div className="stats-card green">
          <div className="stats-card-label">Общая выручка</div>
          <div className="stats-card-value">{formatMoney(data.total_revenue)}</div>
          <div className="stats-card-sub">только оплаченные заказы</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-label">Завершённых заказов</div>
          <div className="stats-card-value">{data.orders_count}</div>
        </div>
        <div className="stats-card orange">
          <div className="stats-card-label">Средний чек</div>
          <div className="stats-card-value">{formatMoney(data.average_check)}</div>
        </div>
      </div>
      
      <div className="stats-section">
        <h3 className="stats-section-title">Топ услуг по выручке</h3>
        {data.top_services && data.top_services.length > 0 ? (
          <div className="bar-chart">
            {data.top_services.map(s => (
              <div key={s.id} className="bar-row">
                <div className="bar-label" title={s.name}>{s.name}</div>
                <div className="bar-track">
                  <div 
                    className="bar-fill green"
                    style={{ width: `${(s.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
                <div className="bar-value">{formatMoney(s.revenue)} · {s.count} шт</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stats-empty">Нет данных за выбранный период</div>
        )}
      </div>
      
      <div className="stats-section">
        <h3 className="stats-section-title">Выручка по дням</h3>
        {data.revenue_by_day && data.revenue_by_day.length > 0 ? (
          <DailyChart days={data.revenue_by_day} />
        ) : (
          <div className="stats-empty">Нет данных за выбранный период</div>
        )}
      </div>
    </>
  );
}

function DailyChart({ days }) {
  const maxRev = Math.max(...days.map(d => d.revenue), 1);
  
  return (
    <div className="hour-chart" style={{ height: '180px' }}>
      {days.map(d => {
        const height = (d.revenue / maxRev) * 100;
        const dateObj = new Date(d.date + 'T00:00:00');
        const label = `${dateObj.getDate()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        return (
          <div key={d.date} className="hour-bar" title={`${d.date}: ${formatMoney(d.revenue)} (${d.count} зак.)`}>
            <div className="hour-bar-track">
              <div 
                className="hour-bar-fill"
                style={{ height: `${height}%`, width: '100%' }}
                data-count={`${formatMoney(d.revenue)} · ${d.count}`}
              />
            </div>
            <div className="hour-bar-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function EmployeesTab({ data }) {
  const totalSalary = data.employees.reduce((sum, e) => sum + e.salary, 0);
  const totalRevenue = data.employees.reduce((sum, e) => sum + e.orders_revenue, 0);
  const totalOrders = data.employees.reduce((sum, e) => sum + e.orders_count, 0);
  
  return (
    <>
      <div className="stats-cards">
        <div className="stats-card purple">
          <div className="stats-card-label">К выдаче (всего)</div>
          <div className="stats-card-value">{formatMoney(totalSalary)}</div>
          <div className="stats-card-sub">зарплатная ведомость</div>
        </div>
        <div className="stats-card green">
          <div className="stats-card-label">Выручка от сотрудников</div>
          <div className="stats-card-value">{formatMoney(totalRevenue)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-label">Всего выполнено заказов</div>
          <div className="stats-card-value">{totalOrders}</div>
        </div>
      </div>
      
      <div className="stats-section">
        <h3 className="stats-section-title">Зарплатная ведомость</h3>
        {data.employees.length > 0 ? (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Должность</th>
                <th>Тип</th>
                <th>Заказов</th>
                <th>Часов</th>
                <th>Выручка</th>
                <th>К выдаче</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map(e => (
                <tr key={e.id}>
                  <td>
                    <div>{e.full_name}</div>
                    {e.status !== 'active' && (
                      <span className={`status-badge-mini ${e.status}`}>
                        {e.status === 'sick_leave' ? 'Больничный' : 'Уволен'}
                      </span>
                    )}
                  </td>
                  <td>{e.position_name || '-'}</td>
                  <td>{e.salary_type_display}</td>
                  <td>{e.orders_count}</td>
                  <td>{e.salary_type === 'fixed' ? `${e.hours_worked} ч` : '-'}</td>
                  <td>{formatMoney(e.orders_revenue)}</td>
                  <td className="salary-amount">{formatMoney(e.salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="stats-empty">Нет сотрудников</div>
        )}
      </div>
    </>
  );
}

function BoxesTab({ data }) {
  const maxHourCount = Math.max(...(data.by_hour || []).map(h => h.count), 1);
  
  const totalOrders = data.boxes_utilization.reduce((sum, b) => sum + b.orders_count, 0);
  const totalRevenue = data.boxes_utilization.reduce((sum, b) => sum + b.revenue, 0);
  const avgUtil = data.boxes_utilization.length > 0
    ? Math.round(data.boxes_utilization.reduce((sum, b) => sum + b.utilization_percent, 0) / data.boxes_utilization.length)
    : 0;
  
  return (
    <>
      <div className="stats-cards">
        <div className="stats-card">
          <div className="stats-card-label">Заказов в боксах</div>
          <div className="stats-card-value">{totalOrders}</div>
        </div>
        <div className="stats-card green">
          <div className="stats-card-label">Выручка</div>
          <div className="stats-card-value">{formatMoney(totalRevenue)}</div>
        </div>
        <div className="stats-card orange">
          <div className="stats-card-label">Средняя загрузка</div>
          <div className="stats-card-value">{avgUtil}%</div>
        </div>
      </div>
      
      <div className="stats-section">
        <h3 className="stats-section-title">Загрузка по часам</h3>
        {data.by_hour && data.by_hour.length > 0 ? (
          <div className="hour-chart">
            {data.by_hour.map(h => (
              <div key={h.hour} className="hour-bar" title={`${h.hour}:00 — ${h.count} заказов`}>
                <div className="hour-bar-track">
                  <div 
                    className="hour-bar-fill"
                    style={{ height: `${(h.count / maxHourCount) * 100}%`, width: '100%' }}
                    data-count={`${h.count} зак.`}
                  />
                </div>
                <div className="hour-bar-value">{h.count}</div>
                <div className="hour-bar-label">{h.hour}:00</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stats-empty">Нет данных за выбранный период</div>
        )}
      </div>
      
      <div className="stats-section">
        <h3 className="stats-section-title">Коэффициент использования боксов</h3>
        {data.boxes_utilization.length > 0 ? (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Бокс</th>
                <th>Заказов</th>
                <th>Занято (часов)</th>
                <th>Доступно (часов)</th>
                <th className="utilization-bar-cell">Использование</th>
                <th>Выручка</th>
              </tr>
            </thead>
            <tbody>
              {data.boxes_utilization.map(b => {
                const cls = b.utilization_percent < 30 ? 'low' : (b.utilization_percent < 60 ? 'medium' : 'high');
                return (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong></td>
                    <td>{b.orders_count}</td>
                    <td>{b.busy_hours} ч</td>
                    <td>{b.available_hours} ч</td>
                    <td className="utilization-bar-cell">
                      <div className="utilization-bar">
                        <div className="utilization-bar-track">
                          <div 
                            className={`utilization-bar-fill ${cls}`}
                            style={{ width: `${b.utilization_percent}%` }}
                          />
                        </div>
                        <span className="utilization-percent">{b.utilization_percent}%</span>
                      </div>
                    </td>
                    <td>{formatMoney(b.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="stats-empty">Нет активных боксов</div>
        )}
      </div>
    </>
  );
}

export default Statistics;
