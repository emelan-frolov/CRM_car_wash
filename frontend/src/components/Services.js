import React, { useState, useEffect } from "react";
import axios from "axios";
import Pagination from "./Pagination";
import { hasPermission } from "../auth";

const API_URL = "http://localhost:5000/api";

function Services() {
  const [services, setServices] = useState([]);
  const [totalServices, setTotalServices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [searchName, setSearchName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration: "",
    washer_percentage: "",
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName]);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        loadServices();
      },
      searchName ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [currentPage, searchName]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/services`, {
        params: {
          page: currentPage,
          page_size: PAGE_SIZE,
          search: searchName,
        },
      });
      setServices(response.data.items || []);
      setTotalServices(response.data.total || 0);
      setLoading(false);
    } catch (error) {
      console.error("Ошибка загрузки услуг:", error);
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
        alert("Не удается подключиться к серверу!");
      }
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        duration: formData.duration ? parseInt(formData.duration) : null,
        washer_percentage: formData.washer_percentage
          ? parseFloat(formData.washer_percentage)
          : 0,
      };

      if (editingService) {
        await axios.put(`${API_URL}/services/${editingService.id}`, payload);
        setEditingService(null);
      } else {
        await axios.post(`${API_URL}/services`, payload);
      }

      setFormData({
        name: "",
        description: "",
        price: "",
        duration: "",
        washer_percentage: "",
      });
      setShowForm(false);
      loadServices();
    } catch (error) {
      console.error("Ошибка сохранения услуги:", error);
      alert("Ошибка: " + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      price: service.price.toString(),
      duration: service.duration ? service.duration.toString() : "",
        washer_percentage: service.washer_percentage
        ? service.washer_percentage.toString()
        : "",
    });
    setShowForm(true);
    setSelectedService(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Удалить услугу?")) {
      try {
        console.log("Удаление услуги ID:", id);
        await axios.delete(`${API_URL}/services/${id}`);
        console.log("Услуга удалена");
        setSelectedService(null);
        loadServices();
      } catch (error) {
        console.error("Ошибка удаления услуги:", error);

        if (error.response) {

          console.error("Ответ сервера:", error.response.data);
          console.error("Статус:", error.response.status);
          alert(
            `Ошибка сервера: ${error.response.data?.error || error.response.statusText}`,
          );
        } else if (error.request) {

          console.error("Запрос отправлен, но ответа нет:", error.request);
          console.error("Проверьте:");
          console.error(
            "   1. Запущен ли backend сервер (http://localhost:5000)",
          );
          console.error("  2. Нет ли блокировки CORS");
          console.error("  3. Правильно ли настроен API_URL:", API_URL);
          alert(
            "Ошибка подключения к серверу!\n\nПроверьте:\n1. Запущен ли backend (http://localhost:5000)\n2. Нет ли ошибок в консоли backend\n3. Откройте консоль браузера (F12) для деталей",
          );
        } else {

          console.error("Ошибка настройки запроса:", error.message);
          alert("Ошибка: " + error.message);
        }
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingService(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      duration: "",
      washer_percentage: "",
    });
    setShowForm(false);
  };

  const handleRowClick = (service) => {
    if (showForm) return;
    setSelectedService(selectedService?.id === service.id ? null : service);
  };

  if (loading && services.length === 0)
    return <div className="loading">Загрузка...</div>;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h2 className="page-title" style={{ margin: 0 }}>
          Услуги
        </h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{
              padding: "0.6rem 1rem",
              fontSize: "0.95rem",
              border: "2px solid #ddd",
              borderRadius: "6px",
              width: "250px",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3498db")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          />
          {selectedService && hasPermission("can_edit_services") && (
            <button
              className="btn btn-primary"
              onClick={() => handleEdit(selectedService)}
            >
               Редактировать
            </button>
          )}
          {selectedService && hasPermission("can_delete_services") && (
            <button
              className="btn btn-danger"
              onClick={() => handleDelete(selectedService.id)}
            >
               Удалить
            </button>
          )}
          {(hasPermission("can_create_services") || showForm) && (
            <button
              className="btn btn-success"
              onClick={() =>
                editingService ? handleCancelEdit() : setShowForm(!showForm)
              }
            >
              {showForm ? "Отмена" : "+ Добавить услугу"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3>{editingService ? "Редактирование услуги" : "Новая услуга"}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Название *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Описание</label>
              <textarea
                rows="3"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Цена (₽) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Длительность (минут)</label>
              <select
                value={formData.duration}
                onChange={(e) =>
                  setFormData({ ...formData, duration: e.target.value })
                }
                style={{
                  padding: "0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  width: "100%",
                }}
              >
                <option value="">Не указано</option>
                {Array.from({ length: 12 }, (_, i) => (i + 1) * 15).map(
                  (minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} мин{" "}
                      {minutes >= 60
                        ? `(${Math.floor(minutes / 60)} ч ${minutes % 60 > 0 ? (minutes % 60) + " мин" : ""})`.trim()
                        : ""}
                    </option>
                  ),
                )}
              </select>
              <small
                style={{
                  color: "#7f8c8d",
                  fontSize: "0.85rem",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                Доступны только интервалы кратные 15 минутам (до 3 часов)
              </small>
            </div>
            <div className="form-group">
              <label>% оплаты для мойщика</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.washer_percentage}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    washer_percentage: e.target.value,
                  })
                }
                placeholder="Например: 30"
              />
              <small style={{ color: "#7f8c8d", fontSize: "0.85rem" }}>
                {formData.washer_percentage && formData.price ? (
                  <>
                     Мойщик получит:{" "}
                    {(
                      parseFloat(formData.price) *
                      (parseFloat(formData.washer_percentage) / 100)
                    ).toFixed(2)}{" "}
                    ₽ за эту услугу
                  </>
                ) : (
                  "Процент от стоимости услуги, который получит мойщик при сдельной оплате"
                )}
              </small>
            </div>
            <button type="submit" className="btn btn-success">
              Сохранить
            </button>
          </form>
        </div>
      )}

      <div className="card">
        {totalServices === 0 && !searchName ? (
          <p>Услуг пока нет. Добавьте первую!</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Цена</th>
                  <th>Длительность</th>
                  <th>% мойщику</th>
                  <th>Сумма мойщику</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.id}
                    onClick={() => handleRowClick(service)}
                    style={{
                      cursor: showForm ? "default" : "pointer",
                      backgroundColor:
                        selectedService?.id === service.id
                          ? "#e3f2fd"
                          : "transparent",
                      transition: "background-color 0.2s",
                      opacity: service.is_active === false ? 0.5 : 1,
                    }}
                  >
                    <td>
                      {service.name}
                      {service.is_active === false && (
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            padding: "0.2rem 0.4rem",
                            backgroundColor: "#e74c3c",
                            color: "white",
                            borderRadius: "3px",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                          }}
                        >
                          УДАЛЕНА
                        </span>
                      )}
                    </td>
                    <td>{service.description || "-"}</td>
                    <td>{service.price} ₽</td>
                    <td>
                      {service.duration ? `${service.duration} мин` : "-"}
                    </td>
                    <td>
                      {service.washer_percentage ? (
                        <span
                          style={{
                            padding: "0.25rem 0.5rem",
                            backgroundColor: "#f39c12",
                            color: "white",
                            borderRadius: "4px",
                            fontSize: "0.9rem",
                          }}
                        >
                          {service.washer_percentage}%
                        </span>
                      ) : (
                        <span style={{ color: "#95a5a6" }}>-</span>
                      )}
                    </td>
                    <td>
                      {service.washer_amount > 0 ? (
                        <strong style={{ color: "#27ae60" }}>
                          {service.washer_amount} ₽
                        </strong>
                      ) : (
                        <span style={{ color: "#95a5a6" }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalItems={totalServices}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default Services;
