import React, { useState, useEffect, useCallback } from "react";
import api from "../api";
import { isOwner, hasPermission } from "../auth";
import "./AdminSchedule.css";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_NAMES = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

// «Петров Иван Сергеевич» → «Петров И.С.»
const shortName = (fullName) => {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[0];
  const initials = parts
    .slice(1)
    .map((p) => p[0] + ".")
    .join("");
  return `${last} ${initials}`;
};

const formatDateKey = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Цвет для админа (стабильный по id)
const getAdminColor = (id) => {
  const colors = [
    {
      bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      solid: "#667eea",
    },
    {
      bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      solid: "#f5576c",
    },
    {
      bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      solid: "#4facfe",
    },
    {
      bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      solid: "#43e97b",
    },
    {
      bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      solid: "#fa709a",
    },
    {
      bg: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
      solid: "#30cfd0",
    },
    {
      bg: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
      solid: "#ff9a9e",
    },
  ];
  return colors[id % colors.length];
};

function AdminSchedule() {
  const [admins, setAdmins] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Текущий период (2 недели)
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const d = new Date(today);
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // Пн = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedDate, setSelectedDate] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);

  const [formData, setFormData] = useState({
    user_id: "",
    start_time: "10:00",
    end_time: "22:00",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 13);

      // Используем endpoint, доступный и админам с правом can_view_admin_schedule
      const adminsUrl = isOwner()
        ? '/auth/users'
        : '/auth/admins-list';

      // Запросы делаем независимо, чтобы ошибка одного не блокировала другой
      const adminsPromise = api.get(adminsUrl).catch((err) => {
        console.error(
          "Ошибка загрузки списка админов:",
          err.response?.status,
          err.response?.data,
        );
        return null;
      });
      const schedulesPromise = api
        .get('/admin-schedules', {
          params: {
            start_date: formatDateKey(weekStart),
            end_date: formatDateKey(endDate),
          },
        })
        .catch((err) => {
          console.error(
            "Ошибка загрузки расписания:",
            err.response?.status,
            err.response?.data,
          );
          return null;
        });

      const [adminsRes, schedulesRes] = await Promise.all([
        adminsPromise,
        schedulesPromise,
      ]);

      if (adminsRes) {
        // Только активные админы (не владелец)
        setAdmins(
          adminsRes.data.filter((u) => u.role === "admin" && u.is_active),
        );
      } else {
        setAdmins([]);
        alert(
          "Не удалось загрузить список администраторов. Возможно, нужно перезапустить бэкенд или у вас нет прав.",
        );
      }

      if (schedulesRes) {
        setSchedules(schedulesRes.data);
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error("Ошибка загрузки:", err);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changeWeek = (offset) => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + offset * 7);
    setWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const d = new Date(today);
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
  };

  // Генерируем 14 дней
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  // Группируем смены по дате
  const schedulesByDate = {};
  schedules.forEach((s) => {
    if (!schedulesByDate[s.date]) schedulesByDate[s.date] = [];
    schedulesByDate[s.date].push(s);
  });

  // Сортируем смены внутри дня по времени начала
  Object.keys(schedulesByDate).forEach((d) => {
    schedulesByDate[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  const userIsOwner = isOwner();
  const canEdit = userIsOwner || hasPermission("can_edit_admin_schedule");

  // Для админа: проверяет, можно ли редактировать смену
  const canEditShift = (schedule) => {
    if (!canEdit) return false;
    if (userIsOwner) return true;
    const now = new Date();
    const shiftStart = new Date(
      schedule.date + "T" + schedule.start_time + ":00",
    );
    // Не-владелец может редактировать только будущие смены
    return shiftStart > now;
  };

  // Для админа: можно ли создавать смену на эту дату
  const canCreateOnDate = (date) => {
    if (!canEdit) return false;
    if (userIsOwner) return true;
    const now = new Date();
    const day = new Date(date);
    day.setHours(23, 59, 59, 999);
    return day >= now;
  };

  const handleCellClick = (date) => {
    if (!canCreateOnDate(date)) {
      // Просто не открываем форму, без ошибки
      return;
    }
    setSelectedDate(formatDateKey(date));
    setEditingSchedule(null);
    setFormData({ user_id: "", start_time: "10:00", end_time: "22:00" });
  };

  const handleEditShift = (e, schedule) => {
    e.stopPropagation();
    if (!canEditShift(schedule)) {
      alert(
        "Эту смену может редактировать только владелец (текущая или прошедшая смена).",
      );
      return;
    }
    setSelectedDate(schedule.date);
    setEditingSchedule(schedule);
    setFormData({
      user_id: String(schedule.user_id),
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    });
  };

  const handleDeleteShift = async (e, schedule) => {
    e.stopPropagation();
    if (!canEditShift(schedule)) {
      alert(
        "Эту смену может удалить только владелец (текущая или прошедшая смена).",
      );
      return;
    }
    if (
      !window.confirm(
        `Удалить смену ${shortName(schedule.user_full_name)} ${schedule.start_time}-${schedule.end_time}?`,
      )
    )
      return;
    try {
      await api.delete(`/admin-schedules/${schedule.id}`);
      loadData();
    } catch (err) {
      alert("Ошибка: " + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.user_id) {
      alert("Выберите администратора");
      return;
    }

    try {
      if (editingSchedule) {
        await api.put(`/admin-schedules/${editingSchedule.id}`, {
          user_id: parseInt(formData.user_id),
          date: selectedDate,
          start_time: formData.start_time,
          end_time: formData.end_time,
        });
      } else {
        await api.post(`/admin-schedules`, {
          user_id: parseInt(formData.user_id),
          date: selectedDate,
          start_time: formData.start_time,
          end_time: formData.end_time,
        });
      }

      setSelectedDate(null);
      setEditingSchedule(null);
      loadData();
    } catch (err) {
      alert("Ошибка: " + (err.response?.data?.error || err.message));
    }
  };

  const closeModal = () => {
    setSelectedDate(null);
    setEditingSchedule(null);
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  const today = formatDateKey(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 13);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h2 className="page-title" style={{ margin: 0 }}>
          Расписание администраторов
        </h2>
      </div>

      {canEdit && !userIsOwner && (
        <div className="admin-schedule-info-banner" style={{ fontWeight: 600 }}>
          Вы можете редактировать только будущие смены. Текущую и прошедшие
          смены может изменять только владелец.
        </div>
      )}

      {admins.length === 0 && userIsOwner ? (
        <div
          className="card"
          style={{ textAlign: "center", padding: "2rem", color: "#7f8c8d" }}
        >
          Нет активных администраторов. Создайте их в разделе «Администраторы».
        </div>
      ) : (
        <>
          <div className="admin-schedule-toolbar">
            <div className="admin-schedule-nav">
              <button
                className="btn btn-secondary"
                onClick={() => changeWeek(-1)}
              >
                ← Пред 2 нед
              </button>
              <div className="admin-schedule-period">
                {weekStart.getDate()} {MONTH_NAMES[weekStart.getMonth()]} –{" "}
                {weekEnd.getDate()} {MONTH_NAMES[weekEnd.getMonth()]}{" "}
                {weekEnd.getFullYear()}
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => changeWeek(1)}
              >
                След 2 нед →
              </button>
              <button className="btn btn-primary" onClick={goToCurrentWeek}>
                Сегодня
              </button>
            </div>

            <div className="admin-schedule-legend">
              {admins.map((admin) => {
                const color = getAdminColor(admin.id);
                return (
                  <div key={admin.id} className="admin-legend-item">
                    <span
                      className="admin-legend-color"
                      style={{ background: color.bg }}
                    ></span>
                    <span>{shortName(admin.full_name)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="admin-schedule-grid">
            {days.map((day) => {
              const key = formatDateKey(day);
              const dayShifts = schedulesByDate[key] || [];
              const isToday = key === today;
              const isPast = key < today;
              const dayName =
                WEEKDAYS[day.getDay() === 0 ? 6 : day.getDay() - 1];

              return (
                <div
                  key={key}
                  className={`admin-schedule-cell ${isToday ? "today" : ""} ${isPast ? "past" : ""}`}
                  onClick={() => handleCellClick(day)}
                  style={
                    !canCreateOnDate(day) ? { cursor: "default" } : undefined
                  }
                >
                  <div className="admin-schedule-cell-header">
                    <span className="admin-schedule-day-num">
                      {day.getDate()}
                    </span>
                    <span className="admin-schedule-day-name">{dayName}</span>
                  </div>

                  <div className="admin-schedule-shifts">
                    {dayShifts.map((s) => {
                      const color = getAdminColor(s.user_id);
                      const editable = canEditShift(s);
                      return (
                        <div
                          key={s.id}
                          className="admin-schedule-shift"
                          style={{
                            background: color.bg,
                            opacity: editable ? 1 : 0.75,
                            cursor: editable ? "pointer" : "default",
                          }}
                          onClick={(e) => handleEditShift(e, s)}
                          title={
                            editable
                              ? "Клик — редактировать"
                              : "Только владелец может редактировать"
                          }
                        >
                          <div className="admin-schedule-shift-name">
                            {shortName(s.user_full_name)}
                          </div>
                          <div className="admin-schedule-shift-time">
                            {s.start_time}–{s.end_time}
                          </div>
                          {editable && (
                            <button
                              className="admin-schedule-shift-delete"
                              onClick={(e) => handleDeleteShift(e, s)}
                              title="Удалить смену"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canCreateOnDate(day) && (
                    <div className="admin-schedule-add-hint">+ назначить</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Модальное окно назначения/редактирования смены */}
      {selectedDate && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <div className="modal-header">
              <h2>
                {editingSchedule ? "Редактирование смены" : "Новая смена"}
              </h2>
              <button className="modal-close" onClick={closeModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: "1rem", color: "#7f8c8d" }}>
                <strong>Дата:</strong>{" "}
                {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                  "ru-RU",
                  {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    weekday: "long",
                  },
                )}
              </p>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Администратор *</label>
                  <select
                    required
                    value={formData.user_id}
                    onChange={(e) =>
                      setFormData({ ...formData, user_id: e.target.value })
                    }
                  >
                    <option value="">Выберите администратора</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.login})
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                  }}
                >
                  <div className="form-group">
                    <label>Начало *</label>
                    <input
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) =>
                        setFormData({ ...formData, start_time: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Окончание *</label>
                    <input
                      type="time"
                      required
                      value={formData.end_time}
                      onChange={(e) =>
                        setFormData({ ...formData, end_time: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    padding: "0.75rem",
                    background: "#e3f2fd",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    color: "#2c3e50",
                  }}
                >
                  В выбранное время не должно быть других смен — пересечения
                  запрещены
                </div>
              </form>
            </div>
            <div className="modal-footer">
              {editingSchedule && (
                <button
                  className="btn btn-danger"
                  style={{ marginRight: "auto" }}
                  onClick={async (e) => {
                    if (window.confirm("Удалить эту смену?")) {
                      await handleDeleteShift(e, editingSchedule);
                      closeModal();
                    }
                  }}
                >
                  Удалить
                </button>
              )}
              <button className="btn btn-secondary" onClick={closeModal}>
                Отмена
              </button>
              <button className="btn btn-success" onClick={handleSubmit}>
                {editingSchedule ? "Сохранить" : "Назначить смену"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSchedule;
