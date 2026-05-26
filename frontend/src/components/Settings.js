import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || "/api";

function Settings() {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: ''
  });

  useEffect(() => {
    loadBoxes();
  }, []);

  const loadBoxes = async () => {
    try {
      const response = await axios.get(`${API_URL}/boxes`, {
        params: { include_inactive: true }
      });
      setBoxes(response.data.filter((box) => box.order_index >= 0));
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки боксов:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/boxes`, {
        name: formData.name,
        order_index: boxes.length
      });
      setFormData({ name: '' });
      setShowForm(false);
      loadBoxes();
    } catch (error) {
      console.error('Ошибка создания бокса:', error);
    }
  };

  const toggleBoxStatus = async (box) => {
    try {
      await axios.put(`${API_URL}/boxes/${box.id}`, {
        ...box,
        is_active: !box.is_active
      });
      loadBoxes();
    } catch (error) {
      console.error('Ошибка обновления бокса:', error);
    }
  };

  const deleteBox = async (box) => {
    if (!window.confirm(`Удалить бокс "${box.name}"? Старые заказы сохранят привязку к этому боксу.`)) {
      return;
    }

    try {
      await axios.put(`${API_URL}/boxes/${box.id}`, {
        ...box,
        is_active: false,
        order_index: -1
      });
      loadBoxes();
    } catch (error) {
      console.error('Ошибка удаления бокса:', error);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div>
      <h2 className="page-title">Настройки</h2>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Управление боксами</h3>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Отмена' : '+ Добавить бокс'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h4>Новый бокс</h4>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Название бокса *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Бокс 4"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-success">Создать</button>
            </form>
          </div>
        )}

        {boxes.length === 0 ? (
          <p>Боксов пока нет. Добавьте первый!</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {boxes.map(box => (
                <tr key={box.id}>
                  <td>{box.name}</td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '4px',
                      backgroundColor: box.is_active ? '#2ecc71' : '#95a5a6',
                      color: 'white',
                      fontSize: '0.85rem'
                    }}>
                      {box.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn"
                      style={{
                        padding: '0.5rem 1rem',
                        marginRight: '0.5rem',
                        backgroundColor: box.is_active ? '#f39c12' : '#2ecc71'
                      }}
                      onClick={() => toggleBoxStatus(box)}
                    >
                      {box.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{
                        padding: '0.5rem 1rem',
                      }}
                      onClick={() => deleteBox(box)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Информация</h3>
        <p style={{ marginTop: '1rem', color: '#7f8c8d' }}>
          • Боксы отображаются в расписании в порядке создания<br/>
          • Деактивированный бокс можно снова активировать<br/>
          • При удалении бокс скрывается из системы, но старые заказы сохраняют привязку к нему
        </p>
      </div>
    </div>
  );
}

export default Settings;
