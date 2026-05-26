import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Новый пароль должен быть не короче 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (currentPassword === newPassword) {
      setError('Новый пароль должен отличаться от текущего');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка смены пароля');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h2> Смена пароля</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {success ? (
              <div style={{
                padding: '1rem',
                background: '#d4edda',
                color: '#155724',
                borderRadius: '6px',
                textAlign: 'center',
                fontSize: '0.95rem',
                fontWeight: 600
              }}>
                 Пароль успешно изменён
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Текущий пароль *</label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label>Новый пароль *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="минимум 6 символов"
                  />
                </div>

                <div className="form-group">
                  <label>Подтверждение нового пароля *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="повторите новый пароль"
                  />
                </div>

                {error && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#fee',
                    color: '#c0392b',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    borderLeft: '3px solid #e74c3c'
                  }}>
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
          {!success && (
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                Отмена
              </button>
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сменить пароль'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordModal;
