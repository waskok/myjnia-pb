import React from 'react';
import type { AppLogic } from '../hooks/useAppLogic';

export const CustomerPanel: React.FC<AppLogic> = (props) => {
  const { loggedInUser, loyaltyPoints, logout, activeCustTab, setActiveCustTab, handleReservation, selectedService, setSelectedService, services, reservationDate, getMinDateTime, setReservationDate, myReservations, getStatusColor, myTransactions, message } = props;

  return (
    <div className="app-container">
      <div className="header-bar">
        <h2 style={{ margin: 0 }}>Witaj, {loggedInUser}! 👋</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="points-badge">💰 Punkty: <span>{loyaltyPoints}</span></div>
          <button onClick={logout} className="btn btn-danger">Wyloguj</button>
        </div>
      </div>

      <div className="tabs-container">
        <button onClick={() => setActiveCustTab('book')} className={`tab-btn-large ${activeCustTab === 'book' ? 'tab-active-primary' : 'tab-inactive'}`}>🧼 Zarezerwuj myjnię</button>
        <button onClick={() => setActiveCustTab('resHistory')} className={`tab-btn-large ${activeCustTab === 'resHistory' ? 'tab-active-primary' : 'tab-inactive'}`}>📅 Moje rezerwacje</button>
        <button onClick={() => setActiveCustTab('buyHistory')} className={`tab-btn-large ${activeCustTab === 'buyHistory' ? 'tab-active-primary' : 'tab-inactive'}`}>🛒 Historia zakupów</button>
        <button onClick={() => setActiveCustTab('contact')} className={`tab-btn-large ${activeCustTab === 'contact' ? 'tab-active-primary' : 'tab-inactive'}`}>📞 Kontakt</button>
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
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Data</th><th>Usługa</th><th>Status</th></tr></thead>
                  <tbody>
                    {myReservations.map((res, idx) => (
                      <tr key={idx}>
                        <td>{new Date(res.date).toLocaleString()}</td>
                        <td>{res.washService.type}</td>
                        <td><span style={{ fontWeight: 'bold', color: getStatusColor(res.status) }}>{res.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Data</th><th>Produkt / Usługa</th><th>Kwota</th><th>Płatność</th></tr></thead>
                <tbody>
                  {myTransactions.map(t => (
                    <tr key={t.id}>
                      <td>{new Date(t.date).toLocaleString()}</td>
                      <td>{t.items && t.items[0] ? t.items[0].product : 'Brak danych'}</td>
                      <td style={{ fontWeight: 'bold' }}>{t.totalAmount.toFixed(2)} zł</td>
                      <td>{t.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeCustTab === 'contact' && (
        <div className="card text-left">
          <h3 style={{ marginTop: 0 }}>Kontakt z Myjnią PB</h3>
          <p>Masz pytania lub chcesz anulować rezerwację? Skontaktuj się z nami!</p>
          <div className="data-box mt-10">
            <p>📍 <strong>Adres:</strong> ul. Jana Pawła II 37, 31-864 Kraków</p>
            <p>📞 <strong>Telefon:</strong> +48 123 456 789</p>
            <p>✉️ <strong>E-mail:</strong> kontakt@myjniapb.pl</p>
          </div>
        </div>
      )}
      
      {message && <div className={`msg ${message.includes('✅') ? 'msg-success' : 'msg-error'}`}>{message}</div>}
    </div>
  );
};