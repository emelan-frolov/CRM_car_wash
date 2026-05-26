import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import "./auth";
import {
  isAuthenticated,
  isOwner,
  getUser,
  clearAuth,
  hasPermission,
} from "./auth";
import Clients from "./components/Clients";
import Cars from "./components/Cars";
import Services from "./components/Services";
import Orders from "./components/Orders";
import Dashboard from "./components/Dashboard";
import Schedule from "./components/Schedule";
import Settings from "./components/Settings";
import Positions from "./components/Positions";
import Employees from "./components/Employees";
import Booking from "./components/Booking";
import BoxSchedule from "./components/BoxSchedule";
import Statistics from "./components/Statistics";
import Login from "./components/Login";
import UsersAdmin from "./components/UsersAdmin";
import AdminSchedule from "./components/AdminSchedule";
import PublicOccupancy from "./components/PublicOccupancy";
import PublicBooking from "./components/PublicBooking";


function PrivateRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}


function OwnerRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!isOwner()) {
    return <Navigate to="/" replace />;
  }
  return children;
}


function PermissionRoute({ permission, children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  return children;
}


function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  if (location.pathname === "/login") {
    return children;
  }

  const isPublicPage =
    location.pathname === "/" || location.pathname === "/book";
  if (isPublicPage) {
    return (
      <>
        <nav className="navbar">
          <div className="nav-container">
            <div className="logo-placeholder">
              <img src="/logo.png" alt="Logo" className="logo-image" />
            </div>
            <div className="nav-menu-wrapper">
              <ul className="nav-menu nav-menu-row nav-menu-bottom">
                <li>
                  <Link to="/">Загруженность</Link>
                </li>
                <li>
                  <Link to="/book">Записаться</Link>
                </li>
              </ul>
            </div>
            <div className="nav-user-block">
              <Link
                to="/login"
                className="nav-logout-btn"
                style={{ textDecoration: "none" }}
              >
                Для персонала
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </>
    );
  }

  const handleLogout = () => {
    if (window.confirm("Выйти из системы?")) {
      clearAuth();
      navigate("/login");
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo-placeholder">
            <img src="/logo.png" alt="Logo" className="logo-image" />
          </div>

          <div className="nav-menu-wrapper">
            <ul className="nav-menu nav-menu-row nav-menu-bottom">
              <li>
                <Link to="/schedule">Главная</Link>
              </li>
              <li>
                <Link to="/booking">Запись</Link>
              </li>
              <li className="nav-dropdown">
                <span className="nav-dropdown-trigger">Таблицы</span>
                <ul className="nav-dropdown-menu">
                  <li>
                    <Link to="/clients">Клиенты</Link>
                  </li>
                  <li>
                    <Link to="/cars">Автомобили</Link>
                  </li>
                  {hasPermission("can_view_services") && (
                    <li>
                      <Link to="/services">Услуги</Link>
                    </li>
                  )}
                  <li>
                    <Link to="/orders">Заказы</Link>
                  </li>
                  {hasPermission("can_view_positions") && (
                    <li>
                      <Link to="/positions">Должности</Link>
                    </li>
                  )}
                  {hasPermission("can_view_employees") && (
                    <li>
                      <Link to="/employees">Сотрудники</Link>
                    </li>
                  )}
                </ul>
              </li>
              {hasPermission("can_view_box_schedule") && (
                <li>
                  <Link to="/box-schedule">Расписание боксов</Link>
                </li>
              )}
              {hasPermission("can_view_statistics") && (
                <li>
                  <Link to="/statistics">Статистика</Link>
                </li>
              )}
              {(user?.role === "owner" ||
                (user?.role === "admin" &&
                  hasPermission("can_view_admin_schedule"))) && (
                <li>
                  <Link to="/admin-schedule">Смены админов</Link>
                </li>
              )}
              {user?.role === "owner" && (
                <li>
                  <Link to="/users-admin">Администраторы</Link>
                </li>
              )}
              <li>
                <Link to="/settings">Настройки</Link>
              </li>
            </ul>
          </div>

          <div className="nav-user-block">
            {user && (
              <div className="nav-user-info">
                <div className="nav-user-name">
                  {user.full_name.split(" ")[0]}{" "}
                  {user.full_name
                    .split(" ")
                    .slice(1)
                    .map((n) => n[0] + ".")
                    .join("")}
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="nav-logout-btn"
              title="Выйти"
            >
              Выход
            </button>
          </div>
        </div>
      </nav>
      {children}
    </>
  );
}

function App() {


  useEffect(() => {
    if (!isAuthenticated()) return;

    const refreshUser = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/auth/me", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        });
        if (res.ok) {
          const user = await res.json();
          localStorage.setItem("auth_user", JSON.stringify(user));
        }
      } catch (e) {

      }
    };

    refreshUser();
    const id = setInterval(refreshUser, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <Router>
      <div className="App">
        <AppShell>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PublicOccupancy />} />
            <Route
              path="/book"
              element={
                <main className="main-content">
                  <PublicBooking />
                </main>
              }
            />
            <Route
              path="/schedule"
              element={
                <PrivateRoute>
                  <Schedule />
                </PrivateRoute>
              }
            />
            <Route
              path="/booking"
              element={
                <PrivateRoute>
                  <main className="main-content">
                    <Booking />
                  </main>
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <PrivateRoute>
                  <main className="main-content">
                    <Clients />
                  </main>
                </PrivateRoute>
              }
            />
            <Route
              path="/cars"
              element={
                <PrivateRoute>
                  <main className="main-content">
                    <Cars />
                  </main>
                </PrivateRoute>
              }
            />
            <Route
              path="/services"
              element={
                <PermissionRoute permission="can_view_services">
                  <main className="main-content">
                    <Services />
                  </main>
                </PermissionRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <PrivateRoute>
                  <main className="main-content">
                    <Orders />
                  </main>
                </PrivateRoute>
              }
            />
            <Route
              path="/positions"
              element={
                <PermissionRoute permission="can_view_positions">
                  <main className="main-content">
                    <Positions />
                  </main>
                </PermissionRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <PermissionRoute permission="can_view_employees">
                  <main className="main-content">
                    <Employees />
                  </main>
                </PermissionRoute>
              }
            />
            <Route
              path="/box-schedule"
              element={
                <PermissionRoute permission="can_view_box_schedule">
                  <main className="main-content">
                    <BoxSchedule />
                  </main>
                </PermissionRoute>
              }
            />
            <Route
              path="/statistics"
              element={
                <PermissionRoute permission="can_view_statistics">
                  <main className="main-content">
                    <Statistics />
                  </main>
                </PermissionRoute>
              }
            />
            <Route
              path="/users-admin"
              element={
                <OwnerRoute>
                  <main className="main-content">
                    <UsersAdmin />
                  </main>
                </OwnerRoute>
              }
            />
            <Route
              path="/admin-schedule"
              element={
                <PermissionRoute permission="can_view_admin_schedule">
                  <main className="main-content">
                    <AdminSchedule />
                  </main>
                </PermissionRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <main className="main-content">
                    <Settings />
                  </main>
                </PrivateRoute>
              }
            />
          </Routes>
        </AppShell>
      </div>
    </Router>
  );
}

export default App;
