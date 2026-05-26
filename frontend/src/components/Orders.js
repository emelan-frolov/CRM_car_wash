import React, { useState, useEffect } from "react";
import axios from "axios";
import Pagination from "./Pagination";
import "./Orders.css";
import { hasPermission } from "../auth";

const API_URL = process.env.REACT_APP_API_URL || "/api";


const formatPhoneNumber = (value) => {
  if (!value) return "-";
  const cleaned = value.replace(/\D/g, "");
  const limited = cleaned.slice(0, 11);

  if (limited.length === 0) return "-";
  if (limited.length <= 1) return limited;
  if (limited.length <= 4) return `${limited[0]} (${limited.slice(1)}`;
  if (limited.length <= 7)
    return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4)}`;
  if (limited.length <= 9)
    return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7)}`;
  return `${limited[0]} (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7, 9)}-${limited.slice(9, 11)}`;
};

function Orders() {
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [boxes, setBoxes] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchName, setSearchName] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportJobId, setExportJobId] = useState(null);
  const [exportFileHandle, setExportFileHandle] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriod, setExportPeriod] = useState({
    start_date: "",
    end_date: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [formData, setFormData] = useState({
    client_id: "",
    service_id: "",
    box_id: "",
    scheduled_time: "",
    notes: "",
  });


  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, searchPhone]);


  useEffect(() => {
    const timer = setTimeout(
      () => {
        loadOrders();
      },
      searchName || searchPhone ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [currentPage, searchName, searchPhone]);


  useEffect(() => {
    loadAuxData();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/orders`, {
        params: {
          page: currentPage,
          page_size: PAGE_SIZE,
          search_name: searchName,
          search_phone: searchPhone,
        },
      });
      setOrders(response.data.items || []);
      setTotalOrders(response.data.total || 0);
      setLoading(false);
    } catch (error) {
      console.error("Ошибка загрузки заказов:", error);
      setLoading(false);
    }
  };

  const loadAuxData = async () => {
    try {
      const [clientsRes, servicesRes, boxesRes] = await Promise.all([
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/services`),
        axios.get(`${API_URL}/boxes`),
      ]);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setBoxes(boxesRes.data.filter((b) => b.is_active));
    } catch (error) {
      console.error("Ошибка загрузки справочников:", error);
    }
  };

  const loadData = () => loadOrders();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedService = services.find(
        (s) => s.id === parseInt(formData.service_id),
      );
      await axios.post(`${API_URL}/orders`, {
        ...formData,
        client_id: parseInt(formData.client_id),
        service_id: parseInt(formData.service_id),
        box_id: formData.box_id ? parseInt(formData.box_id) : null,
        total_price: selectedService?.price,
      });
      setFormData({
        client_id: "",
        service_id: "",
        box_id: "",
        scheduled_time: "",
        notes: "",
      });
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error("Ошибка создания заказа:", error);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`${API_URL}/orders/${orderId}`, {
        status: newStatus,
        completed_time:
          newStatus === "completed" ? new Date().toISOString() : null,
      });
      loadData();
    } catch (error) {
      console.error("Ошибка обновления статуса:", error);
    }
  };

  const handleDelete = async (id) => {
    if (
      window.confirm(
        "ВНИМАНИЕ! Вы действительно хотите УДАЛИТЬ этот заказ?\n\nЭто действие нельзя отменить!",
      )
    ) {
      try {
        await axios.delete(`${API_URL}/orders/${id}`);
        setSelectedOrder(null);
        loadData();
      } catch (error) {
        console.error("Ошибка удаления заказа:", error);
        alert("Не удалось удалить заказ");
      }
    }
  };

  const handleRowClick = (order) => {
    if (showForm) return;
    setSelectedOrder(selectedOrder?.id === order.id ? null : order);
  };


  useEffect(() => {
    const savedJobId = localStorage.getItem("export_job_id");
    if (savedJobId) {

      checkExportStatus(savedJobId, true);
    }
  }, []);


  useEffect(() => {
    if (!exportJobId || !exporting) return;

    const interval = setInterval(() => {
      checkExportStatus(exportJobId, false);
    }, 500);

    return () => clearInterval(interval);
  }, [exportJobId, exporting]);

  const checkExportStatus = async (jobId, isRestore) => {
    try {
      const res = await axios.get(`${API_URL}/orders/export/status/${jobId}`);
      const job = res.data;

      if (job.status === "completed") {
        setExportProgress(100);
        await downloadExportedFile(jobId, job.filename);
        clearExportState();
      } else if (job.status === "error") {
        alert("Ошибка экспорта: " + (job.error || "неизвестная ошибка"));
        clearExportState();
      } else if (job.status === "cancelled") {
        clearExportState();
      } else {

        if (isRestore) {
          setExporting(true);
          setExportJobId(jobId);
        }
        setExportProgress(job.progress || 0);
      }
    } catch (error) {
      if (error.response?.status === 404) {

        if (isRestore) {
          localStorage.removeItem("export_job_id");
        } else {
          alert("Задача экспорта потеряна. Запустите экспорт заново.");
          clearExportState();
        }
      }
    }
  };

  const downloadExportedFile = async (jobId, filename) => {
    try {
      const response = await axios.get(
        `${API_URL}/orders/export/download/${jobId}`,
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });


      if (exportFileHandle) {
        const writable = await exportFileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Ошибка скачивания:", error);
      alert("Не удалось скачать файл");
    }
  };

  const clearExportState = () => {
    localStorage.removeItem("export_job_id");
    setExportJobId(null);
    setExportFileHandle(null);
    setTimeout(() => {
      setExporting(false);
      setExportProgress(0);
    }, 400);
  };

  const handleExport = async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    let defaultFilename = `orders_export_${todayStr}.xlsx`;
    if (exportPeriod.start_date && exportPeriod.end_date) {
      defaultFilename = `orders_${exportPeriod.start_date}_${exportPeriod.end_date}.xlsx`;
    } else if (exportPeriod.start_date) {
      defaultFilename = `orders_from_${exportPeriod.start_date}.xlsx`;
    } else if (exportPeriod.end_date) {
      defaultFilename = `orders_to_${exportPeriod.end_date}.xlsx`;
    }

    let fileHandle = null;
    const supportsFileSystemAccess = "showSaveFilePicker" in window;

    if (supportsFileSystemAccess) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [
            {
              description: "Excel файл",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                  [".xlsx"],
              },
            },
          ],
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        fileHandle = null;
      }
    }

    setExportFileHandle(fileHandle);
    setExporting(true);
    setExportProgress(0);
    setShowExportModal(false);

    try {
      const body = {};
      if (exportPeriod.start_date) body.start_date = exportPeriod.start_date;
      if (exportPeriod.end_date) body.end_date = exportPeriod.end_date;

      const res = await axios.post(`${API_URL}/orders/export/start`, body);
      const jobId = res.data.job_id;


      localStorage.setItem("export_job_id", jobId);
      setExportJobId(jobId);
    } catch (error) {
      console.error("Ошибка запуска экспорта:", error);
      alert("Не удалось запустить экспорт");
      clearExportState();
    }
  };


  const handleCancelExport = async () => {
    if (!exportJobId) return;
    try {
      await axios.post(`${API_URL}/orders/export/cancel/${exportJobId}`);
    } catch (e) {
      console.warn("Ошибка отмены:", e);
    }
    clearExportState();
  };


  const setPeriodPreset = (preset) => {
    const today = new Date();
    const formatDate = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (preset === "today") {
      const t = formatDate(today);
      setExportPeriod({ start_date: t, end_date: t });
    } else if (preset === "week") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setExportPeriod({
        start_date: formatDate(start),
        end_date: formatDate(today),
      });
    } else if (preset === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setExportPeriod({
        start_date: formatDate(start),
        end_date: formatDate(today),
      });
    } else if (preset === "year") {
      const start = new Date(today.getFullYear(), 0, 1);
      setExportPeriod({
        start_date: formatDate(start),
        end_date: formatDate(today),
      });
    } else if (preset === "all") {
      setExportPeriod({ start_date: "", end_date: "" });
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: {
        backgroundColor: "#f39c12",
        color: "white",
        padding: "0.25rem 0.75rem",
        borderRadius: "4px",
      },
      in_progress: {
        backgroundColor: "#3498db",
        color: "white",
        padding: "0.25rem 0.75rem",
        borderRadius: "4px",
      },
      completed: {
        backgroundColor: "#2ecc71",
        color: "white",
        padding: "0.25rem 0.75rem",
        borderRadius: "4px",
      },
      cancelled: {
        backgroundColor: "#e74c3c",
        color: "white",
        padding: "0.25rem 0.75rem",
        borderRadius: "4px",
      },
    };
    const labels = {
      pending: "Ожидает",
      in_progress: "В работе",
      completed: "Завершен",
      cancelled: "Отменен",
    };
    return <span style={styles[status]}>{labels[status]}</span>;
  };

  if (loading && orders.length === 0)
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
          Заказы
        </h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Поиск по ФИО клиента..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{
              padding: "0.6rem 1rem",
              fontSize: "0.95rem",
              border: "2px solid #ddd",
              borderRadius: "6px",
              width: "220px",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3498db")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          />
          <input
            type="text"
            placeholder="Поиск по телефону..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            style={{
              padding: "0.6rem 1rem",
              fontSize: "0.95rem",
              border: "2px solid #ddd",
              borderRadius: "6px",
              width: "200px",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3498db")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          />
          {selectedOrder && (
            <button
              className="btn btn-danger"
              onClick={() => handleDelete(selectedOrder.id)}
            >
               Удалить
            </button>
          )}
          {hasPermission("can_export_orders") && (
            <button
              className={`export-progress-btn ${exporting ? "exporting" : ""}`}
              onClick={() =>
                exporting ? handleCancelExport() : setShowExportModal(true)
              }
              disabled={!exporting && totalOrders === 0}
              style={{
                "--progress": `${exportProgress}%`,
              }}
            >
              <span className="export-btn-content">
                {exporting
                  ? ` Отменить (${Math.round(exportProgress)}%)`
                  : "Экспорт в Excel"}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="card orders-card">
        {totalOrders === 0 && !searchName && !searchPhone ? (
          <p>Заказов пока нет. Создайте первый!</p>
        ) : (
          <>
            <div className="orders-table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th className="orders-phone-cell">Телефон</th>
                  <th>Гос. номер</th>
                  <th>Авто</th>
                  <th>Услуги</th>
                  <th>Бокс</th>
                  <th>Сотрудник</th>
                  <th>Статус</th>
                  <th>Время записи</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleRowClick(order)}
                      style={{
                        cursor: showForm ? "default" : "pointer",
                        backgroundColor:
                          selectedOrder?.id === order.id
                            ? "#e3f2fd"
                            : "transparent",
                        transition: "background-color 0.2s",
                      }}
                    >
                      <td>{order.client_name}</td>
                      <td className="orders-phone-cell">
                        {formatPhoneNumber(order.client_phone)}
                      </td>
                      <td>{order.car_license_plate || "-"}</td>
                      <td>{order.car_info || "-"}</td>
                      <td>{order.service_names}</td>
                      <td>{order.box_name || "-"}</td>
                      <td>{order.employee_name || "-"}</td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td>
                        {order.scheduled_time
                          ? new Date(order.scheduled_time).toLocaleString(
                              "ru-RU",
                            )
                          : "-"}
                      </td>
                      <td>{order.total_price} ₽</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={totalOrders}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>


      {showExportModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <div className="modal-header">
              <h2>Экспорт заказов в Excel</h2>
              <button
                className="modal-close"
                onClick={() => setShowExportModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: "#7f8c8d", marginBottom: "1rem" }}>
                Выберите период по дате создания заказа
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "1.5rem",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPeriodPreset("today")}
                >
                  Сегодня
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPeriodPreset("week")}
                >
                  Неделя
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPeriodPreset("month")}
                >
                  Месяц
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPeriodPreset("year")}
                >
                  Год
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPeriodPreset("all")}
                >
                  За всё время
                </button>
              </div>

              <div className="form-group">
                <label>Дата с</label>
                <input
                  type="date"
                  value={exportPeriod.start_date}
                  onChange={(e) =>
                    setExportPeriod({
                      ...exportPeriod,
                      start_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Дата по</label>
                <input
                  type="date"
                  value={exportPeriod.end_date}
                  onChange={(e) =>
                    setExportPeriod({
                      ...exportPeriod,
                      end_date: e.target.value,
                    })
                  }
                />
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
                Если оставить поля пустыми - будут экспортированы все заказы
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowExportModal(false)}
              >
                Отмена
              </button>
              <button
                className="btn"
                style={{ backgroundColor: "#27ae60", color: "white" }}
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Экспортируется..." : "Экспортировать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;
