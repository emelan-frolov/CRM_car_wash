import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CarSelector from './CarSelector';
import Pagination from './Pagination';
import './CarSelector.css';

const API_URL = 'http://localhost:5000/api';

function Cars() {
  const [cars, setCars] = useState([]);
  const [totalCars, setTotalCars] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [selectedCar, setSelectedCar] = useState(null);
  const [searchPlate, setSearchPlate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [formData, setFormData] = useState({
    license_plate: '',
    brand: '',
    model: '',
    color: ''
  });


  useEffect(() => { setCurrentPage(1); }, [searchPlate]);


  useEffect(() => {
    const timer = setTimeout(() => {
      loadCars();
    }, searchPlate ? 300 : 0);
    return () => clearTimeout(timer);
  }, [currentPage, searchPlate]);

  const loadCars = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/cars`, {
        params: {
          page: currentPage,
          page_size: PAGE_SIZE,
          search: searchPlate
        }
      });
      setCars(response.data.items || []);
      setTotalCars(response.data.total || 0);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки автомобилей:', error);

      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        alert('Не удается подключиться к серверу!\n\nBackend не отвечает на ' + API_URL + '\n\nУбедитесь, что backend запущен');
      }

      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('Отправка данных автомобиля:', formData);

    try {
      if (editingCar) {
        console.log('Обновление автомобиля ID:', editingCar.id);
        const response = await axios.put(`${API_URL}/cars/${editingCar.id}`, formData);
        console.log('Автомобиль обновлен:', response.data);
        alert('Автомобиль успешно обновлен!');
        setEditingCar(null);
      } else {
        console.log('Создание нового автомобиля');
        const response = await axios.post(`${API_URL}/cars`, formData);
        console.log('Автомобиль создан:', response.data);
        alert('Автомобиль успешно добавлен!');
      }
      setFormData({ license_plate: '', brand: '', model: '', color: '' });
      setShowForm(false);
      loadCars();
    } catch (error) {
      console.error('Ошибка сохранения автомобиля:', error);


      if (error.response) {

        console.error('Ответ сервера:', error.response.data);
        console.error('Статус:', error.response.status);


        if (error.response.status === 409) {
          const errorData = error.response.data;
          const existingCar = errorData.existing_car;
          let message = `${errorData.error}\n\n`;
          if (existingCar) {
            message += `Информация о существующем автомобиле:\n`;
            message += `• Марка: ${existingCar.brand || 'не указана'}\n`;
            message += `• Модель: ${existingCar.model || 'не указана'}\n`;
            message += `• Цвет: ${existingCar.color || 'не указан'}\n`;
            message += `• Дата добавления: ${new Date(existingCar.created_at).toLocaleDateString('ru-RU')}`;
          }
          alert(message);
        } else if (error.response.status === 400 && error.response.data?.error?.includes('уже существует')) {

          alert(`${error.response.data.error}`);
        } else {
          alert(`Ошибка сервера: ${error.response.data?.error || error.response.statusText}`);
        }
      } else if (error.request) {

        console.error('Запрос отправлен, но ответа нет:', error.request);
        console.error('Проверьте:');
        console.error('  1. Запущен ли backend сервер (http://localhost:5000)');
        console.error('  2. Нет ли блокировки CORS');
        console.error('  3. Правильно ли настроен API_URL:', API_URL);
        alert('Ошибка подключения к серверу!\n\nПроверьте:\n1. Запущен ли backend (http://localhost:5000)\n2. Нет ли ошибок в консоли backend\n3. Откройте консоль браузера (F12) для деталей');
      } else {

        console.error('Ошибка настройки запроса:', error.message);
        alert('Ошибка: ' + error.message);
      }
    }
  };

  const handleEdit = (car) => {
    setEditingCar(car);
    setFormData({
      license_plate: car.license_plate,
      brand: car.brand || '',
      model: car.model || '',
      color: car.color || ''
    });
    setShowForm(true);
    setSelectedCar(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить автомобиль?')) {
      try {
        await axios.delete(`${API_URL}/cars/${id}`);
        setSelectedCar(null);
        loadCars();
      } catch (error) {
        console.error('Ошибка удаления автомобиля:', error);
        alert('Ошибка: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingCar(null);
    setFormData({ license_plate: '', brand: '', model: '', color: '' });
    setShowForm(false);
  };

  const handleRowClick = (car) => {
    if (showForm) return;
    setSelectedCar(selectedCar?.id === car.id ? null : car);
  };

  if (loading && cars.length === 0) return <div className="loading">Загрузка...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Автомобили</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Поиск по гос. номеру..."
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
            style={{
              padding: '0.6rem 1rem',
              fontSize: '0.95rem',
              border: '2px solid #ddd',
              borderRadius: '6px',
              width: '250px',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3498db'}
            onBlur={(e) => e.target.style.borderColor = '#ddd'}
          />
          {selectedCar && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => handleEdit(selectedCar)}
              >
                 Редактировать
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(selectedCar.id)}
              >
                 Удалить
              </button>
            </>
          )}
          <button className="btn btn-success" onClick={() => editingCar ? handleCancelEdit() : setShowForm(!showForm)}>
            {showForm ? 'Отмена' : '+ Добавить автомобиль'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3>{editingCar ? 'Редактирование автомобиля' : 'Новый автомобиль'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Гос. номер *</label>
              <input
                type="text"
                required
                placeholder="А123БВ777"
                value={formData.license_plate}
                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value.toUpperCase() })}
              />
            </div>

            {!editingCar && (
              <div style={{ marginBottom: '1rem' }}>
                <CarSelector
                  selectedBrand={formData.brand}
                  selectedModel={formData.model}
                  onBrandChange={(brand) => setFormData({ ...formData, brand })}
                  onModelChange={(model) => setFormData({ ...formData, model })}
                />
              </div>
            )}

            <div className="form-group">
              <label>Марка {!editingCar && <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>(или выберите выше)</span>}</label>
              <input
                type="text"
                placeholder="Toyota, BMW, Lada..."
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Модель {!editingCar && <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>(или выберите выше)</span>}</label>
              <input
                type="text"
                placeholder="Camry, X5, Vesta..."
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Цвет</label>
              <input
                type="text"
                placeholder="Черный, Белый..."
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-success">Сохранить</button>
          </form>
        </div>
      )}

      <div className="card">
        {totalCars === 0 && !searchPlate ? (
          <p>Автомобилей пока нет. Добавьте первый!</p>
        ) : (
          <>
          <table>
            <thead>
              <tr>
                <th>Гос. номер</th>
                <th>Марка</th>
                <th>Модель</th>
                <th>Цвет</th>
                <th>Дата добавления</th>
              </tr>
            </thead>
            <tbody>
              {cars.map(car => (
                <tr
                  key={car.id}
                  onClick={() => handleRowClick(car)}
                  style={{
                    cursor: showForm ? 'default' : 'pointer',
                    backgroundColor: selectedCar?.id === car.id ? '#e3f2fd' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <td><strong>{car.license_plate}</strong></td>
                  <td>{car.brand || '-'}</td>
                  <td>{car.model || '-'}</td>
                  <td>{car.color || '-'}</td>
                  <td>{new Date(car.created_at).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={totalCars}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
          </>
        )}
      </div>
    </div>
  );
}

export default Cars;
