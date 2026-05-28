import React from 'react';
import type { AppLogic } from '../hooks/useAppLogic';

export const CustomerPanel: React.FC<AppLogic> = (props) => {
  const { loyaltyPoints, activeCustTab, handleReservation, selectedService, setSelectedService, services, reservationDate, getMinDateTime, setReservationDate, myReservations, getStatusColor, myTransactions } = props;

  const getBadgeClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes('zakoncz') || normalized.includes('aktyw')) return 'badge-success';
    if (normalized.includes('oczek')) return 'badge-warning';
    if (normalized.includes('anul')) return 'badge-danger';
    return 'badge-neutral';
  };

  return (
    <div className="panel-content">
      <div className="panel-meta">
        <div className="points-badge">Punkty lojalnościowe: <span>{loyaltyPoints}</span></div>
      </div>

      {activeCustTab === 'book' && (
        <div className="card">
          <h3>Nowa rezerwacja myjni</h3>
          <form onSubmit={handleReservation} className="flex-col">
            <label>Wybierz usługę:</label>
            <select value={selectedService} className="select-field" onChange={(e) => setSelectedService(e.target.value)} required>
              <option value="" disabled>-- Wybierz usługę --</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.type} - {s.price} zł (+{s.loyaltyPoints} pkt)</option>)}
            </select>
            <label className="mt-10">Data i godzina rezerwacji:</label>
            <input type="datetime-local" className="input-field" value={reservationDate} min={getMinDateTime()} onChange={(e) => setReservationDate(e.target.value)} required />
            <button type="submit" className="btn btn-success mt-10 w-auto">Potwierdź rezerwację</button>
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
              <p className="text-muted mt-10">W celu anulowania rezerwacji prosimy o kontakt telefoniczny z pracownikiem stacji.</p>
            </>
          )}
        </div>
      )}

      {activeCustTab === 'buyHistory' && (
        <div className="card">
          <h3>Twoja historia zakupów (kasa POS)</h3>
          {myTransactions.length === 0 ? <p>Brak historii zakupów na stacji.</p> : (
            <div className="list-grid">
              {myTransactions.map(t => (
                <article key={t.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{t.items && t.items[0] ? t.items[0].product : 'Brak danych'}</p>
                    <p className="item-meta">{new Date(t.date).toLocaleString()}</p>
                  </div>
                  <div className="summary-values">
                    <strong>{t.totalAmount.toFixed(2)} zł</strong>
                    <span>{t.paymentMethod}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {activeCustTab === 'contact' && (
        <div className="card text-left">
          <h3>Kontakt z Myjnia PB</h3>
          <p>Masz pytania lub chcesz anulować rezerwację? Skontaktuj się z nami!</p>
          <div className="data-box mt-10">
            <p>📍 <strong>Adres:</strong> ul. Jana Pawla II 37, 31-864 Krakow</p>
            <p>📞 <strong>Telefon:</strong> +48 123 456 789</p>
            <p>✉️ <strong>E-mail:</strong> kontakt@myjniapb.pl</p>
          </div>
        </div>
      )}
      
    </div>
  );
};