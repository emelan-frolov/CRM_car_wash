import React, { useState, useEffect } from "react";
import axios from "axios";
import ChangePasswordModal from "./ChangePasswordModal";

const API_URL = process.env.REACT_APP_API_URL || "/api";

function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    login: "",
    password: "",
    employee_id: "",
    can_view_statistics: false,
    can_view_admin_schedule: false,
    can_view_positions: false,
    can_edit_positions: false,
    can_delete_positions: false,
    can_create_positions: false,
    can_view_employees: false,
    can_edit_employees: false,
    can_fire_employees: false,
    can_create_employees: false,
    can_view_services: false,
    can_edit_services: false,
    can_delete_services: false,
    can_create_services: false,
    can_export_orders: false,
    can_view_box_schedule: false,
    can_edit_box_schedule: false,
    can_edit_admin_schedule: false,
  });
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [permissionsTarget, setPermissionsTarget] = useState(null);
  const [permissionsForm, setPermissionsForm] = useState({
    can_view_statistics: false,
    can_view_admin_schedule: false,
    can_view_positions: false,
    can_edit_positions: false,
    can_delete_positions: false,
    can_create_positions: false,
    can_view_employees: false,
    can_edit_employees: false,
    can_fire_employees: false,
    can_create_employees: false,
    can_view_services: false,
    can_edit_services: false,
    can_delete_services: false,
    can_create_services: false,
    can_export_orders: false,
    can_view_box_schedule: false,
    can_edit_box_schedule: false,
    can_edit_admin_schedule: false,
  });
  const [showOwnPasswordModal, setShowOwnPasswordModal] = useState(false);

  const applyAutoEnable = (form, field, value) => {
    const next = { ...form, [field]: value };
    if (value) {
      if (
        [
          "can_edit_positions",
          "can_delete_positions",
          "can_create_positions",
        ].includes(field)
      )
        next.can_view_positions = true;
      if (
        [
          "can_edit_employees",
          "can_fire_employees",
          "can_create_employees",
        ].includes(field)
      )
        next.can_view_employees = true;
      if (
        [
          "can_edit_services",
          "can_delete_services",
          "can_create_services",
        ].includes(field)
      )
        next.can_view_services = true;
      if (field === "can_edit_box_schedule") next.can_view_box_schedule = true;
      if (field === "can_edit_admin_schedule")
        next.can_view_admin_schedule = true;
    } else {
      if (field === "can_view_positions") {
        next.can_edit_positions = false;
        next.can_delete_positions = false;
        next.can_create_positions = false;
      }
      if (field === "can_view_employees") {
        next.can_edit_employees = false;
        next.can_fire_employees = false;
        next.can_create_employees = false;
      }
      if (field === "can_view_services") {
        next.can_edit_services = false;
        next.can_delete_services = false;
        next.can_create_services = false;
      }
      if (field === "can_view_box_schedule") next.can_edit_box_schedule = false;
      if (field === "can_view_admin_schedule")
        next.can_edit_admin_schedule = false;
    }
    return next;
  };

  const handleFormPermChange = (field, value) => {
    setFormData((prev) => applyAutoEnable(prev, field, value));
  };

  const handlePermChange = (field, value) => {
    setPermissionsForm((prev) => applyAutoEnable(prev, field, value));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [usersRes, employeesRes] = await Promise.all([
        axios.get(`${API_URL}/auth/users`),
        axios.get(`${API_URL}/auth/eligible-employees`),
      ]);
      setUsers(usersRes.data);
      setEligibleEmployees(employeesRes.data);
    } catch (err) {
      console.error("Ошибка загрузки:", err);
      if (err.response?.status === 403) {
        alert("Доступ только для владельца");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_id) {
      alert("Выберите сотрудника");
      return;
    }
    try {
      const allPermFields = [
        "can_view_statistics",
        "can_view_admin_schedule",
        "can_view_positions",
        "can_edit_positions",
        "can_delete_positions",
        "can_create_positions",
        "can_view_employees",
        "can_edit_employees",
        "can_fire_employees",
        "can_create_employees",
        "can_view_services",
        "can_edit_services",
        "can_delete_services",
        "can_create_services",
        "can_export_orders",
        "can_view_box_schedule",
        "can_edit_box_schedule",
        "can_edit_admin_schedule",
      ];
      const perms = {};
      allPermFields.forEach((f) => {
        perms[f] = formData[f];
      });
      await axios.post(`${API_URL}/auth/users`, {
        login: formData.login,
        password: formData.password,
        employee_id: parseInt(formData.employee_id),
        ...perms,
      });
      setFormData({
        login: "",
        password: "",
        employee_id: "",
        can_view_statistics: false,
        can_view_admin_schedule: false,
        can_view_positions: false,
        can_edit_positions: false,
        can_delete_positions: false,
        can_create_positions: false,
        can_view_employees: false,
        can_edit_employees: false,
        can_fire_employees: false,
        can_create_employees: false,
        can_view_services: false,
        can_edit_services: false,
        can_delete_services: false,
        can_create_services: false,
        can_export_orders: false,
        can_view_box_schedule: false,
        can_edit_box_schedule: false,
        can_edit_admin_schedule: false,
      });
      setShowForm(false);
      loadAll();
    } catch (err) {
      alert("Ошибка: " + (err.response?.data?.error || err.message));
    }
  };

  const openPermissionsModal = (user) => {
    setPermissionsTarget(user);
    setPermissionsForm({
      can_view_statistics: !!user.can_view_statistics,
      can_view_admin_schedule: !!user.can_view_admin_schedule,
      can_view_positions: !!user.can_view_positions,
      can_edit_positions: !!user.can_edit_positions,
      can_delete_positions: !!user.can_delete_positions,
      can_create_positions: !!user.can_create_positions,
      can_view_employees: !!user.can_view_employees,
      can_edit_employees: !!user.can_edit_employees,
      can_fire_employees: !!user.can_fire_employees,
      can_create_employees: !!user.can_create_employees,
      can_view_services: !!user.can_view_services,
      can_edit_services: !!user.can_edit_services,
      can_delete_services: !!user.can_delete_services,
      can_create_services: !!user.can_create_services,
      can_export_orders: !!user.can_export_orders,
      can_view_box_schedule: !!user.can_view_box_schedule,
      can_edit_box_schedule: !!user.can_edit_box_schedule,
      can_edit_admin_schedule: !!user.can_edit_admin_schedule,
    });
  };

  const handleSavePermissions = async () => {
    try {
      await axios.put(
        `${API_URL}/auth/users/${permissionsTarget.id}/permissions`,
        permissionsForm,
      );
      setPermissionsTarget(null);
      loadAll();
    } catch (err) {
      alert("Ошибка: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (user) => {
    if (
      !window.confirm(
        `Удалить пользователя "${user.full_name}" (${user.login})-`,
      )
    )
      return;
    try {
      await axios.delete(`${API_URL}/auth/users/${user.id}`);
      loadAll();
    } catch (err) {
      alert("Ошибка: " + (err.response?.data?.error || err.message));
    }
  };

  const handleResetPassword = async () => {
    if (resetPassword.length < 6) {
      alert("Пароль должен быть не короче 6 символов");
      return;
    }
    try {
      await axios.post(
        `${API_URL}/auth/users/${resetTarget.id}/reset-password`,
        {
          password: resetPassword,
        },
      );
      alert(`Пароль для "${resetTarget.login}" успешно изменён`);
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      alert("Ошибка: " + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  const renderPermBlock = (form, onChange) => {
    const sectionHeader = (emoji, title, note) => (
      <div
        style={{
          padding: "0.4rem 0.75rem",
          background: "#eef2f7",
          fontWeight: 700,
          fontSize: "0.78rem",
          color: "#444",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          borderBottom: "1px solid #ddd",
        }}
      >
        {emoji ? `${emoji} ${title}` : title}
        {note && (
          <span
            style={{
              fontWeight: 400,
              textTransform: "none",
              fontSize: "0.75rem",
              color: "#888",
              marginLeft: "0.4rem",
            }}
          >
            {note}
          </span>
        )}
      </div>
    );
    const parentCb = (field, label) => (
      <label
        key={field}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          cursor: "pointer",
          padding: "0.4rem 0.75rem",
        }}
      >
        <input
          type="checkbox"
          checked={!!form[field]}
          onChange={(e) => onChange(field, e.target.checked)}
          style={{ width: "16px", height: "16px", cursor: "pointer" }}
        />
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{label}</span>
      </label>
    );
    const childrenBlock = (parentField, items) => (
      <div
        style={{
          paddingLeft: "2.25rem",
          paddingRight: "0.75rem",
          paddingBottom: "0.5rem",
          paddingTop: "0.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem",
          borderLeft: "2px solid #c8d6e5",
          marginLeft: "1.25rem",
        }}
      >
        {items.map(({ field, label }) => {
          const enabled = !!form[parentField];
          return (
            <label
              key={field}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: enabled ? "pointer" : "not-allowed",
                opacity: enabled ? 1 : 0.4,
              }}
            >
              <input
                type="checkbox"
                checked={!!form[field]}
                onChange={(e) => onChange(field, e.target.checked)}
                disabled={!enabled}
                style={{
                  width: "15px",
                  height: "15px",
                  cursor: enabled ? "pointer" : "not-allowed",
                }}
              />
              <span style={{ fontSize: "0.88rem" }}>{label}</span>
            </label>
          );
        })}
      </div>
    );
    const section = (emoji, title, note, children) => (
      <div
        style={{
          border: "1px solid #dde",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {sectionHeader(emoji, title, note)}
        {children}
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {section(
          "",
          "Должности",
          null,
          <>
            {parentCb("can_view_positions", "Просмотр")}
            {childrenBlock("can_view_positions", [
              { field: "can_create_positions", label: "Добавлять" },
              { field: "can_edit_positions", label: "Редактировать" },
              { field: "can_delete_positions", label: "Удалять" },
            ])}
          </>,
        )}
        {section(
          "",
          "Сотрудники",
          null,
          <>
            {parentCb("can_view_employees", "Просмотр")}
            {childrenBlock("can_view_employees", [
              { field: "can_create_employees", label: "Добавлять" },
              { field: "can_edit_employees", label: "Редактировать" },
              { field: "can_fire_employees", label: "Увольнять" },
            ])}
          </>,
        )}
        {section(
          "",
          "Услуги",
          null,
          <>
            {parentCb("can_view_services", "Просмотр")}
            {childrenBlock("can_view_services", [
              { field: "can_create_services", label: "Добавлять" },
              { field: "can_edit_services", label: "Редактировать" },
              { field: "can_delete_services", label: "Удалять" },
            ])}
          </>,
        )}
        {section(
          "",
          "Заказы",
          "(всегда доступны)",
          <div
            style={{
              paddingLeft: "2.25rem",
              paddingRight: "0.75rem",
              paddingTop: "0.4rem",
              paddingBottom: "0.5rem",
            }}
          >
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
                checked={!!form.can_export_orders}
                onChange={(e) =>
                  onChange("can_export_orders", e.target.checked)
                }
                style={{ width: "15px", height: "15px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.88rem" }}>Экспорт в Excel</span>
            </label>
          </div>,
        )}
        {section(
          "",
          "Расписание боксов",
          null,
          <>
            {parentCb("can_view_box_schedule", "Просмотр")}
            {childrenBlock("can_view_box_schedule", [
              { field: "can_edit_box_schedule", label: "Редактирование" },
            ])}
          </>,
        )}
        {section(
          "",
          "Смены администраторов",
          null,
          <>
            {parentCb("can_view_admin_schedule", "Просмотр")}
            {childrenBlock("can_view_admin_schedule", [
              { field: "can_edit_admin_schedule", label: "Редактирование" },
            ])}
          </>,
        )}
        {section(
          "",
          "Прочее",
          null,
          <div
            style={{
              padding: "0.4rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
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
                checked={!!form.can_view_statistics}
                onChange={(e) =>
                  onChange("can_view_statistics", e.target.checked)
                }
                style={{ width: "15px", height: "15px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.88rem" }}>Статистика</span>
            </label>
          </div>,
        )}
      </div>
    );
  };

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
          Управление администраторами
        </h2>
        <button
          className="btn btn-success"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Отмена" : "+ Добавить администратора"}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3>Новый администратор</h3>
          {eligibleEmployees.length === 0 ? (
            <div
              style={{
                padding: "1rem",
                background: "#fef5e7",
                borderRadius: "6px",
                color: "#856404",
              }}
            >
               Нет доступных сотрудников для назначения админом.
              <br />
              <br />
              Чтобы сотрудник появился в этом списке:
              <ol style={{ marginTop: "0.5rem" }}>
                <li>
                  В разделе <strong>«Должности»</strong> поставьте галочку{" "}
                  <strong>«Управление системой»</strong> на нужной должности
                </li>
                <li>
                  В разделе <strong>«Сотрудники»</strong> назначьте сотруднику
                  эту должность
                </li>
                <li>У сотрудника должен быть статус «Работает»</li>
                <li>
                  У сотрудника не должно быть уже созданной учётной записи
                </li>
              </ol>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Сотрудник *</label>
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) =>
                    setFormData({ ...formData, employee_id: e.target.value })
                  }
                >
                  <option value="">Выберите сотрудника</option>
                  {eligibleEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} - {emp.position_name}
                    </option>
                  ))}
                </select>
                <small style={{ color: "#7f8c8d", fontSize: "0.85rem" }}>
                  Показаны только сотрудники с должностью, у которой включено
                  «Управление системой»
                </small>
              </div>

              <div className="form-group">
                <label>Логин *</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={formData.login}
                  onChange={(e) =>
                    setFormData({ ...formData, login: e.target.value.trim() })
                  }
                  placeholder="например: petrov"
                />
                <small style={{ color: "#7f8c8d", fontSize: "0.85rem" }}>
                  Минимум 3 символа, латиница и цифры
                </small>
              </div>

              <div className="form-group">
                <label>Пароль *</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="минимум 6 символов"
                />
                <small style={{ color: "#7f8c8d", fontSize: "0.85rem" }}>
                  Сообщите пароль сотруднику лично. После входа он сможет
                  работать в системе.
                </small>
              </div>

              <div className="form-group">
                <label style={{ marginBottom: "0.5rem", display: "block" }}>
                  Права доступа
                </label>
                {renderPermBlock(formData, handleFormPermChange)}
              </div>

              <button type="submit" className="btn btn-success">
                Создать учётную запись
              </button>
            </form>
          )}
        </div>
      )}

      <div className="card">
        {users.length === 0 ? (
          <p>Пользователей нет</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Логин</th>
                <th>ФИО</th>
                <th>Должность</th>
                <th>Роль</th>
                <th>Права</th>
                <th>Создан</th>
                <th>Последний вход</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.login}</strong>
                  </td>
                  <td>{user.full_name}</td>
                  <td>
                    {user.employee_position ? (
                      <span style={{ color: "#2c3e50" }}>
                        {user.employee_position}
                      </span>
                    ) : (
                      <span style={{ color: "#95a5a6" }}>-</span>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "0.25rem 0.6rem",
                        borderRadius: "4px",
                        backgroundColor:
                          user.role === "owner" ? "#764ba2" : "#3498db",
                        color: "white",
                        fontSize: "0.85rem",
                      }}
                    >
                      {user.role === "owner" ? "Владелец" : "Администратор"}
                    </span>
                  </td>
                  <td>
                    {user.role === "owner" ? (
                      <span
                        style={{
                          color: "#764ba2",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                        }}
                      >
                        Все права
                      </span>
                    ) : (
                      (() => {
                        const parts = [];
                        if (user.can_view_positions) {
                          const sub = [
                            user.can_create_positions && "доб",
                            user.can_edit_positions && "ред",
                            user.can_delete_positions && "удал",
                          ].filter(Boolean);
                          parts.push(
                            "Должности" +
                              (sub.length ? " (" + sub.join(", ") + ")" : ""),
                          );
                        }
                        if (user.can_view_employees) {
                          const sub = [
                            user.can_create_employees && "доб",
                            user.can_edit_employees && "ред",
                            user.can_fire_employees && "увол",
                          ].filter(Boolean);
                          parts.push(
                            "Сотрудники" +
                              (sub.length ? " (" + sub.join(", ") + ")" : ""),
                          );
                        }
                        if (user.can_view_services) {
                          const sub = [
                            user.can_create_services && "доб",
                            user.can_edit_services && "ред",
                            user.can_delete_services && "удал",
                          ].filter(Boolean);
                          parts.push(
                            "Услуги" +
                              (sub.length ? " (" + sub.join(", ") + ")" : ""),
                          );
                        }
                        if (user.can_export_orders)
                          parts.push("Экспорт заказов");
                        if (user.can_view_statistics) parts.push("Статистика");
                        if (user.can_view_box_schedule) {
                          parts.push(
                            "Расписание боксов" +
                              (user.can_edit_box_schedule ? " (ред.)" : ""),
                          );
                        }
                        if (user.can_view_admin_schedule) {
                          parts.push(
                            "Смены админов" +
                              (user.can_edit_admin_schedule ? " (ред.)" : ""),
                          );
                        }
                        return parts.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.15rem",
                              fontSize: "0.8rem",
                              color: "#2c3e50",
                            }}
                          >
                            {parts.map((p, i) => (
                              <span key={i}>{p}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#95a5a6" }}>-</span>
                        );
                      })()
                    )}
                  </td>
                  <td>
                    {new Date(user.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td>
                    {user.last_login ? (
                      new Date(user.last_login).toLocaleString("ru-RU")
                    ) : (
                      <span style={{ color: "#95a5a6" }}>-</span>
                    )}
                  </td>
                  <td>
                    {user.role === "owner" ? (
                      <button
                        className="btn"
                        style={{
                          padding: "0.3rem 0.7rem",
                          fontSize: "0.85rem",
                          background: "#3498db",
                          color: "white",
                        }}
                        onClick={() => setShowOwnPasswordModal(true)}
                        title="Сменить свой пароль"
                      >
                        Сменить пароль
                      </button>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          gap: "0.4rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="btn"
                          style={{
                            padding: "0.3rem 0.7rem",
                            fontSize: "0.85rem",
                            background: "#9b59b6",
                            color: "white",
                          }}
                          onClick={() => openPermissionsModal(user)}
                          title="Редактировать права"
                        >
                          Права
                        </button>
                        <button
                          className="btn"
                          style={{
                            padding: "0.3rem 0.7rem",
                            fontSize: "0.85rem",
                            background: "#3498db",
                            color: "white",
                          }}
                          onClick={() => setResetTarget(user)}
                        >
                          Пароль
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{
                            padding: "0.3rem 0.7rem",
                            fontSize: "0.85rem",
                          }}
                          onClick={() => handleDelete(user)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <div className="modal-header">
              <h2>Смена пароля</h2>
              <button
                className="modal-close"
                onClick={() => setResetTarget(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Пользователь:</strong> {resetTarget.full_name} (
                {resetTarget.login})
              </p>
              <div className="form-group">
                <label>Новый пароль *</label>
                <input
                  type="text"
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="минимум 6 символов"
                  autoFocus
                />
              </div>
              <div
                style={{
                  padding: "0.75rem",
                  background: "#fff3cd",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  color: "#856404",
                }}
              >
                Сообщите новый пароль пользователю лично
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setResetTarget(null)}
              >
                Отмена
              </button>
              <button className="btn btn-primary" onClick={handleResetPassword}>
                Сменить пароль
              </button>
            </div>
          </div>
        </div>
      )}


      {permissionsTarget && (
        <div
          className="modal-overlay"
          onClick={() => setPermissionsTarget(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <div className="modal-header">
              <h2>Права администратора</h2>
              <button
                className="modal-close"
                onClick={() => setPermissionsTarget(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: "1.25rem" }}>
                <strong>Пользователь:</strong> {permissionsTarget.full_name} (
                {permissionsTarget.login})
              </p>
              {renderPermBlock(permissionsForm, handlePermChange)}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setPermissionsTarget(null)}
              >
                Отмена
              </button>
              <button
                className="btn btn-success"
                onClick={handleSavePermissions}
              >
                Сохранить права
              </button>
            </div>
          </div>
        </div>
      )}


      <ChangePasswordModal
        isOpen={showOwnPasswordModal}
        onClose={() => setShowOwnPasswordModal(false)}
      />
    </div>
  );
}

export default UsersAdmin;
