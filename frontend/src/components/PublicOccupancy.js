import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Schedule.css";

const API_URL = process.env.REACT_APP_API_URL || "/api";

function PublicOccupancy() {
  const [boxes, setBoxes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [boxSchedules, setBoxSchedules] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, 30000);
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const [boxesRes, ordersRes, schedulesRes] = await Promise.all([
        axios.get(`${API_URL}/boxes`),
        axios.get(`${API_URL}/orders/schedule`),
        axios.get(`${API_URL}/box-schedules`, {
          params: { start_date: todayStr, end_date: todayStr },
        }),
      ]);
      setBoxes(boxesRes.data.filter((b) => b.is_active));
      setOrders(ordersRes.data);
      setBoxSchedules(schedulesRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Ошибка загрузки:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const currentHourKey = `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()}-${currentTime.getHours()}`;
  const timeSlots = useMemo(() => {
    const slots = [];
    const now = new Date();
    const workStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      10,
      0,
      0,
      0,
    );
    const workEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      22,
      0,
      0,
      0,
    );
    let startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    startTime.setMinutes(0, 0, 0);
    let endTime = new Date(startTime.getTime() + 6 * 60 * 60 * 1000);
    if (startTime < workStart) startTime = new Date(workStart);
    if (endTime > workEnd) endTime = new Date(workEnd);
    const desired = 6 * 60 * 60 * 1000;
    if (endTime - startTime < desired) {
      const ns = new Date(endTime.getTime() - desired);
      if (ns >= workStart) startTime = ns;
    }
    if (endTime - startTime < desired) {
      const ne = new Date(startTime.getTime() + desired);
      if (ne <= workEnd) endTime = ne;
    }
    const count = Math.floor((endTime - startTime) / (15 * 60 * 1000));
    for (let i = 0; i < count; i++) {
      slots.push(new Date(startTime.getTime() + i * 15 * 60 * 1000));
    }
    return slots;
  }, [currentHourKey]);

  const formatTimeSlot = (date) => {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    return m === "00" ? h : m;
  };

  const getEmployeeForBox = (boxId) => {
    const s = boxSchedules.find((s) => s.box_id === boxId);
    return s ? s.employee_name : null;
  };

  const isHourStart = (date) => date.getMinutes() === 0;

  const getOrderPosition = (order) => {
    if (!order.scheduled_time || !order.service_duration) return null;
    const orderStart = new Date(order.scheduled_time);
    const orderEnd = new Date(
      orderStart.getTime() + order.service_duration * 60 * 1000,
    );
    const schedStart = timeSlots[0];
    const schedEnd = new Date(
      timeSlots[timeSlots.length - 1].getTime() + 15 * 60 * 1000,
    );
    if (orderEnd <= schedStart || orderStart >= schedEnd) return null;
    const visStart = orderStart < schedStart ? schedStart : orderStart;
    const visEnd = orderEnd > schedEnd ? schedEnd : orderEnd;
    const total = timeSlots.length;
    const startMin = (visStart - schedStart) / 60000;
    const endMin = (visEnd - schedStart) / 60000;
    const startIdx = Math.floor(startMin / 15);
    const endIdx = Math.ceil(endMin / 15);
    const pct = 100 / total;
    return {
      left: `${startIdx * pct}%`,
      width: `${(endIdx - startIdx) * pct}%`,
    };
  };

  const getOrderProgress = (order) => {
    if (
      order.status !== "in_progress" ||
      !order.scheduled_time ||
      !order.service_duration
    )
      return 0;
    const start = new Date(order.scheduled_time);
    const end = new Date(start.getTime() + order.service_duration * 60 * 1000);
    const now = currentTime;
    if (now < start) return 0;
    if (now > end) return 100;
    return ((now - start) / (end - start)) * 100;
  };

  const getOrderColor = (order) => {
    switch (order.status) {
      case "pending":
        return "#f39c12";
      case "in_progress":
        return "#3498db";
      case "completed":
        return "#2ecc71";
      default:
        return "#95a5a6";
    }
  };

  const isCurrentTime = (time) => {
    const next = new Date(time.getTime() + 15 * 60 * 1000);
    return currentTime > time && currentTime <= next;
  };

  const getCurrentTimePosition = () => {
    if (!timeSlots.length) return null;
    const schedStart = timeSlots[0];
    const schedEnd = new Date(
      timeSlots[timeSlots.length - 1].getTime() + 15 * 60 * 1000,
    );
    const now = currentTime;
    if (now < schedStart || now > schedEnd) return null;
    const pct = 100 / timeSlots.length;
    return `${((now - schedStart) / 60000 / 15) * pct}%`;
  };

  if (loading)
    return (
      <div className="loading" style={{ padding: "3rem", textAlign: "center" }}>
        <div>Загрузка расписания...</div>
      </div>
    );

  if (error)
    return (
      <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ color: "#e74c3c", marginBottom: "1rem" }}>
          Ошибка загрузки данных
        </div>
        <button className="btn btn-primary" onClick={loadData}>
          Попробовать снова
        </button>
      </div>
    );

  return (
    <div className="schedule-container">
      <div className="schedule-header-section" style={{ padding: "0.75rem 0" }}>
        <div className="schedule-legend">
          <div className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: "#f39c12" }}
            ></span>
            <span>Ожидает</span>
          </div>
          <div className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: "#3498db" }}
            ></span>
            <span>В работе</span>
          </div>
          <div className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: "#2ecc71" }}
            ></span>
            <span>Завершён</span>
          </div>
        </div>
      </div>

      {boxes.length === 0 ? (
        <div className="card empty-schedule">
          <div className="empty-schedule-text">Боксы не настроены</div>
        </div>
      ) : (
        <div
          className="schedule-wrapper"
          style={{ overflowX: "auto", marginTop: "0.75rem" }}
        >
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="box-header-cell">Боксы</th>
                <th className="timeline-header-cell">
                  <div className="timeline-slots">
                    {timeSlots.map((time, idx) => {
                      const next =
                        idx < timeSlots.length - 1 ? timeSlots[idx + 1] : null;
                      return (
                        <div key={idx} className="timeline-slot-wrapper">
                          <div
                            className={`time-slot ${isHourStart(time) ? "hour-mark" : ""}`}
                          >
                            {formatTimeSlot(time)}
                          </div>
                          {next && isCurrentTime(time) && (
                            <div className="timeline-slot-highlight"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {boxes.map((box) => {
                const boxOrders = orders.filter((o) => o.box_id === box.id);
                const employeeName = getEmployeeForBox(box.id);
                return (
                  <tr key={box.id}>
                    <td className="box-name-cell">
                      <div className="box-name">{box.name}</div>
                      {employeeName && (
                        <div className="box-employee">{employeeName}</div>
                      )}
                    </td>
                    <td className="timeline-cell">
                      <div className="timeline-grid">
                        {timeSlots.map((time, idx) => (
                          <div key={idx} className="grid-slot-wrapper">
                            <div
                              className={`grid-slot ${isHourStart(time) ? "hour-mark" : ""}`}
                            ></div>
                          </div>
                        ))}

                        {boxOrders.map((order) => {
                          const pos = getOrderPosition(order);
                          if (!pos) return null;
                          const progress = getOrderProgress(order);
                          const color = getOrderColor(order);

                          const label = order.service_names
                            ? order.service_names.split(",")[0].trim()
                            : "";
                          return (
                            <div
                              key={order.id}
                              className="order-card"
                              style={{
                                left: pos.left,
                                width: pos.width,
                                backgroundColor: color,
                                cursor: "default",
                              }}
                              title={label}
                            >
                              {order.status === "in_progress" && (
                                <div
                                  className="order-card-progress"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              )}
                              <div className="order-card-content">
                                <div
                                  className="order-plate"
                                  style={{ fontSize: "0.7rem", opacity: 0.9 }}
                                >
                                  {label}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {getCurrentTimePosition() && (
                          <div
                            className="current-time-line"
                            style={{ left: getCurrentTimePosition() }}
                          ></div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PublicOccupancy;
