import React, { useState, useEffect } from "react";
import axios from "axios";
import EmployeeCalendar from "./EmployeeCalendar";
import Pagination from "./Pagination";
import { hasPermission } from "../auth";

const API_URL = process.env.REACT_APP_API_URL || "/api";


const formatPhoneNumber = (value) => {
  const cleaned = value.replace(/\D/g, "");
  const limited = cleaned.slice(0, 11);

  if (limited.length === 0) return "";
  if (limited.length <= 1) return limited;
  if (limited.length <= 4) return `${limited[0]} (${limited.slice(1)}`;
  if (limited.length <= 7)
    return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4)}`;
  if (limited.length <= 9)
    return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7)}`;
  return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7, 9)}-${limited.slice(9, 11)}`;
};

const getCleanPhoneNumber = (formatted) => {
  return formatted.replace(/\D/g, "");
};

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchName, setSearchName] = useState("");
  const [viewingCalendar, setViewingCalendar] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [showFireModal, setShowFireModal] = useState(false);
  const [fireDate, setFireDate] = useState("");
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    phone: "",
    position_id: "",
    salary_type: "fixed",
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName]);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        loadData();
      },
      searchName ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [currentPage, searchName]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesRes, positionsRes] = await Promise.all([
        axios.get(`${API_URL}/employees`, {
          params: {
            page: currentPage,
            page_size: PAGE_SIZE,
            search: searchName,
          },
        }),
        axios.get(`${API_URL}/positions`),
      ]);
      setEmployees(employeesRes.data.items || []);
      setTotalEmployees(employeesRes.data.total || 0);
      setPositions(positionsRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        phone: getCleanPhoneNumber(formData.phone),
      };

      if (editingEmployee) {
        await axios.put(
          `${API_URL}/employees/${editingEmployee.id}`,
          dataToSend,
        );
        setEditingEmployee(null);
      } else {
        await axios.post(`${API_URL}/employees`, dataToSend);
      }
      setFormData({
        first_name: "",
        last_name: "",
        middle_name: "",
        phone: "",
        position_id: "",
        salary_type: "fixed",
      });
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error("Ошибка сохранения сотрудника:", error);
      alert("Ошибка: " + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      middle_name: employee.middle_name || "",
      phone: formatPhoneNumber(employee.phone),
      position_id: employee.position_id,
      salary_type: employee.salary_type,
    });
    setShowForm(true);
    setSelectedEmployee(null);
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setFormData({
      first_name: "",
      last_name: "",
      middle_name: "",
      phone: "",
      position_id: "",
      salary_type: "fixed",
    });
    setShowForm(false);
  };

  const handleFireEmployee = async () => {
    if (!fireDate) {
      alert("Укажите дату увольнения");
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/employees/${selectedEmployee.id}/fire`,
        {
          fire_date: fireDate,
        },
      );
      alert(response.data.message);
      setShowFireModal(false);
      setFireDate("");
      setSelectedEmployee(null);
      loadData();
    } catch (error) {
      console.error("Ошибка увольнения сотрудника:", error);
      alert("Ошибка: " + (error.response?.data?.error || error.message));
    }
  };

  const handleActivateEmployee = async (id) => {
    const employee = selectedEmployee;
    const isFired = employee?.status === "fired";
    const confirmText = isFired
      ? "Вернуть сотрудника в штат?"
      : "Вернуть сотрудника к работе?";

    if (window.confirm(confirmText)) {
      try {
        const response = await axios.post(
          `${API_URL}/employees/${id}/activate`,
        );
        alert(response.data.message);
        setSelectedEmployee(null);
        loadData();
      } catch (error) {
        console.error("Ошибка активации сотрудника:", error);
        alert("Ошибка: " + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleRowClick = (employee) => {
    if (showForm) return;
    setSelectedEmployee(selectedEmployee?.id === employee.id ? null : employee);
  };

  const handleViewCalendar = (employee) => {
    setViewingCalendar(employee);
    setSelectedEmployee(null);
  };

  const handleBackFromCalendar = () => {
    setViewingCalendar(null);
    loadData();
  };

  if (viewingCalendar) {
    return (
      <EmployeeCalendar
        employee={viewingCalendar}
        onBack={handleBackFromCalendar}
      />
    );
  }

  if (loading && employees.length === 0)
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
          Сотрудники
        </h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Поиск по ФИО..."
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
          {selectedEmployee && (
            <>
              <button
                className="btn"
                style={{ backgroundColor: "#667eea", color: "white" }}
                onClick={() => handleViewCalendar(selectedEmployee)}
              >
                Календарь
              </button>
              {hasPermission("can_edit_employees") && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleEdit(selectedEmployee)}
                >
                  Редактировать
                </button>
              )}
              {hasPermission("can_fire_employees") &&
                selectedEmployee.status === "active" && (
                  <button
                    className="btn btn-danger"
                    onClick={() => setShowFireModal(true)}
                  >
                    Уволить
                  </button>
                )}
              {hasPermission("can_fire_employees") &&
                selectedEmployee.status === "fired" && (
                  <button
                    className="btn btn-success"
                    onClick={() => handleActivateEmployee(selectedEmployee.id)}
                  >
                    Вернуть в штат
                  </button>
                )}
            </>
          )}
          {(hasPermission("can_create_employees") || showForm) && (
            <button
              className="btn btn-success"
              onClick={() =>
                editingEmployee ? handleCancelEdit() : setShowForm(!showForm)
              }
            >
              {showForm ? "Отмена" : "+ Добавить сотрудника"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3>
            {editingEmployee ? "Редактирование сотрудника" : "Новый сотрудник"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Фамилия *</label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Имя *</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Отчество</label>
              <input
                type="text"
                value={formData.middle_name}
                onChange={(e) =>
                  setFormData({ ...formData, middle_name: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Телефон *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: formatPhoneNumber(e.target.value),
                  })
                }
                placeholder="7 (999) 123-45-67"
              />
            </div>
            <div className="form-group">
              <label>Должность *</label>
              <select
                required
                value={formData.position_id}
                onChange={(e) =>
                  setFormData({ ...formData, position_id: e.target.value })
                }
              >
                <option value="">Выберите должность</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name} ({position.salary.toLocaleString("ru-RU")}{" "}
                    ₽/час)
                  </option>
                ))}
              </select>
              {positions.length === 0 && (
                <small style={{ color: "#e74c3c", fontSize: "0.85rem" }}>
                   Сначала создайте должности во вкладке "Должности"
                </small>
              )}
            </div>
            <div className="form-group">
              <label>Тип зарплаты *</label>
              <select
                required
                value={formData.salary_type}
                onChange={(e) =>
                  setFormData({ ...formData, salary_type: e.target.value })
                }
              >
                <option value="fixed">
                  Фиксированная (часовая ставка из должности)
                </option>
                <option value="piecework">
                  Сдельная (от количества заказов)
                </option>
              </select>
              <small style={{ color: "#7f8c8d", fontSize: "0.85rem" }}>
                {formData.salary_type === "fixed"
                  ? " Сотрудник получает фиксированную часовую ставку согласно должности"
                  : " Зарплата зависит от количества выполненных заказов"}
              </small>
            </div>
            <button
              type="submit"
              className="btn btn-success"
              disabled={positions.length === 0}
            >
              Сохранить
            </button>
          </form>
        </div>
      )}

      <div className="card">
        {totalEmployees === 0 && !searchName ? (
          <div>
            <p>Сотрудников пока нет. Добавьте первого!</p>
            {positions.length === 0 && (
              <p style={{ color: "#e74c3c", marginTop: "1rem" }}>
                 Сначала создайте должности во вкладке "Должности"
              </p>
            )}
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Телефон</th>
                  <th>Должность</th>
                  <th>Зарплата (₽/час)</th>
                  <th>Тип зарплаты</th>
                  <th>Статус</th>
                  <th>Дата приема</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => handleRowClick(employee)}
                    style={{
                      cursor: showForm ? "default" : "pointer",
                      backgroundColor:
                        selectedEmployee?.id === employee.id
                          ? "#e3f2fd"
                          : "transparent",
                      transition: "background-color 0.2s",
                    }}
                  >
                    <td>{employee.full_name}</td>
                    <td>{formatPhoneNumber(employee.phone)}</td>
                    <td>{employee.position_name}</td>
                    <td>
                      {employee.position_salary?.toLocaleString("ru-RU")} ₽/час
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          borderRadius: "4px",
                          backgroundColor:
                            employee.salary_type === "fixed"
                              ? "#3498db"
                              : "#f39c12",
                          color: "white",
                          fontSize: "0.85rem",
                        }}
                      >
                        {employee.salary_type_display}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          borderRadius: "4px",
                          backgroundColor:
                            employee.status === "active"
                              ? "#2ecc71"
                              : employee.status === "sick_leave"
                                ? "#f39c12"
                                : employee.status === "fired"
                                  ? "#e74c3c"
                                  : "#95a5a6",
                          color: "white",
                          fontSize: "0.85rem",
                        }}
                      >
                        {employee.status_display}
                      </span>
                      {employee.status === "sick_leave" &&
                        employee.sick_leave_end && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#7f8c8d",
                              marginTop: "0.25rem",
                            }}
                          >
                            до{" "}
                            {new Date(
                              employee.sick_leave_end,
                            ).toLocaleDateString("ru-RU")}
                          </div>
                        )}
                      {employee.status === "fired" && employee.fired_date && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#7f8c8d",
                            marginTop: "0.25rem",
                          }}
                        >
                          {new Date(employee.fired_date).toLocaleDateString(
                            "ru-RU",
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {new Date(employee.created_at).toLocaleDateString(
                        "ru-RU",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalItems={totalEmployees}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>


      {showFireModal && (
        <div className="modal-overlay" onClick={() => setShowFireModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <div className="modal-header">
              <h2>Уволить сотрудника</h2>
              <button
                className="modal-close"
                onClick={() => setShowFireModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Сотрудник:</strong> {selectedEmployee?.full_name}
              </p>
              <div className="form-group">
                <label>Дата увольнения *</label>
                <input
                  type="date"
                  value={fireDate}
                  onChange={(e) => setFireDate(e.target.value)}
                  required
                />
              </div>
              <div
                style={{
                  padding: "1rem",
                  background: "#f8d7da",
                  borderRadius: "6px",
                  marginTop: "1rem",
                  border: "1px solid #f5c6cb",
                }}
              >
                 <strong>Внимание!</strong> Все будущие назначения сотрудника
                будут удалены. Это действие нельзя отменить.
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowFireModal(false)}
              >
                Отмена
              </button>
              <button className="btn btn-danger" onClick={handleFireEmployee}>
                Уволить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Employees;
