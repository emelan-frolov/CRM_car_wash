import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const fmt = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 1) return d;
  if (d.length <= 4) return `${d[0]} (${d.slice(1)}`;
  if (d.length <= 7) return `${d[0]} (${d.slice(1,4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `${d[0]} (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return `${d[0]} (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9,11)}`;
};

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WDAYS  = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

function PublicBooking() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=услуги 2=данные 3=дата+время 4=успех
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState([]);   // ids
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [dates, setDates]   = useState([]);        // 14 дней вперёд
  const [chosenDate, setChosenDate] = useState(null);
  const [slots, setSlots]   = useState([]);
  const [chosenSlot, setChosenSlot] = useState(null); // {time, box_id, box_name}
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    try {
      const r = await api.get(`/services`);
      const list = Array.isArray(r.data) ? r.data : (r.data.items || []);
      setServices(list.filter(s => s.is_active !== false));
    } catch (e) { console.error(e); }
  };

  const toggle = (id) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const totalDur = () => selected.reduce((s, id) => {
    const svc = services.find(x => x.id === id); return s + (svc?.duration || 0);
  }, 0);

  const totalPrice = () => selected.reduce((s, id) => {
    const svc = services.find(x => x.id === id); return s + (svc?.price || 0);
  }, 0);

  const buildDates = () => {
    const arr = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i); d.setHours(0,0,0,0);
      arr.push(d);
    }
    return arr;
  };

  const loadSlots = async (dateStr) => {
    setLoading(true); setSlots([]); setChosenSlot(null); setError('');
    try {
      const dur = totalDur();
      if (dur === 0) { setError('У выбранных услуг не указана длительность'); setLoading(false); return; }
      const r = await api.post(`/booking/timeslots`, { date: dateStr, total_duration: dur });
      setSlots(r.data.available_slots || []);
      if ((r.data.available_slots || []).length === 0) setError('На эту дату нет свободного времени');
    } catch (e) { setError('Ошибка загрузки слотов'); }
    setLoading(false);
  };

  const onDateClick = (d) => {
    const str = d.toISOString().split('T')[0];
    setChosenDate(str);
    setChosenSlot(null);
    loadSlots(str);
  };

  const submit = async () => {
    if (!chosenSlot) { setError('Выберите время'); return; }
    setLoading(true); setError('');
    try {
      const scheduledTime = `${chosenDate}T${chosenSlot.time}:00`;
      await api.post(`/public/book`, {
        phone: phone.replace(/\D/g, ''),
        license_plate: plate.trim().toUpperCase(),
        service_ids: selected,
        box_id: chosenSlot.box_id,
        scheduled_time: scheduledTime,
      });
      setStep(4);
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка при создании записи');
    }
    setLoading(false);
  };

  // ── UI helpers ──

  const StepIndicator = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
      {[1,2,3].map(n => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8rem', fontWeight: 700,
            background: step > n ? '#27ae60' : step === n ? '#667eea' : '#ddd',
            color: step >= n ? 'white' : '#999',
          }}>{step > n ? '✓' : n}</div>
          {n < 3 && <div style={{ width: 40, height: 2, background: step > n ? '#27ae60' : '#ddd' }} />}
        </div>
      ))}
    </div>
  );

  const NavBtns = ({ onBack, onNext, nextLabel = 'Далее', nextDisabled = false }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
      {onBack
        ? <button onClick={onBack} style={{ padding: '0.6rem 1.5rem', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '0.95rem' }}>← Назад</button>
        : <div />}
      {onNext && (
        <button onClick={onNext} disabled={nextDisabled || loading} style={{
          padding: '0.6rem 1.8rem', borderRadius: '6px', border: 'none',
          background: nextDisabled ? '#ddd' : 'linear-gradient(135deg,#667eea,#764ba2)',
          color: nextDisabled ? '#999' : 'white', cursor: nextDisabled ? 'default' : 'pointer',
          fontSize: '0.95rem', fontWeight: 600,
        }}>{loading ? 'Загрузка...' : nextLabel}</button>
      )}
    </div>
  );

  // ── Шаги ──

  if (step === 4) return (
    <div style={{ maxWidth: 560, margin: '4rem auto', textAlign: 'center', padding: '0 1rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
      <h2 style={{ color: '#27ae60', marginBottom: '0.5rem' }}>Запись создана!</h2>
      <p style={{ color: '#7f8c8d', marginBottom: '2rem' }}>
        Ждём вас {new Date(chosenDate).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} в {chosenSlot?.time} в {chosenSlot?.box_name}.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button onClick={() => navigate('/')} style={{ padding: '0.7rem 1.5rem', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>
          На главную
        </button>
        <button onClick={() => { setStep(1); setSelected([]); setPhone(''); setPlate(''); setChosenDate(null); setChosenSlot(null); }}
          style={{ padding: '0.7rem 1.5rem', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
          Записаться ещё раз
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '1.5rem' }}>Онлайн-запись</h2>
      <StepIndicator />
      {error && <div style={{ padding: '0.75rem 1rem', background: '#fdecea', borderRadius: '6px', color: '#c0392b', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

      {/* ШАГ 1: Услуги */}
      {step === 1 && (
        <div>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Выберите услуги</h3>
          {services.length === 0
            ? <p style={{ color: '#95a5a6' }}>Загрузка услуг...</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {services.map(svc => {
                  const on = selected.includes(svc.id);
                  return (
                    <div key={svc.id} onClick={() => toggle(svc.id)} style={{
                      padding: '0.9rem 1rem', borderRadius: '8px', cursor: 'pointer',
                      border: `2px solid ${on ? '#667eea' : '#e8e8e8'}`,
                      background: on ? '#f0f2ff' : 'white',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '4px', border: `2px solid ${on ? '#667eea' : '#ccc'}`, background: on ? '#667eea' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {on && <span style={{ color: 'white', fontSize: '12px', fontWeight: 700 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#2c3e50' }}>{svc.name}</div>
                          {svc.duration && <div style={{ fontSize: '0.8rem', color: '#95a5a6' }}>{svc.duration} мин</div>}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#667eea', whiteSpace: 'nowrap' }}>{svc.price} ₽</div>
                    </div>
                  );
                })}
              </div>
          }
          {selected.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0f2ff', borderRadius: '8px', fontSize: '0.88rem', color: '#667eea' }}>
              Выбрано: {selected.length} усл. · {totalDur() > 0 ? `${totalDur()} мин · ` : ''}{totalPrice()} ₽
            </div>
          )}
          <NavBtns onNext={() => { if (!selected.length) { setError('Выберите хотя бы одну услугу'); return; } setError(''); setStep(2); }} nextDisabled={!selected.length} />
        </div>
      )}

      {/* ШАГ 2: Данные */}
      {step === 2 && (
        <div>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Ваши данные</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#2c3e50' }}>Номер телефона *</label>
            <input
              type="tel" value={phone} placeholder="7 (999) 123-45-67"
              onChange={e => setPhone(fmt(e.target.value))}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#2c3e50' }}>Гос. номер автомобиля *</label>
            <input
              type="text" value={plate} placeholder="А123БВ777"
              onChange={e => setPlate(e.target.value.toUpperCase())}
              style={{ width: '100%', padding: '0.75rem', border: '2px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box', letterSpacing: '0.05em' }}
            />
          </div>
          <div style={{ padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px', fontSize: '0.85rem', color: '#7f8c8d' }}>
            По номеру телефона мы найдём ваши данные в базе. Если вы у нас впервые — всё равно запишем!
          </div>
          <NavBtns
            onBack={() => { setError(''); setStep(1); }}
            onNext={() => {
              if (phone.replace(/\D/g,'').length < 10) { setError('Введите корректный телефон'); return; }
              if (!plate.trim()) { setError('Введите гос. номер'); return; }
              setError('');
              setDates(buildDates());
              setStep(3);
            }}
            nextDisabled={phone.replace(/\D/g,'').length < 10 || !plate.trim()}
          />
        </div>
      )}

      {/* ШАГ 3: Дата и время */}
      {step === 3 && (
        <div>
          <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Выберите дату</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', marginBottom: '1.5rem' }}>
            {dates.map(d => {
              const str = d.toISOString().split('T')[0];
              const chosen = chosenDate === str;
              return (
                <div key={str} onClick={() => onDateClick(d)} style={{
                  padding: '0.5rem 0.25rem', textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                  border: `2px solid ${chosen ? '#667eea' : '#e8e8e8'}`,
                  background: chosen ? '#667eea' : 'white',
                  color: chosen ? 'white' : '#2c3e50',
                }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{WDAYS[d.getDay()]}</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{d.getDate()}</div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>{MONTHS[d.getMonth()].slice(0,3)}</div>
                </div>
              );
            })}
          </div>

          {chosenDate && (
            <>
              <h3 style={{ marginBottom: '0.75rem', color: '#2c3e50' }}>Выберите время</h3>
              {loading && <p style={{ color: '#95a5a6' }}>Загрузка...</p>}
              {!loading && slots.length === 0 && chosenDate && !error && (
                <p style={{ color: '#95a5a6' }}>На эту дату нет свободного времени</p>
              )}
              {!loading && slots.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  {slots.map((slot, i) => {
                    const box = slot.available_boxes?.[0];
                    const chosen = chosenSlot?.time === slot.time && chosenSlot?.box_id === box?.id;
                    return (
                      <div key={i} onClick={() => setChosenSlot({ time: slot.time, box_id: box?.id, box_name: box?.name })} style={{
                        padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                        border: `2px solid ${chosen ? '#667eea' : '#e8e8e8'}`,
                        background: chosen ? '#667eea' : 'white',
                        color: chosen ? 'white' : '#2c3e50',
                        fontSize: '0.9rem', fontWeight: chosen ? 600 : 400,
                      }}>
                        {slot.time}
                        {slot.boxes_count > 1 && <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '0.3rem' }}>×{slot.boxes_count}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {chosenSlot && (
                <div style={{ padding: '0.75rem', background: '#f0f2ff', borderRadius: '8px', fontSize: '0.88rem', color: '#667eea', marginBottom: '0.5rem' }}>
                  {new Date(chosenDate).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} в {chosenSlot.time} · {chosenSlot.box_name}
                </div>
              )}
            </>
          )}

          <NavBtns
            onBack={() => { setError(''); setChosenDate(null); setSlots([]); setChosenSlot(null); setStep(2); }}
            onNext={submit}
            nextLabel="Записаться"
            nextDisabled={!chosenSlot}
          />
        </div>
      )}
    </div>
  );
}

export default PublicBooking;
