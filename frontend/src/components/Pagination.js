import React from 'react';
import './Pagination.css';

/**
 * Универсальный компонент пагинации для таблиц.
 * 
 * Props:
 * - currentPage (number): текущая страница (1-indexed)
 * - totalItems (number): общее количество элементов
 * - pageSize (number): размер страницы (по умолчанию 20)
 * - onPageChange (function): колбэк при смене страницы
 */
function Pagination({ currentPage, totalItems, pageSize = 20, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  if (totalItems === 0) return null;
  
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  
  const goToPage = (page) => {
    const target = Math.max(1, Math.min(totalPages, page));
    if (target !== currentPage) onPageChange(target);
  };
  
  // Генерация номеров страниц с многоточиями
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2; // сколько страниц показывать вокруг текущей
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    
    pages.push(1);
    
    if (currentPage - delta > 2) pages.push('...');
    
    const start = Math.max(2, currentPage - delta);
    const end = Math.min(totalPages - 1, currentPage + delta);
    for (let i = start; i <= end; i++) pages.push(i);
    
    if (currentPage + delta < totalPages - 1) pages.push('...');
    
    pages.push(totalPages);
    return pages;
  };
  
  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Показано {startItem}–{endItem} из {totalItems}
      </div>
      <div className="pagination-controls">
        <button 
          className="pagination-btn"
          onClick={() => goToPage(1)}
          disabled={currentPage === 1}
          title="Первая страница"
        >
          «
        </button>
        <button 
          className="pagination-btn"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← Назад
        </button>
        
        {getPageNumbers().map((page, idx) => (
          page === '...' ? (
            <span key={`dots-${idx}`} className="pagination-dots">…</span>
          ) : (
            <button
              key={page}
              className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
              onClick={() => goToPage(page)}
            >
              {page}
            </button>
          )
        ))}
        
        <button 
          className="pagination-btn"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Вперёд →
        </button>
        <button 
          className="pagination-btn"
          onClick={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          title="Последняя страница"
        >
          »
        </button>
      </div>
    </div>
  );
}

export default Pagination;
