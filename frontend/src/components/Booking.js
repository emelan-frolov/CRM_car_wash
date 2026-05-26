import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Booking.css';
import CarSelector from './CarSelector';
import './CarSelector.css';

const API_URL = process.env.REACT_APP_API_URL || "/api";


const formatPhoneNumber = (value) => {
  const cleaned = value.replace(/\D/g, '');
  const limited = cleaned.slice(0, 11);

  if (limited.length === 0) return '';
  if (limited.length <= 1) return limited;
  if (limited.length <= 4) return `${limited[0]} (${limited.slice(1)}`;
  if (limited.length <= 7) return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4)}`;
  if (limited.length <= 9) return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7)}`;
  return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7, 9)}-${limited.slice(9, 11)}`;
};

const getCleanPhoneNumber = (formatted) => {
  return formatted.replace(/\D/g, '');
};

function Booking() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  const [clientPhone, setClientPhone] = useState('');
  const [clientFound, setClientFound] = useState(false);
  const [clientData, setClientData] = useState({
    id: null,
    first_name: '',
    last_name: '',
    middle_name: '',
    email: ''
  });


  const [carLicensePlate, setCarLicensePlate] = useState('');
  const [carFound, setCarFound] = useState(false);
  const [carData, setCarData] = useState({
    id: null,
    brand: '',
    model: '',
    color: ''
  });

  const [formData, setFormData] = useState({
    selected_services: [],
    selected_date: null,
    selected_time: null,
    selected_box_id: null,
    notes: ''
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const response = await axios.get(`${API_URL}/services`);
      setServices(response.data);
    } catch (error) {
      console.error('Ошибка загрузки услуг:', error);
    }
  };

  const searchClient = async () => {
    if (!clientPhone) {
      setError('Введите номер телефона');
      return;
    }

    try {
      const cleanPhone = getCleanPhoneNumber(clientPhone);
      const response = await axios.get(`${API_URL}/clients/search`, {
        params: { phone: cleanPhone }
      });
      setClientData({
        id: response.data.id,
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        middle_name: response.data.middle_name || '',
        email: response.data.email || ''
      });
      setClientFound(true);
      setError('');
    } catch (err) {
      if (err.response?.status === 404) {
        setClientFound(false);
        setClientData({
          id: null,
          first_name: '',
          last_name: '',
          middle_name: '',
          email: ''
        });
        setError('');
      } else {
        setError('Ошибка поиска клиента');
      }
    }
  };

  const searchCar = async () => {
    if (!carLicensePlate) {
      setError('Введите гос. номер');
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/cars/search`, {
        params: { license_plate: carLicensePlate.trim().toUpperCase() }
      });
      setCarData({
        id: response.data.id,
        brand: response.data.brand || '',
        model: response.data.model || '',
        color: response.data.color || ''
      });
      setCarFound(true);
      setError('');
    } catch (err) {
      if (err.response?.status === 404) {
        setCarFound(false);
        setCarData({
          id: null,
          brand: '',
          model: '',
          color: ''
        });
        setError('');
      } else {
        setError('Ошибка поиска автомобиля');
      }
    }
  };

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/booking/availability`);
      setAvailability(response.data);
    } catch (error) {
      console.error('Ошибка загрузки доступности:', error);
      alert('Ошибка загрузки календаря');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSlots = async (date) => {
    setLoading(true);
    try {
      const totalDuration = formData.selected_services.reduce((sum, serviceId) => {
        const service = services.find(s => s.id === serviceId);
        return sum + (service?.duration || 0);
      }, 0);

      console.log('Загрузка слотов для даты:', date, 'Длительность:', totalDuration);

      if (totalDuration === 0) {
        setError('У выбранных услуг не указана длительность. Обновите услуги в разделе "Услуги".');
        setTimeSlots([]);
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_URL}/booking/timeslots`, {
        date: date,
        total_duration: totalDuration
      });

      console.log('Получены слоты:', response.data);
      setTimeSlots(response.data.available_slots);
      setError('');
    } catch (error) {
      console.error('Ошибка загрузки временных слотов:', error);
      console.error('Детали ошибки:', error.response?.data);
      setError('Ошибка загрузки доступного времени: ' + (error.response?.data?.error || error.message));
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      selected_services: prev.selected_services.includes(serviceId)
        ? prev.selected_services.filter(id => id !== serviceId)
        : [...prev.selected_services, serviceId]
    }));
  };

  const handleDateSelect = (date) => {
    setFormData(prev => ({ ...prev, selected_date: date, selected_time: null, selected_box_id: null }));
    loadTimeSlots(date);
    setStep(4);
  };

  const handleTimeSelect = (time, boxId) => {
    setFormData(prev => ({ ...prev, selected_time: time, selected_box_id: boxId }));
  };

  const handleSubmit = async () => {
    if (formData.selected_services.length === 0 || !formData.selected_date ||
        !formData.selected_time || !formData.selected_box_id) {
      alert('Заполните все обязательные поля');
      return;
    }

    try {
      // Создание или получение клиента
      let clientId = clientData.id;
      if (!clientId) {
        if (!clientData.first_name || !clientData.last_name) {
          setError('Заполните ФИО клиента');
          setStep(1);
          return;
        }
        try {
          const clientResponse = await axios.post(`${API_URL}/clients`, {
            first_name: clientData.first_name,
            last_name: clientData.last_name,
            middle_name: clientData.middle_name,
            phone: getCleanPhoneNumber(clientPhone),
            email: clientData.email
          });
          clientId = clientResponse.data.id;
        } catch (clientError) {
          if (clientError.response?.status === 409 && clientError.response?.data?.existing_client) {
            clientId = clientError.response.data.existing_client.id;
            console.log('Используется существующий клиент:', clientId);
          } else {
            throw clientError;
          }
        }
      }

      // Создание или получение автомобиля
      let carId = carData.id;
      if (!carId) {
        try {
          const carResponse = await axios.post(`${API_URL}/cars`, {
            license_plate: carLicensePlate,
            brand: carData.brand,
            model: carData.model,
            color: carData.color
          });
          carId = carResponse.data.id;
        } catch (carError) {
          if (carError.response?.status === 409 && carError.response?.data?.existing_car) {
            carId = carError.response.data.existing_car.id;
            console.log('Используется существующий автомобиль:', carId);
          } else {
            throw carError;
          }
        }
      }

      const scheduledDateTime = `${formData.selected_date}T${formData.selected_time}:00`;

      await axios.post(`${API_URL}/orders`, {
        client_id: clientId,
        car_id: carId,
        service_ids: formData.selected_services,
        box_id: formData.selected_box_id,
        scheduled_time: scheduledDateTime,
        notes: formData.notes
      });

      alert('Запись успешно создана!');

      // Сброс формы
      setClientPhone('');
      setClientFound(false);
      setClientData({ id: null, first_name: '', last_name: '', middle_name: '', email: '' });
      setCarLicensePlate('');
      setCarFound(false);
      setCarData({ id: null, brand: '', model: '', color: '' });
      setFormData({
        selected_services: [],
        selected_date: null,
        selected_time: null,
        selected_box_id: null,
        notes: ''
      });
      setStep(1);
    } catch (error) {
      console.error('Ошибка создания записи:', error);
      alert('Ошибка: ' + (error.response?.data?.error || error.message));
    }
  };

  const getTotalDuration = () => {
    return formData.selected_services.reduce((sum, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return sum + (service?.duration || 0);
    }, 0);
  };

  const getTotalPrice = () => {
    return formData.selected_services.reduce((sum, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return sum + (service?.price || 0);
    }, 0);
  };

  const getLoadLevelColor = (level) => {
    switch (level) {
      case 'low': return '#27ae60';
      case 'medium': return '#f39c12';
      case 'high': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getLoadLevelText = (level) => {
    switch (level) {
      case 'low': return 'Свободно';
      case 'medium': return 'Средняя загрузка';
      case 'high': return 'Высокая загрузка';
      default: return 'Нет данных';
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${date.getDate()} ${months[date.getMonth()]}, ${days[date.getDay()]}`;
  };

  return (
    <div className="booking-container">
      <h2 className="page-title">Запись на будущее</h2>


      <div className="booking-progress">
        <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Клиент</div>
        </div>
        <div className="progress-line"></div>
        <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Услуги</div>
        </div>
        <div className="progress-line"></div>
        <div className={`progress-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Дата</div>
        </div>
        <div className="progress-line"></div>
        <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>
          <div className="step-number">4</div>
          <div className="step-label">Время</div>
        </div>
      </div>


      {step === 1 && (
        <div className="card">
          <h3>Шаг 1: Клиент и автомобиль</h3>

          {error && <div className="error-message" style={{
            padding: '1rem',
            background: '#fee',
            color: '#c00',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>{error}</div>}


          <div className="form-section" style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Клиент</h4>

            <div className="search-group" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="tel"
                placeholder="Номер телефона: 7 (999) 123-45-67"
                value={clientPhone}
                onChange={(e) => setClientPhone(formatPhoneNumber(e.target.value))}
                required
                style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '6px' }}
              />
              <button type="button" className="btn btn-primary" onClick={searchClient}>
                Найти
              </button>
            </div>

            {clientFound && (
              <div style={{
                padding: '0.75rem',
                background: '#d4edda',
                color: '#155724',
                borderRadius: '6px',
                marginBottom: '1rem',
                border: '1px solid #c3e6cb'
              }}>
                Клиент найден в базе
              </div>
            )}

            {clientPhone && !clientFound && clientData.first_name === '' && (
              <div style={{
                padding: '0.75rem',
                background: '#d1ecf1',
                color: '#0c5460',
                borderRadius: '6px',
                marginBottom: '1rem',
                border: '1px solid #bee5eb'
              }}>
                Новый клиент - заполните данные ниже
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Фамилия *</label>
                <input
                  type="text"
                  required
                  value={clientData.last_name}
                  onChange={(e) => setClientData({ ...clientData, last_name: e.target.value })}
                  disabled={clientFound}
                  style={{
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    width: '100%',
                    background: clientFound ? '#f5f5f5' : 'white'
                  }}
                />
              </div>
              <div className="form-group">
                <label>Имя *</label>
                <input
                  type="text"
                  required
                  value={clientData.first_name}
                  onChange={(e) => setClientData({ ...clientData, first_name: e.target.value })}
                  disabled={clientFound}
                  style={{
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    width: '100%',
                    background: clientFound ? '#f5f5f5' : 'white'
                  }}
                />
              </div>
              <div className="form-group">
                <label>Отчество</label>
                <input
                  type="text"
                  value={clientData.middle_name}
                  onChange={(e) => setClientData({ ...clientData, middle_name: e.target.value })}
                  disabled={clientFound}
                  style={{
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    width: '100%',
                    background: clientFound ? '#f5f5f5' : 'white'
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={clientData.email}
                onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                disabled={clientFound}
                style={{
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  width: '100%',
                  background: clientFound ? '#f5f5f5' : 'white'
                }}
              />
            </div>
          </div>


          <div className="form-section">
            <h4 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Автомобиль</h4>

            <div className="search-group" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Гос. номер (например: А123БВ777)"
                value={carLicensePlate}
                onChange={(e) => setCarLicensePlate(e.target.value.toUpperCase())}
                required
                style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '6px' }}
              />
              <button type="button" className="btn btn-primary" onClick={searchCar}>
                Найти
              </button>
            </div>

            {carFound && (
              <div style={{
                padding: '0.75rem',
                background: '#d4edda',
                color: '#155724',
                borderRadius: '6px',
                marginBottom: '1rem',
                border: '1px solid #c3e6cb'
              }}>
                Автомобиль найден в базе
              </div>
            )}

            {carLicensePlate && !carFound && carData.brand === '' && (
              <div style={{
                padding: '0.75rem',
                background: '#d1ecf1',
                color: '#0c5460',
                borderRadius: '6px',
                marginBottom: '1rem',
                border: '1px solid #bee5eb'
              }}>
                Новый автомобиль - выберите марку и модель из списка или введите вручную
              </div>
            )}


            {!carFound && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <CarSelector
                    selectedBrand={carData.brand}
                    selectedModel={carData.model}
                    onBrandChange={(brand) => setCarData({ ...carData, brand })}
                    onModelChange={(model) => setCarData({ ...carData, model })}
                    disabled={carFound}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Марка <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>(или выберите выше)</span></label>
                    <input
                      type="text"
                      placeholder="Toyota, BMW, Lada..."
                      value={carData.brand}
                      onChange={(e) => setCarData({ ...carData, brand: e.target.value })}
                      disabled={carFound}
                      style={{
                        padding: '0.75rem',
                        fontSize: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        width: '100%',
                        background: carFound ? '#f5f5f5' : 'white'
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Модель <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>(или выберите выше)</span></label>
                    <input
                      type="text"
                      placeholder="Camry, X5, Vesta..."
                      value={carData.model}
                      onChange={(e) => setCarData({ ...carData, model: e.target.value })}
                      disabled={carFound}
                      style={{
                        padding: '0.75rem',
                        fontSize: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        width: '100%',
                        background: carFound ? '#f5f5f5' : 'white'
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Цвет</label>
                    <input
                      type="text"
                      placeholder="Черный, Белый..."
                      value={carData.color}
                      onChange={(e) => setCarData({ ...carData, color: e.target.value })}
                      disabled={carFound}
                      style={{
                        padding: '0.75rem',
                        fontSize: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        width: '100%',
                        background: carFound ? '#f5f5f5' : 'white'
                      }}
                    />
                  </div>
                </div>
              </>
            )}


            {carFound && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1rem',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Марка</label>
                  <div style={{ fontSize: '1rem', fontWeight: '500', color: '#2c3e50' }}>
                    {carData.brand || '-'}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Модель</label>
                  <div style={{ fontSize: '1rem', fontWeight: '500', color: '#2c3e50' }}>
                    {carData.model || '-'}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#6c757d', display: 'block', marginBottom: '0.25rem' }}>Цвет</label>
                  <div style={{ fontSize: '1rem', fontWeight: '500', color: '#2c3e50' }}>
                    {carData.color || '-'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary btn-large"
            onClick={() => setStep(2)}
            disabled={!clientPhone || !carLicensePlate || (!clientFound && (!clientData.first_name || !clientData.last_name))}
            style={{ marginTop: '2rem' }}
          >
            Далее →
          </button>
        </div>
      )}


      {step === 2 && (
        <div className="card">
          <h3>Шаг 2: Выберите услуги</h3>

          <div className="services-list">
            {services.map(service => (
              <div
                key={service.id}
                className={`service-item ${formData.selected_services.includes(service.id) ? 'selected' : ''}`}
                onClick={() => handleServiceToggle(service.id)}
              >
                <div className="service-checkbox"></div>
                <div className="service-info">
                  <div className="service-name">{service.name}</div>
                  <div className="service-details">
                    {service.description && <span className="service-description">{service.description}</span>}
                    <span className="service-price">{service.price} ₽</span>
                    <span className="service-duration">{service.duration} мин</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {formData.selected_services.length > 0 && (
            <div className="booking-summary">
              <div className="summary-item">
                <strong>Выбрано услуг:</strong> {formData.selected_services.length}
              </div>
              <div className="summary-item">
                <strong>Общая длительность:</strong> {getTotalDuration()} мин
              </div>
              <div className="summary-item">
                <strong>Общая стоимость:</strong> {getTotalPrice()} ₽
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              ← Назад
            </button>
            <button
              className="btn btn-primary btn-large"
              onClick={() => {
                loadAvailability();
                setStep(3);
              }}
              disabled={formData.selected_services.length === 0}
            >
              Далее →
            </button>
          </div>
        </div>
      )}


      {step === 3 && (
        <div className="card">
          <h3>Шаг 3: Выберите дату</h3>

          <div className="calendar-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#27ae60' }}></div>
              <span>Свободно</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#f39c12' }}></div>
              <span>Средняя загрузка</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#e74c3c' }}></div>
              <span>Высокая загрузка</span>
            </div>
          </div>

          {loading ? (
            <div className="loading">Загрузка календаря...</div>
          ) : (
            <div className="calendar-grid">
              {availability.map(day => (
                <div
                  key={day.date}
                  className={`calendar-day ${day.is_past ? 'past' : ''} ${formData.selected_date === day.date ? 'selected' : ''}`}
                  style={{
                    borderColor: day.is_past ? '#bdc3c7' : getLoadLevelColor(day.load_level),
                    backgroundColor: formData.selected_date === day.date ? getLoadLevelColor(day.load_level) : 'white',
                    color: formData.selected_date === day.date ? 'white' : '#2c3e50'
                  }}
                  onClick={() => !day.is_past && handleDateSelect(day.date)}
                >
                  <div className="day-date">{formatDate(day.date)}</div>
                  <div className="day-stats">
                    <div className="stat-item">{day.orders_count} заказов</div>
                    <div className="stat-item">{day.occupancy_percent}%</div>
                  </div>
                  {!day.is_past && (
                    <div className="day-status" style={{
                      color: formData.selected_date === day.date ? 'white' : getLoadLevelColor(day.load_level)
                    }}>
                      {getLoadLevelText(day.load_level)}
                    </div>
                  )}
                  {day.is_past && (
                    <div className="day-status" style={{ color: '#95a5a6' }}>
                      Прошло
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ marginTop: '1rem' }}>
            ← Назад
          </button>
        </div>
      )}


      {step === 4 && (
        <div className="card">
          <h3>Шаг 4: Выберите время</h3>
          <p style={{ color: '#7f8c8d', marginBottom: '1rem' }}>
            Дата: <strong>{formatDate(formData.selected_date)}</strong> |
            Длительность: <strong>{getTotalDuration()} мин</strong>
          </p>

          {error && (
            <div style={{
              padding: '1rem',
              background: '#fee',
              color: '#c00',
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="loading">Загрузка доступного времени...</div>
          ) : timeSlots.length === 0 ? (
            <div className="empty-state">
              <div>На выбранную дату нет свободных окон для услуг такой длительности</div>
              <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ marginTop: '1rem' }}>
                ← Выбрать другую дату
              </button>
            </div>
          ) : (
            <>
              <div className="timeslots-grid">
                {timeSlots.map(slot => (
                  <div key={slot.time} className="timeslot-group">
                    <div className="timeslot-time">{slot.time}</div>
                    <div className="timeslot-boxes">
                      {slot.available_boxes.map(box => (
                        <button
                          key={box.id}
                          className={`timeslot-box ${formData.selected_time === slot.time && formData.selected_box_id === box.id ? 'selected' : ''}`}
                          onClick={() => handleTimeSelect(slot.time, box.id)}
                        >
                          {box.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: '2rem' }}>
                <label>Примечания</label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Дополнительная информация о заказе..."
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => setStep(3)}>
                  ← Назад
                </button>
                <button
                  className="btn btn-success btn-large"
                  onClick={handleSubmit}
                  disabled={!formData.selected_time || !formData.selected_box_id}
                >
                  Создать запись
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Booking;
