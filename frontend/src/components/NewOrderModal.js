import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './NewOrderModal.css';
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

function NewOrderModal({ isOpen, onClose, onSuccess, boxes: propBoxes, services: propServices }) {
  const [error, setError] = useState('');
  const [boxes, setBoxes] = useState([]);
  const [services, setServices] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);


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


  const [orderData, setOrderData] = useState({
    service_ids: [],
    box_id: '',
    scheduled_time: '',
    notes: ''
  });


  const loadData = async () => {
    setLoading(true);
    try {
      const [boxesRes, servicesRes] = await Promise.all([
        axios.get(`${API_URL}/boxes`),
        axios.get(`${API_URL}/services`)
      ]);
      setBoxes(boxesRes.data.filter(b => b.is_active));
      setServices(servicesRes.data);
      console.log('Загружено боксов:', boxesRes.data.length);
      console.log('Загружено услуг:', servicesRes.data.length);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError('Ошибка загрузки данных. Обновите страницу.');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = useCallback(async () => {
    const totalDuration = orderData.service_ids.reduce((sum, serviceId) => {
      const service = services.find(s => s.id === parseInt(serviceId));
      return sum + (service?.duration || 0);
    }, 0);

    if (totalDuration === 0) {
      setAvailableSlots([]);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/orders/available-slots-today`, {
        total_duration: totalDuration
      });
      setAvailableSlots(response.data.boxes);
      console.log('Доступные слоты:', response.data.boxes);
    } catch (err) {
      console.error('Ошибка загрузки доступных слотов:', err);
      setError('Ошибка загрузки доступных слотов');
      setAvailableSlots([]);
    }
  }, [orderData.service_ids, services]);


  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);


  useEffect(() => {
    if (isOpen && orderData.service_ids.length > 0) {
      loadAvailableSlots();
    }
  }, [orderData.service_ids, isOpen, loadAvailableSlots]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!orderData.box_id || !orderData.scheduled_time) {
      setError('Выберите бокс и время');
      return;
    }

    try {
      // Создание или получение клиента
      let clientId = clientData.id;
      if (!clientId) {
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

      // Создание заказа
      await axios.post(`${API_URL}/orders`, {
        client_id: clientId,
        car_id: carId,
        service_ids: orderData.service_ids,
        box_id: orderData.box_id ? parseInt(orderData.box_id) : null,
        scheduled_time: orderData.scheduled_time,
        notes: orderData.notes,
        status: 'pending'
      });

      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Ошибка создания заказа:', err);
      setError(err.response?.data?.error || 'Ошибка создания заказа');
    }
  };

  const handleClose = () => {

    setClientPhone('');
    setClientFound(false);
    setClientData({ id: null, first_name: '', last_name: '', middle_name: '', email: '' });
    setCarLicensePlate('');
    setCarFound(false);
    setCarData({ id: null, brand: '', model: '', color: '' });
    setOrderData({ service_ids: [], box_id: '', scheduled_time: '', notes: '' });
    setAvailableSlots([]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Новый заказ</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}


            <div className="form-section">
              <h3>Клиент</h3>

              <div className="search-group">
                <input
                  type="tel"
                  placeholder="Номер телефона: 7 (999) 123-45-67"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatPhoneNumber(e.target.value))}
                  required
                />
                <button type="button" className="btn btn-primary" onClick={searchClient}>
                  Найти
                </button>
              </div>

              {clientFound && (
                <div className="found-indicator success">
                  Клиент найден в базе
                </div>
              )}

              {clientPhone && !clientFound && clientData.first_name === '' && (
                <div className="found-indicator info">
                  Новый клиент - заполните данные
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Фамилия *</label>
                  <input
                    type="text"
                    required
                    value={clientData.last_name}
                    onChange={(e) => setClientData({ ...clientData, last_name: e.target.value })}
                    disabled={clientFound}
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
                  />
                </div>
                <div className="form-group">
                  <label>Отчество</label>
                  <input
                    type="text"
                    value={clientData.middle_name}
                    onChange={(e) => setClientData({ ...clientData, middle_name: e.target.value })}
                    disabled={clientFound}
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
                />
              </div>
            </div>


            <div className="form-section">
              <h3>Автомобиль</h3>

              <div className="search-group">
                <input
                  type="text"
                  placeholder="Гос. номер (например: А123БВ777)"
                  value={carLicensePlate}
                  onChange={(e) => setCarLicensePlate(e.target.value.toUpperCase())}
                  required
                />
                <button type="button" className="btn btn-primary" onClick={searchCar}>
                  Найти
                </button>
              </div>

              {carFound && (
                <div className="found-indicator success">
                  Автомобиль найден в базе
                </div>
              )}

              {carLicensePlate && !carFound && carData.brand === '' && (
                <div className="found-indicator info">
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

                  <div className="form-row">
                    <div className="form-group">
                      <label>Марка <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>(или выберите выше)</span></label>
                      <input
                        type="text"
                        placeholder="Toyota, BMW, Lada..."
                        value={carData.brand}
                        onChange={(e) => setCarData({ ...carData, brand: e.target.value })}
                        disabled={carFound}
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


            <div className="form-section">
              <h3>Детали заказа</h3>

              {loading && <div style={{ textAlign: 'center', padding: '1rem', color: '#7f8c8d' }}>Загрузка...</div>}

              {!loading && services.length === 0 && (
                <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', marginBottom: '1rem' }}>
                  Услуги не найдены. Создайте услуги в разделе "Услуги" перед созданием заказа.
                </div>
              )}

              {!loading && boxes.length === 0 && (
                <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', marginBottom: '1rem' }}>
                  Боксы не найдены. Создайте боксы в разделе "Настройки" перед созданием заказа.
                </div>
              )}

              <div className="form-row">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Услуги * (можно выбрать несколько)</label>
                  {services.length > 0 ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: 'white',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      {services.map(service => (
                      <label
                        key={service.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          padding: '1rem',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          border: '2px solid',
                          borderColor: orderData.service_ids.includes(service.id) ? '#3498db' : '#e0e0e0',
                          background: orderData.service_ids.includes(service.id) ? '#e3f2fd' : '#fafafa',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={orderData.service_ids.includes(service.id)}
                          onChange={(e) => {
                            const newServiceIds = e.target.checked
                              ? [...orderData.service_ids, service.id]
                              : orderData.service_ids.filter(id => id !== service.id);
                            setOrderData({
                              ...orderData,
                              service_ids: newServiceIds,
                              box_id: '',
                              scheduled_time: ''
                            });
                          }}
                          style={{
                            marginTop: '0.25rem',
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem'
                          }}>
                            <div style={{
                              fontSize: '1rem',
                              fontWeight: '600',
                              color: '#2c3e50'
                            }}>
                              {service.name}
                            </div>
                            <div style={{
                              display: 'flex',
                              gap: '1.5rem',
                              fontSize: '0.9rem',
                              color: '#34495e',
                              whiteSpace: 'nowrap'
                            }}>
                              <span style={{ fontWeight: '500' }}>
                                {service.price} ₽
                              </span>
                              <span style={{ fontWeight: '500' }}>
                                {service.duration} мин
                              </span>
                            </div>
                          </div>
                          {service.description && (
                            <div style={{
                              fontSize: '0.9rem',
                              color: '#7f8c8d',
                              lineHeight: '1.4'
                            }}>
                              {service.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px', textAlign: 'center', color: '#7f8c8d' }}>
                      Нет доступных услуг
                    </div>
                  )}
                  {services.length > 0 && orderData.service_ids.length === 0 && (
                    <small style={{ color: '#e74c3c', marginTop: '0.5rem', display: 'block' }}>
                      Выберите хотя бы одну услугу
                    </small>
                  )}
                  {services.length > 0 && orderData.service_ids.length > 0 && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#e8f5e9', borderRadius: '4px', fontSize: '0.95rem' }}>
                      <strong>Выбрано услуг:</strong> {orderData.service_ids.length} |
                      <strong> Общая стоимость:</strong> {
                        services
                          .filter(s => orderData.service_ids.includes(s.id))
                          .reduce((sum, s) => sum + s.price, 0)
                      } ₽ |
                      <strong> Общее время:</strong> {
                        services
                          .filter(s => orderData.service_ids.includes(s.id))
                          .reduce((sum, s) => sum + (s.duration || 0), 0)
                      } мин
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Выберите бокс и время (на сегодня)</label>
                  {orderData.service_ids.length === 0 ? (
                    <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '4px', color: '#856404', border: '1px solid #ffeaa7' }}>
                      Сначала выберите услуги, чтобы увидеть доступные боксы и время
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div style={{ padding: '1rem', background: '#f8d7da', borderRadius: '4px', color: '#721c24', border: '1px solid #f5c6cb' }}>
                      Нет доступных боксов на сегодня
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '1rem', marginTop: '0.5rem' }}>
                      {availableSlots.map(slot => (
                        <div
                          key={slot.box_id}
                          style={{
                            padding: '1rem',
                            border: `2px solid ${orderData.box_id === slot.box_id ? '#3498db' : '#ddd'}`,
                            borderRadius: '8px',
                            background: orderData.box_id === slot.box_id ? '#e3f2fd' : (slot.is_available ? 'white' : '#f5f5f5'),
                            opacity: slot.is_available ? 1 : 0.6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem'
                          }}
                        >
                          <div style={{ flex: '0 0 auto', minWidth: '150px' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2c3e50' }}>
                              {slot.box_name}
                            </div>
                            {!slot.is_available && (
                              <div style={{ fontSize: '0.85rem', color: '#e74c3c', marginTop: '0.25rem' }}>
                                Нет слотов
                              </div>
                            )}
                            {slot.is_available && slot.available_slots.length > 0 && (
                              <div style={{ fontSize: '0.85rem', color: '#27ae60', marginTop: '0.25rem' }}>
                                {slot.available_slots.length} слот(ов)
                              </div>
                            )}
                          </div>

                          {slot.is_available && (
                            <div style={{ flex: 1 }}>
                              <select
                                value={orderData.box_id === slot.box_id ? orderData.scheduled_time.split('T')[1]?.slice(0, 5) || '' : ''}
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    setOrderData({
                                      ...orderData,
                                      box_id: '',
                                      scheduled_time: ''
                                    });
                                    return;
                                  }

                                  const now = new Date();
                                  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                  setOrderData({
                                    ...orderData,
                                    box_id: slot.box_id,
                                    scheduled_time: `${today}T${e.target.value}:00`
                                  });
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.75rem',
                                  fontSize: '1rem',
                                  border: '1px solid #ddd',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  background: 'white'
                                }}
                              >
                                <option value="">Выберите время</option>
                                {slot.available_slots.map(time => (
                                  <option key={time} value={time}>
                                    {time}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Примечания</label>
                <textarea
                  rows="3"
                  placeholder="Дополнительная информация о заказе..."
                  value={orderData.notes}
                  onChange={(e) => setOrderData({ ...orderData, notes: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-cancel" onClick={handleClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={loading || orderData.service_ids.length === 0 || services.length === 0 || !orderData.box_id || !orderData.scheduled_time}
            >
              {loading ? 'Загрузка...' : 'Создать заказ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewOrderModal;
