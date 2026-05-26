import React, { useState, useEffect } from "react";
import axios from "axios";
import "./BoxSchedule.css";
import DayShiftsModal from "./DayShiftsModal";
import { hasPermission } from "../auth";

const API_URL = process.env.REACT_APP_API_URL || "/api";


const formatShortName = (fullName) => {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastName = parts[0];
  const initials = parts
    .slice(1)
    .map((p) => p[0] + ".")
    .join("");
  return `${lastName} ${initials}`;
};

function BoxSchedule() {

  const getMonday = (date) => {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return addDays(d, daysToMonday);
  };

  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const [boxes, setBoxes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(getMonday(new Date()));
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [shiftsModalDate, setShiftsModalDate] = useState(null);
  const [shiftsModalBox, setShiftsModalBox] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (boxes.length > 0) {
      loadSchedules();
    }
  }, [startDate]);

  const loadData = async () => {
    try {
      const [boxesRes, employeesRes] = await Promise.all([
        axios.get(`${API_URL}/boxes`),
        axios.get(`${API_URL}/employees`),
      ]);
      setBoxes(boxesRes.data.filter((b) => b.is_active));
      setEmployees(employeesRes.data);
      setLoading(false);


      if (boxesRes.data.length > 0) {
        loadSchedules();
      }
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const start = formatDate(startDate);
      const end = formatDate(addDays(startDate, 6));

      const response = await axios.get(`${API_URL}/box-schedules`, {
        params: { start_date: start, end_date: end },
      });
      setSchedules(response.data);
    } catch (error) {
      console.error("Ошибка загрузки расписания:", error);
    }
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDatesArray = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {

      dates.push(addDays(startDate, i));
    }
    return dates;
  };

  const getScheduleForBoxAndDate = (boxId, date) => {
    const dateStr = formatDate(date);
    return schedules.filter((s) => s.box_id === boxId && s.date === dateStr);
  };

  const handleCellClick = (boxId, date, e) => {
    const dateStr = formatDate(date);


    if (e.ctrlKey || e.metaKey) {
      const isSelected = selectedCells.some(
        (c) => c.boxId === boxId && c.date === dateStr,
      );

      if (isSelected) {

        setSelectedCells(
          selectedCells.filter(
            (c) => !(c.boxId === boxId && c.date === dateStr),
          ),
        );
      } else {

        if (selectedCells.length > 0 && selectedCells[0].boxId !== boxId) {
          alert(
            "Можно выбирать ячейки только одного бокса.\nСотрудник не может работать одновременно в нескольких боксах.",
          );
          return;
        }

        setSelectedCells([...selectedCells, { boxId, date: dateStr }]);
      }
      return;
    }


    const box = boxes.find((b) => b.id === boxId);
    setShiftsModalBox(box);
    setShiftsModalDate(dateStr);
    setShowShiftsModal(true);
  };

  const handleClearCell = async (scheduleId) => {
    if (window.confirm("Убрать назначение сотрудника?")) {
      try {
        await axios.delete(`${API_URL}/box-schedules/${scheduleId}`);
        loadSchedules();
      } catch (error) {
        console.error("Ошибка удаления назначения:", error);
      }
    }
  };

  const goToPreviousWeek = () => {
    setStartDate(addDays(startDate, -7));
  };

  const goToNextWeek = () => {
    setStartDate(addDays(startDate, 7));
  };

  const goToToday = () => {

    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = addDays(today, daysToMonday);
    setStartDate(monday);
  };

  const formatDateHeader = (date) => {
    const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const months = [
      "янв",
      "фев",
      "мар",
      "апр",
      "май",
      "июн",
      "июл",
      "авг",
      "сен",
      "окт",
      "ноя",
      "дек",
    ];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  const dates = getDatesArray();
  const canEdit = hasPermission("can_edit_box_schedule");

  return (
    <div className="box-schedule-container">
      <h2 className="page-title">Расписание сотрудников на боксах (неделя)</h2>


      <div className="schedule-navigation">
        <button className="btn btn-secondary" onClick={goToPreviousWeek}>
          ← Предыдущая неделя
        </button>
        <button className="btn btn-primary" onClick={goToToday}>
          Сегодня
        </button>
        <button className="btn btn-secondary" onClick={goToNextWeek}>
          Следующая неделя →
        </button>
      </div>


      <div className="schedule-table-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="box-column">Бокс</th>
              {dates.map((date, index) => (
                <th
                  key={index}
                  className={`date-column ${isToday(date) ? "today" : ""} ${isPast(date) ? "past" : ""}`}
                >
                  {formatDateHeader(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => (
              <tr key={box.id}>
                <td className="box-name">{box.name}</td>
                {dates.map((date, index) => {
                  const scheduleList = getScheduleForBoxAndDate(box.id, date);
                  const past = isPast(date);
                  const dateStr = formatDate(date);
                  const isSelected = selectedCells.some(
                    (c) => c.boxId === box.id && c.date === dateStr,
                  );

                  return (
                    <td
                      key={index}
                      className={`schedule-cell ${past ? "past" : ""} ${isToday(date) ? "today" : ""} ${isSelected ? "selected" : ""}`}
                      onClick={(e) =>
                        !past && canEdit && handleCellClick(box.id, date, e)
                      }
                      style={{
                        cursor: past || !canEdit ? "default" : "pointer",
                      }}
                      title={
                        !past && canEdit
                          ? "Клик - настройка смен | Ctrl+Клик - выбор нескольких"
                          : ""
                      }
                    >
                      {scheduleList.length > 0 ? (
                        <div className="employee-assignments">
                          {scheduleList.map((schedule, idx) => (
                            <div
                              key={schedule.id}
                              className="employee-assignment"
                            >
                              <div className="employee-info">
                                <div className="employee-name">
                                  {formatShortName(schedule.employee_name)}
                                </div>
                                {schedule.start_time && schedule.end_time && (
                                  <div className="employee-time">
                                    {schedule.start_time} - {schedule.end_time}
                                  </div>
                                )}
                              </div>
                              {!past && canEdit && (
                                <button
                                  className="clear-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearCell(schedule.id);
                                  }}
                                  title="Удалить смену"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        !past &&
                        canEdit && (
                          <div className="empty-cell">
                            <div>Нажмите для настройки смен</div>
                          </div>
                        )
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {boxes.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>
            Нет активных боксов
          </div>
          <div style={{ color: "#7f8c8d" }}>
            Создайте боксы в разделе "Настройки"
          </div>
        </div>
      )}

      {employees.length === 0 && boxes.length > 0 && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "2rem",
            marginTop: "2rem",
            background: "#fff3cd",
          }}
        >
          <div style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            Нет сотрудников
          </div>
          <div style={{ color: "#856404" }}>
            Добавьте сотрудников в разделе "Сотрудники"
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: "2rem" }}>
        <h3>Инструкция</h3>
        <ul style={{ marginTop: "1rem", color: "#7f8c8d", lineHeight: "1.8" }}>
          <li>
            Таблица показывает текущую неделю (7 дней, начиная с понедельника)
          </li>
          <li>
            Используйте кнопки "← Предыдущая неделя" / "Следующая неделя →" для
            навигации
          </li>
          <li>Кнопка "Сегодня" возвращает к текущей неделе</li>
          <li>Сегодняшний день выделен слегка желтым цветом</li>
          <li>
            <strong>Обычный клик</strong> на ячейку - открыть окно настройки
            смен для одной даты
          </li>
          <li>
            <strong>Ctrl+Клик (Cmd+Клик на Mac)</strong> - выбрать несколько дат{" "}
            <strong>одного бокса</strong> для массового назначения
          </li>
          <li>
            Важно: Можно выбирать только ячейки одного бокса (сотрудник не может
            работать одновременно в нескольких боксах)
          </li>
          <li>
            После выбора нескольких ячеек нажмите "Настроить смены для выбранных
            дат"
          </li>
          <li>Настроенные смены будут применены ко всем выбранным датам</li>
          <li>Нажмите "×" на смене чтобы удалить её</li>
          <li>Прошедшие даты нельзя редактировать (серые)</li>
        </ul>
      </div>

      <DayShiftsModal
        isOpen={showShiftsModal}
        onClose={() => setShowShiftsModal(false)}
        onSuccess={() => {
          loadSchedules();
          setShowShiftsModal(false);
          setSelectedCells([]);
        }}
        selectedDate={shiftsModalDate}
        selectedBox={shiftsModalBox}
        employees={employees}
        selectedCells={selectedCells}
      />


      {selectedCells.length > 0 && canEdit && (
        <div className="fixed-selection-panel">
          <div className="selection-panel-content">
            <div className="selection-info">
              <span className="selection-badge">{selectedCells.length}</span>
              <span className="selection-text">
                {selectedCells.length === 1
                  ? "ячейка выбрана"
                  : selectedCells.length < 5
                    ? "ячейки выбраны"
                    : "ячеек выбрано"}
              </span>
            </div>
            <div className="selection-actions">
              <button
                className="btn btn-primary"
                onClick={() => {

                  const firstCell = selectedCells[0];
                  const box = boxes.find((b) => b.id === firstCell.boxId);
                  setShiftsModalBox(box);
                  setShiftsModalDate(firstCell.date);
                  setShowShiftsModal(true);
                }}
              >
                Настроить смены
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedCells([])}
              >
                Отменить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BoxSchedule;
