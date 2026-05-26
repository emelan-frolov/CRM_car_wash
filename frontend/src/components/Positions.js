import React, { useState, useEffect } from "react";
import axios from "axios";
import { hasPermission } from "../auth";

const API_URL = "http://localhost:5000/api";

function Positions() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    salary: "",
    can_manage_system: false,
  });

  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    try {
      const response = await axios.get(`${API_URL}/positions`);
      setPositions(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Ошибка загрузки должностей:", error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        salary: parseFloat(formData.salary),
        can_manage_system: !!formData.can_manage_system,
      };
      if (editingPosition) {
        await axios.put(`${API_URL}/positions/${editingPosition.id}`, payload);
        setEditingPosition(null);
      } else {
        await axios.post(`${API_URL}/positions`, payload);
      }
      setFormData({ name: "", salary: "", can_manage_system: false });
      setShowForm(false);
      loadPositions();
    } catch (error) {
      console.error("Ошибка сохранения должности:", error);
      alert("Ошибка: " + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (position) => {
    setEditingPosition(position);
    setFormData({
      name: position.name,
      salary: position.salary,
      can_manage_system: !!position.can_manage_system,
    });
    setShowForm(true);
    setSelectedPosition(null);
  };

  const handleCancelEdit = () => {
    setEditingPosition(null);
    setFormData({ name: "", salary: "", can_manage_system: false });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (
      window.confirm(
        "Удалить должность- Это возможно только если нет сотрудников с этой должностью.",
      )
    ) {
      try {
        await axios.delete(`${API_URL}/positions/${id}`);
        setSelectedPosition(null);
        loadPositions();
      } catch (error) {
        console.error("Ошибка удаления должности:", error);
        alert("Ошибка: " + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleRowClick = (position) => {
    if (showForm) return;
    setSelectedPosition(selectedPosition?.id === position.id ? null : position);
  };

  if (loading) return <div className="loading">Загрузка...</div>;

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
          Должности
        </h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {selectedPosition && hasPermission("can_edit_positions") && (
            <button
              className="btn btn-primary"
              onClick={() => handleEdit(selectedPosition)}
            >
              Редактировать
            </button>
          )}
          {selectedPosition && hasPermission("can_delete_positions") && (
            <button
              className="btn btn-danger"
              onClick={() => handleDelete(selectedPosition.id)}
            >
              Удалить
            </button>
          )}
          {(hasPermission("can_create_positions") || showForm) && (
            <button
              className="btn btn-success"
              onClick={() =>
                editingPosition ? handleCancelEdit() : setShowForm(!showForm)
              }
            >
              {showForm ? "Отмена" : "+ Добавить должность"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3>
            {editingPosition ? "Редактирование должности" : "Новая должность"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Название должности *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Например: Мойщик, Администратор"
              />
            </div>
            <div className="form-group">
              <label>Зарплата (₽/час) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.salary}
                onChange={(e) =>
                  setFormData({ ...formData, salary: e.target.value })
                }
                placeholder="Например: 300"
              />
              <small style={{ color: "#7f8c8d", fontSize: "0.85rem" }}>
                Часовая ставка для сотрудников с фиксированной зарплатой
              </small>
            </div>
            <div className="form-group">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.can_manage_system}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      can_manage_system: e.target.checked,
                    })
                  }
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <span>Управление системой</span>
              </label>
              <small
                style={{
                  color: "#7f8c8d",
                  fontSize: "0.85rem",
                  display: "block",
                  marginTop: "0.25rem",
                }}
              >
                Сотрудники с этой должностью смогут стать администраторами
                системы
              </small>
            </div>
            <button type="submit" className="btn btn-success">
              Сохранить
            </button>
          </form>
        </div>
      )}

      <div className="card">
        {positions.length === 0 ? (
          <p>Должностей пока нет. Добавьте первую!</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Зарплата (₽/час)</th>
                <th>Управление системой</th>
                <th>Дата создания</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr
                  key={position.id}
                  onClick={() => handleRowClick(position)}
                  style={{
                    cursor: showForm ? "default" : "pointer",
                    backgroundColor:
                      selectedPosition?.id === position.id
                        ? "#e3f2fd"
                        : "transparent",
                    transition: "background-color 0.2s",
                  }}
                >
                  <td>{position.name}</td>
                  <td>{position.salary.toLocaleString("ru-RU")} ₽/час</td>
                  <td>
                    {position.can_manage_system ? (
                      <span
                        style={{
                          padding: "0.25rem 0.6rem",
                          borderRadius: "4px",
                          backgroundColor: "#764ba2",
                          color: "white",
                          fontSize: "0.85rem",
                        }}
                      >
                        Да
                      </span>
                    ) : (
                      <span style={{ color: "#95a5a6" }}>-</span>
                    )}
                  </td>
                  <td>
                    {new Date(position.created_at).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Positions;
