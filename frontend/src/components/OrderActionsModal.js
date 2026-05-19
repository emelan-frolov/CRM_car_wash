import React, { useState } from 'react';
import './OrderActionsModal.css';

function OrderActionsModal({ order, isOpen, onClose, onComplete, onCancel, onDelete }) {
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);

  if (!isOpen || !order) return null;

  const handleCompleteClick = () => {
    setShowPaymentConfirm(true);
  };

  const handlePaymentResponse = (isPaid) => {
    onComplete(order.id, isPaid);
    setShowPaymentConfirm(false);
    onClose();
  };

  const handleCancelClick = () => {
    if (window.confirm(`Вы уверены что хотите отменить заказ для ${order.client_name}?`)) {
      onCancel(order.id);
      onClose();
    }
  };

  const handleDeleteClick = () => {
    if (window.confirm(`ВНИМАНИЕ! Вы действительно хотите УДАЛИТЬ заказ для ${order.client_name}?\n\nЭто действие нельзя отменить!`)) {
      onDelete(order.id);
      onClose();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content order-actions-modal">
        <div className="modal-header">
          <h2>Управление заказом</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="order-info">
            <h3>Информация о заказе</h3>
            <p><strong>Клиент:</strong> {order.client_name}</p>
            <p><strong>Телефон:</strong> {order.client_phone}</p>
            <p><strong>Автомобиль:</strong> {order.car_license_plate} {order.car_info}</p>
            <p><strong>Услуги:</strong> {order.service_names}</p>
            <p><strong>Стоимость:</strong> {order.total_price}₽</p>
            <p><strong>Бокс:</strong> {order.box_name}</p>
            <p><strong>Статус:</strong> {
              order.status === 'pending' ? 'Ожидает' :
              order.status === 'in_progress' ? 'В работе' :
              order.status === 'completed' ? 'Завершен' : 'Отменен'
            }</p>
          </div>

          {!showPaymentConfirm ? (
            <div className="action-buttons">
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <>
                  <button 
                    className="btn btn-success btn-large"
                    onClick={handleCompleteClick}
                  >
                    ✓ Завершить заказ
                  </button>
                  <button 
                    className="btn btn-danger btn-large"
                    onClick={handleCancelClick}
                  >
                    ✗ Отменить заказ
                  </button>
                </>
              )}
              {(order.status === 'completed' || order.status === 'cancelled') && (
                <p className="order-finished-message">
                  Заказ уже {order.status === 'completed' ? 'завершен' : 'отменен'}
                </p>
              )}
              
              {/* Кнопка удаления всегда доступна */}
              <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
                <button 
                  className="btn btn-danger btn-large"
                  onClick={handleDeleteClick}
                  style={{ width: '100%', backgroundColor: '#c0392b' }}
                >
                  🗑️ Удалить заказ навсегда
                </button>
                <p style={{ fontSize: '0.85rem', color: '#7f8c8d', marginTop: '0.5rem', textAlign: 'center' }}>
                  Это действие нельзя отменить
                </p>
              </div>
            </div>
          ) : (
            <div className="payment-confirm">
              <h3>Заказ оплачен?</h3>
              <p>Укажите был ли оплачен заказ для учета выручки</p>
              <div className="payment-buttons">
                <button 
                  className="btn btn-success btn-large"
                  onClick={() => handlePaymentResponse(true)}
                >
                  ✓ Да, оплачен
                </button>
                <button 
                  className="btn btn-danger btn-large"
                  onClick={() => handlePaymentResponse(false)}
                >
                  ✗ Нет, не оплачен
                </button>
              </div>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowPaymentConfirm(false)}
                style={{ marginTop: '1rem' }}
              >
                Назад
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderActionsModal;
