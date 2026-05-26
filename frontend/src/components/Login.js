import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { saveAuth } from "../auth";
import "./Login.css";

const API_URL = "http://localhost:5000/api";

function Login() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        login,
        password,
      });
      saveAuth(res.data.token, res.data.user);
      navigate("/schedule");
    } catch (err) {
      setError(err.response?.data?.error || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="Logo" className="login-logo-image" />
        </div>
        <h2>Вход в систему</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Логин</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoFocus
              placeholder="admin"
            />
          </div>

          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <button onClick={() => navigate("/")} className="login-back-btn">
          ← Назад
        </button>
      </div>
    </div>
  );
}

export default Login;
