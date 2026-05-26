import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Pagination from './Pagination';

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

function Clients() {
  const [clients, setClients] = useState([]);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchPhone, setSearchPhone] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '',
    email: ''
  });


  useEffect(() => { setCurrentPage(1); }, [searchPhone]);


  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients();
    }, searchPhone ? 300 : 0);
    return () => clearTimeout(timer);
  }, [currentPage, searchPhone]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/clients`, {
        params: {
          page: currentPage,
          page_size: PAGE_SIZE,
          search: searchPhone
        }
      });
      setClients(response.data.items || []);
      setTotalClients(response.data.total || 0);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {

      const dataToSend = {
        ...formData,
        phone: getCleanPhoneNumber(formData.phone)
      };

      if (editingClient) {

        await axios.put(`${API_URL}/clients/${editingClient.id}`, dataToSend);
        alert('Клиент успешно обновлен!');
        setEditingClient(null);
      } else {

        await axios.post(`${API_URL}/clients`, dataToSend);
        alert('Клиент успешно добавлен!');
      }
      setFormData({ first_name: '', last_name: '', middle_name: '', phone: '', email: '' });
      setShowForm(false);
      loadClients();
    } catch (error) {
      console.error('Ошибка сохранения клиента:', error);


      if (error.response) {

        if (error.response.status === 409) {
          const errorData = error.response.data;
          const existingClient = errorData.existing_client;
          let message = `${errorData.error}\n\n`;
          if (existingClient) {
            message += `Информация о существующем клиенте:\n`;
            message += `• ФИО: ${existingClient.last_name} ${existingClient.first_name} ${existingClient.middle_name || ''}\n`;
            message += `• Email: ${existingClient.email || 'не указан'}\n`;
            message += `• Дата добавления: ${new Date(existingClient.created_at).toLocaleDateString('ru-RU')}`;
          }
          alert(message);
        } else {
          alert('Ошибка: ' + (error.response?.data?.error || error.message));
        }
      } else {
        alert('Ошибка: ' + error.message);
      }
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      first_name: client.first_name,
      last_name: client.last_name,
      middle_name: client.middle_name || '',
      phone: formatPhoneNumber(client.phone),
      email: client.email || ''
    });
    setShowForm(true);
    setSelectedClient(null);
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    setFormData({ first_name: '', last_name: '', middle_name: '', phone: '', email: '' });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Удалить клиента?')) {
      try {
        await axios.delete(`${API_URL}/clients/${id}`);
        setSelectedClient(null);
        loadClients();
      } catch (error) {
        console.error('Ошибка удаления клиента:', error);
      }
    }
  };

  const handleRowClick = (client) => {
    if (showForm) return;
    setSelectedClient(selectedClient?.id === client.id ? null : client);
  };


  if (loading && clients.length === 0) return <div className="loading">Загрузка...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Клиенты</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Поиск по телефону..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
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
          {selectedClient && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => handleEdit(selectedClient)}
              >
                 Редактировать
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(selectedClient.id)}
              >
                 Удалить
              </button>
            </>
          )}
          <button className="btn btn-success" onClick={() => editingClient ? handleCancelEdit() : setShowForm(!showForm)}>
            {showForm ? 'Отмена' : '+ Добавить клиента'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3>{editingClient ? 'Редактирование клиента' : 'Новый клиент'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Фамилия *</label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Имя *</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Отчество</label>
              <input
                type="text"
                value={formData.middle_name}
                onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Телефон *</label>
              <input
                type="tel"
                required
                placeholder="7 (999) 123-45-67"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-success">Сохранить</button>
          </form>
        </div>
      )}

      <div className="card">
        {totalClients === 0 && !searchPhone ? (
          <p>Клиентов пока нет. Добавьте первого!</p>
        ) : (
          <>
          <table>
            <thead>
              <tr>
                <th>Фамилия</th>
                <th>Имя</th>
                <th>Отчество</th>
                <th>Телефон</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr
                  key={client.id}
                  onClick={() => handleRowClick(client)}
                  style={{
                    cursor: showForm ? 'default' : 'pointer',
                    backgroundColor: selectedClient?.id === client.id ? '#e3f2fd' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <td>{client.last_name}</td>
                  <td>{client.first_name}</td>
                  <td>{client.middle_name || '-'}</td>
                  <td>{formatPhoneNumber(client.phone)}</td>
                  <td>{client.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={totalClients}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
          </>
        )}
      </div>
    </div>
  );
}

export default Clients;
