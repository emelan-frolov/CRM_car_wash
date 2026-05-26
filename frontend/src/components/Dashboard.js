import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

function Dashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    services: 0,
    orders: 0,
    todayOrders: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [clientsRes, servicesRes, ordersRes] = await Promise.all([
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/services`),
        axios.get(`${API_URL}/orders`)
      ]);


      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayOrders = ordersRes.data.filter(order =>
        order.created_at.startsWith(today)
      ).length;

      setStats({
        clients: clientsRes.data.length,
        services: servicesRes.data.length,
        orders: ordersRes.data.length,
        todayOrders
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  return (
    <div>
      <h2 className="page-title">Панель управления</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#3498db', fontSize: '2.5rem', margin: '0.5rem 0' }}>{stats.clients}</h3>
          <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>Всего клиентов</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#2ecc71', fontSize: '2.5rem', margin: '0.5rem 0' }}>{stats.services}</h3>
          <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>Услуг</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#e67e22', fontSize: '2.5rem', margin: '0.5rem 0' }}>{stats.orders}</h3>
          <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>Всего заказов</p>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#9b59b6', fontSize: '2.5rem', margin: '0.5rem 0' }}>{stats.todayOrders}</h3>
          <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>Заказов сегодня</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Добро пожаловать в CRM систему автомойки!</h3>
        <p style={{ marginTop: '1rem', color: '#7f8c8d' }}>
          Используйте навигацию выше для управления клиентами, услугами и заказами.
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
