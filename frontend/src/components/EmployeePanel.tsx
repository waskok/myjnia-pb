import React from 'react';
import type { AppLogic } from '../hooks/useAppLogic';
import { MonitoringTab } from './MonitoringTab';

export const EmployeePanel: React.FC<AppLogic> = (props) => {
  const { loggedInUser, logout, activeEmpTab, setActiveEmpTab, fetchMonitoring, posCustomerQuery, setPosCustomerQuery, handleVerifyCustomer, posVerifiedCustomer, setPosData, posData, handlePOSSubmit, fuels, handlePosChange, empResDateFilter, setEmpResDateFilter, empResPhoneFilter, setEmpResPhoneFilter, allReservations, getStatusColor, handleCompleteReservation, handleCancelReservation, monitoringData, message } = props;

  const selectedFuel = fuels.find(f => String(f.id) === posData.fuelId);
  const costPLN = selectedFuel ? (selectedFuel.pricePerLiter * posData.quantity).toFixed(2) : '0.00';
  const pointsCostPerLiter = selectedFuel?.type === 'LPG' ? 50 : 100;
  const costPoints = Math.floor(posData.quantity) * pointsCostPerLiter;
  const canAffordWithPoints = posVerifiedCustomer && posVerifiedCustomer.loyaltyPoints >= costPoints;

  return (
    <div className="app-container">
      <div className="header-bar">
        <h2 style={{ margin: 0 }}>Witaj, {loggedInUser}! (Panel Pracownika) 👨‍🔧</h2>
        <button onClick={logout} className="btn btn-danger">Wyloguj się</button>
      </div>

      <div className="tabs-container">
        <button onClick={() => setActiveEmpTab('pos')} className={`tab-btn-large ${activeEmpTab === 'pos' ? 'tab-active-primary' : 'tab-inactive'}`}>⛽ Kasa POS</button>
        <button onClick={() => setActiveEmpTab('rezerwacje')} className={`tab-btn-large ${activeEmpTab === 'rezerwacje' ? 'tab-active-primary' : 'tab-inactive'}`}>🧼 Rezerwacje</button>
        <button onClick={() => { setActiveEmpTab('monitoring'); fetchMonitoring(); }} className={`tab-btn-large ${activeEmpTab === 'monitoring' ? 'tab-active-primary' : 'tab-inactive'}`}>📡 Monitoring</button>
      </div>

      {activeEmpTab === 'pos' && (
        <div className="card">
          <h3>Kasa Fiskalna (Sprzedaż Paliwa)</h3>
          <div className="flex-row mb-15" style={{ alignItems: 'flex-end' }}>
             <div style={{ flex: 1 }}>
               <label>1. Skanuj klienta (E-mail lub Telefon):</label>
               <input type="text" className="input-field w-full" value={posCustomerQuery} onChange={e => setPosCustomerQuery(e.target.value)} placeholder="Wpisz dane i kliknij Sprawdź..." />
             </div>
             <button type="button" onClick={handleVerifyCustomer} className="btn btn-dark">Sprawdź</button>
             <button type="button" onClick={() => { setPosData({...posData, customerEmail: '', paymentMethod: 'Karta', issueInvoice: false}); setPosCustomerQuery(''); }} className="btn btn-light">Pomiń</button>
          </div>

          {posVerifiedCustomer && (
             <div className="alert-box alert-success mb-15">
                <strong>Zweryfikowano:</strong> {posVerifiedCustomer.firstName} | <strong>Dostępne punkty:</strong> {posVerifiedCustomer.loyaltyPoints} pkt
             </div>
          )}

          <form onSubmit={handlePOSSubmit} className="flex-col">
            <div className="flex-row">
              <div style={{ flex: 2 }}><label>2. Wybierz paliwo:</label><select name="fuelId" className="select-field w-full" value={posData.fuelId} onChange={handlePosChange}>{fuels.map(f => <option key={f.id} value={f.id}>{f.type} - {f.pricePerLiter} zł/l (Dostępne: {f.tankLevel} l)</option>)}</select></div>
              <div style={{ flex: 1 }}><label>Ilość (L):</label><input type="number" name="quantity" className="input-field w-full" min="1" step="0.01" value={posData.quantity} onChange={handlePosChange} required /></div>
            </div>
            
            <div className="points-badge my-15" style={{ background: '#f1f5f9', color: '#0f172a', padding: '15px' }}>
              <span style={{ fontSize: '18px' }}>Do zapłaty: <strong>{costPLN} zł</strong></span> {posVerifiedCustomer && (<span> albo <strong style={{ color: '#10b981' }}>{costPoints} pkt</strong></span>)}
            </div>

            <div className="flex-row">
              <div style={{ flex: 1 }}>
                <label>3. Płatność:</label>
                <select name="paymentMethod" className="select-field w-full" value={posData.paymentMethod} onChange={handlePosChange}>
                  <option value="Karta">Karta</option><option value="Gotówka">Gotówka</option>
                  {posVerifiedCustomer && <option value="Punkty" disabled={!canAffordWithPoints}>Punkty Lojalnościowe {canAffordWithPoints ? '' : '(Zbyt mało)'}</option>}
                </select>
              </div>
            </div>

            <div className="flex-row flex-start mt-10">
              <input type="checkbox" name="issueInvoice" id="issueInvoice" className="checkbox-large" checked={posData.issueInvoice} onChange={handlePosChange} />
              <label htmlFor="issueInvoice" style={{ fontWeight: 'bold' }}>Wystaw Fakturę VAT</label>
            </div>
            <button type="submit" className="btn btn-primary mt-15 w-auto">Zatwierdź sprzedaż</button>
          </form>
        </div>
      )}

      {activeEmpTab === 'rezerwacje' && (
        <div className="card">
          <h3>Rezerwacje myjni do obsłużenia</h3>
          <div className="filter-box mb-20">
            <div>
              <label>Wybierz dzień:</label>
              <input type="date" className="input-field w-full" value={empResDateFilter} onChange={e => setEmpResDateFilter(e.target.value)} />
            </div>
            <div>
              <label>Szukaj po numerze telefonu:</label>
              <input type="text" className="input-field w-full" placeholder="Np. 123456789" value={empResPhoneFilter} onChange={e => setEmpResPhoneFilter(e.target.value)} />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button type="button" className="btn btn-light" onClick={() => { setEmpResDateFilter(''); setEmpResPhoneFilter(''); }}>Wyczyść filtry</button>
            </div>
          </div>

          {allReservations.length === 0 ? <p>Brak rezerwacji w systemie.</p> : (
            <ul className="list-unstyled">
              {allReservations.filter(res => {
                const matchDate = empResDateFilter ? new Date(res.date).toISOString().substring(0, 10) === empResDateFilter : true;
                const matchPhone = empResPhoneFilter ? (res.customer?.phone || '').includes(empResPhoneFilter) : true;
                return matchDate && matchPhone;
              }).map((res) => (
                <li key={res.id} className="list-item">
                  <div>
                    <strong style={{ fontSize: '16px' }}>{new Date(res.date).toLocaleString()}</strong> <br/> 
                    <span className="text-muted">Klient:</span> {res.customer ? `${res.customer.firstName} ${res.customer.lastName} (Tel: ${res.customer.phone})` : 'Brak danych'} <br/>
                    <span className="text-muted">Usługa:</span> {res.washService.type} <br/> 
                    <span className="text-muted">Status:</span> <b style={{ color: getStatusColor(res.status) }}>{res.status}</b>
                  </div>
                  {res.status === 'Oczekująca' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => handleCompleteReservation(res.id)} className="btn btn-success">Zakończ</button>
                      <button onClick={() => handleCancelReservation(res.id)} className="btn btn-danger">Anuluj</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeEmpTab === 'monitoring' && <MonitoringTab monitoringData={monitoringData} fetchMonitoring={fetchMonitoring} />}
      {message && <div className={`msg ${message.includes('✅') ? 'msg-success' : 'msg-error'}`}>{message}</div>}
    </div>
  );
};