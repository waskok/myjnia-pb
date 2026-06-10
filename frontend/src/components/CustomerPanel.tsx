import React, { useEffect } from 'react';
import type { AppLogic } from '../hooks/useAppLogic';
import { getMinReservationDate } from '../utils/reservationSlots';

export const CustomerPanel: React.FC<AppLogic> = (props) => {
  const {
    activeCustTab,
    handleReservation,
    selectedService,
    setSelectedService,
    services,
    customerWashPointsCost,
    reservationDay,
    reservationTime,
    setReservationTime,
    availableSlots,
    slotsLoading,
    handleReservationDayChange,
    fetchAvailability,
    myReservations,
    getStatusColor,
    myTransactions,
  } = props;

  useEffect(() => {
    if (activeCustTab !== 'book' || !reservationDay) return;
    void fetchAvailability(reservationDay);
  }, [activeCustTab, reservationDay, fetchAvailability]);

  useEffect(() => {
    if (activeCustTab !== 'book' || !reservationDay) return;

    const refreshSlots = () => {
      void fetchAvailability(reservationDay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSlots();
    };

    window.addEventListener('focus', refreshSlots);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshSlots);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeCustTab, reservationDay, fetchAvailability]);

  const getBadgeClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes('zakoncz') || normalized.includes('aktyw')) return 'badge-success';
    if (normalized.includes('oczek')) return 'badge-warning';
    if (normalized.includes('anul')) return 'badge-danger';
    return 'badge-neutral';
  };

  return (
    <div className="panel-content">
      {activeCustTab === 'book' && (
        <div className="card">
          <h3>Umów mycie auta</h3>
          <form onSubmit={handleReservation} className="flex-col">
            <label>Wybierz usługę:</label>
            <select value={selectedService} className="select-field" onChange={(e) => setSelectedService(e.target.value)} required>
              <option value="" disabled>-- Wybierz usługę --</option>
              {services.map(s => (
                <React.Fragment key={s.id}>
                  <option value={String(s.id)}>{s.type} - {s.price.toFixed(2)} zł (+{s.loyaltyPoints} punktów lojalnościowych)</option>
                  {s.type.toLowerCase().includes('standard') && (
                    <option value={`points:${s.id}:${customerWashPointsCost.standard}`}>Mycie standardowe - Koszt: {customerWashPointsCost.standard} punktów lojalnościowych</option>
                  )}
                  {s.type.toLowerCase().includes('wosk') && (
                    <option value={`points:${s.id}:${customerWashPointsCost.wax}`}>Mycie z woskowaniem - Koszt: {customerWashPointsCost.wax} punktów lojalnościowych</option>
                  )}
                </React.Fragment>
              ))}
            </select>
            <label className="mt-10">Data rezerwacji:</label>
            <input
              type="date"
              className="input-field"
              value={reservationDay}
              min={getMinReservationDate()}
              onChange={(e) => handleReservationDayChange(e.target.value)}
              required
            />
            <label className="mt-10">Godzina rezerwacji:</label>
            {!reservationDay && (
              <p className="text-muted" style={{ margin: '8px 0 0' }}>Najpierw wybierz datę, aby zobaczyć wolne godziny.</p>
            )}
            {reservationDay && slotsLoading && (
              <p className="text-muted" style={{ margin: '8px 0 0' }}>Ładowanie dostępnych godzin…</p>
            )}
            {reservationDay && !slotsLoading && (
              <div className="time-slot-grid" role="group" aria-label="Wybierz godzinę rezerwacji">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    className={`time-slot-btn${reservationTime === slot.time ? ' time-slot-selected' : ''}${!slot.available ? ' time-slot-unavailable' : ''}`}
                    disabled={!slot.available}
                    aria-pressed={reservationTime === slot.time}
                    onClick={() => setReservationTime(slot.time)}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
            <button type="submit" className="btn btn-success mt-10 w-auto" disabled={!reservationDay || !reservationTime}>Potwierdź rezerwację</button>
            <p className="text-muted mt-10" style={{ lineHeight: 1.5 }}>
              W celu anulowania rezerwacji prosimy o kontakt telefoniczny z pracownikiem stacji pod numerem +48 123 456 789.
              <br />
              W przypadku anulowania rezerwacji opłaconej punktami lojalnościowymi punkty nie podlegają zwrotowi.
            </p>
          </form>
        </div>
      )}

      {activeCustTab === 'resHistory' && (
        <div className="card">
          <h3>Moje rezerwacje</h3>
          {myReservations.length === 0 ? <p>Brak historii rezerwacji.</p> : (
            <>
              <div className="list-grid">
                {myReservations.map((res, idx) => (
                  <article key={idx} className="list-item card-like">
                    <div>
                      <p className="item-title">{res.washService.type}</p>
                      <p className="item-meta">{new Date(res.date).toLocaleString()}</p>
                    </div>
                    <span className={`status-badge ${getBadgeClass(res.status)}`} style={{ color: getStatusColor(res.status) }}>
                      {res.status}
                    </span>
                  </article>
                ))}
              </div>
              <p className="text-muted mt-10">
                W celu anulowania rezerwacji prosimy o kontakt telefoniczny z pracownikiem stacji pod numerem +48 123 456 789.
                <br />
                W przypadku anulowania rezerwacji opłaconej punktami lojalnościowymi punkty nie podlegają zwrotowi.
              </p>
            </>
          )}
        </div>
      )}

      {activeCustTab === 'buyHistory' && (
        <div className="card">
          <h3>Historia zakupów</h3>
          {myTransactions.length === 0 ? <p>Brak historii zakupów na stacji.</p> : (
            <div className="list-grid">
              {myTransactions.map(t => (
                <article key={t.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{t.items && t.items[0] ? t.items[0].product : 'Brak danych'}</p>
                    <p className="item-meta">{new Date(t.date).toLocaleString()}</p>
                  </div>
                  <div className="summary-values">
                    <strong>
                      {t.totalAmount.toFixed(2)} zł
                    </strong>
                    {typeof t.pointsDelta === 'number' && (
                      <span className={t.pointsDelta > 0 ? 'points-earned-text' : 'points-cost-text'}>
                        {t.pointsDelta > 0
                          ? `+${t.pointsDelta} punktów lojalnościowych`
                          : `Koszt: ${Math.abs(t.pointsDelta)} punktów lojalnościowych`}
                      </span>
                    )}
                    <span>{t.paymentMethod}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};