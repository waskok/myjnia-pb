import React from 'react';
import type { AppLogic } from '../hooks/useAppLogic';
import { MonitoringTab } from './MonitoringTab';
import { ScheduleCalendar } from './ScheduleCalendar';

export const EmployeePanel: React.FC<AppLogic> = (props) => {
  const {
    activeEmpTab, employeeJobRole, fetchMonitoring,
    scheduleYear, scheduleMonth, scheduleData, changeScheduleMonth, handleScheduleMonthInput,
    posCustomerQuery, setPosCustomerQuery, handleVerifyCustomer, posVerifiedCustomer,
    posData, handlePOSSubmit, fuels, handlePosChange, empResDateFilter, setEmpResDateFilter,
    empResPhoneFilter, setEmpResPhoneFilter, allReservations, getStatusColor,
    handleCompleteReservation, handleCancelReservation, monitoringData,
  } = props;

  const selectedFuel = fuels.find(f => String(f.id) === posData.fuelId);
  const costPLN = selectedFuel ? (selectedFuel.pricePerLiter * posData.quantity).toFixed(2) : '0.00';
  const pointsCostPerLiter = selectedFuel?.type === 'LPG' ? 50 : 100;
  const liters = Number(posData.quantity) || 0;
  const costPoints = Math.floor(liters * pointsCostPerLiter);
  const canAffordWithPoints = posVerifiedCustomer && posVerifiedCustomer.loyaltyPoints >= costPoints;
  const invoiceNeedsVerification = posData.issueInvoice && !posVerifiedCustomer;
  const canViewPos = employeeJobRole === 'Kasjer';
  const canViewMonitoring = employeeJobRole === 'Monitoring';
  const canViewMyjnia = employeeJobRole === 'Obsługa Myjni';
  const canViewLpg = employeeJobRole === 'Obsługa dystrybutora LPG';
  const canViewSchedule = employeeJobRole === 'Kasjer' || employeeJobRole === 'Monitoring' || employeeJobRole === 'Obsługa Myjni' || employeeJobRole === 'Obsługa dystrybutora LPG';
  const lpgFuel = monitoringData?.fuels.find((fuel) => fuel.type.toUpperCase().includes('LPG'));

  return (
    <div className="panel-content">

      {activeEmpTab === 'pos' && canViewPos && (
        <div className="card">
          <h3>Kasa fiskalna - sprzedaż paliwa</h3>

          <div className="pos-step-card mb-15">
            <label className="form-label">Klient (e-mail lub telefon)</label>
            <div className="pos-customer-row">
              <input
                type="text"
                className="input-field"
                value={posCustomerQuery}
                onChange={e => setPosCustomerQuery(e.target.value)}
                placeholder="Wpisz dane klienta"
              />
              <button type="button" onClick={handleVerifyCustomer} className="btn btn-light btn-verify">
                Sprawdź
              </button>
            </div>
            <p className="text-muted" style={{ margin: '6px 0 0', fontSize: '0.9rem' }}>
              Zweryfikuj klienta, aby odblokować płatność punktami.
            </p>
          </div>

          {posVerifiedCustomer && (
             <div className="alert-box alert-success mb-15">
                <strong>Zweryfikowano:</strong> {posVerifiedCustomer.firstName} | <strong>Dostępne punkty:</strong> {posVerifiedCustomer.loyaltyPoints} punktów lojalnościowych
             </div>
          )}

          <form onSubmit={handlePOSSubmit} className="flex-col">
            <div className="pos-step-card">
              <div className="pos-fuel-row">
                <div style={{ flex: 2 }}>
                  <label>Wybierz paliwo</label>
                  <select name="fuelId" className="select-field w-full" value={posData.fuelId} onChange={handlePosChange}>
                    {fuels.map(f => <option key={f.id} value={f.id}>{f.type} - {f.pricePerLiter} zł/l (Dostępne: {f.tankLevel} l)</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Ilość (L)</label>
                  <input type="number" name="quantity" className="input-field w-full" min="1" step="0.01" value={posData.quantity} onChange={handlePosChange} required />
                </div>
              </div>
            </div>
            
            <div className="points-badge my-15" style={{ background: '#f1f5f9', color: '#0f172a', padding: '15px' }}>
              <span style={{ fontSize: '18px' }}>Do zapłaty: <strong>{costPLN} zł</strong></span>{' '}
              {posVerifiedCustomer && (
                <span className="points-cost-text">
                  lub Koszt: {costPoints} punktów lojalnościowych
                </span>
              )}
            </div>

            <div className="pos-step-card">
              <div style={{ flex: 1 }}>
                <label>Płatność</label>
                <select name="paymentMethod" className="select-field w-full" value={posData.paymentMethod} onChange={handlePosChange}>
                  <option value="Karta">Karta</option><option value="Gotówka">Gotówka</option>
                  {posVerifiedCustomer && <option value="Punkty" disabled={!canAffordWithPoints}>Punkty Lojalnościowe {canAffordWithPoints ? '' : '(Zbyt mało)'}</option>}
                </select>
              </div>

              <div className="flex-row flex-start mt-10">
                <input type="checkbox" name="issueInvoice" id="issueInvoice" className="checkbox-large" checked={posData.issueInvoice} onChange={handlePosChange} />
                <label htmlFor="issueInvoice" style={{ fontWeight: 'bold' }}>Wystaw Fakturę VAT</label>
              </div>
              {invoiceNeedsVerification && (
                <p className="text-danger" style={{ marginTop: '8px' }}>
                  Aby wystawić fakturę, najpierw zweryfikuj klienta.
                </p>
              )}
            </div>
            <button type="submit" className="btn btn-primary mt-15 w-auto" disabled={invoiceNeedsVerification}>Zatwierdź sprzedaż</button>
          </form>
        </div>
      )}

      {activeEmpTab === 'rezerwacje' && canViewMyjnia && (
        <div className="card">
          <h3>Myjnia - rezerwacje do obsłużenia</h3>
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
            <ul className="list-unstyled list-grid">
              {allReservations.filter(res => {
                const matchDate = empResDateFilter ? new Date(res.date).toISOString().substring(0, 10) === empResDateFilter : true;
                const matchPhone = empResPhoneFilter ? (res.customer?.phone || '').includes(empResPhoneFilter) : true;
                return matchDate && matchPhone;
              }).map((res) => (
                <li key={res.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{new Date(res.date).toLocaleString()}</p>
                    <p className="item-meta">Klient: {res.customer ? `${res.customer.firstName} ${res.customer.lastName} (Tel: ${res.customer.phone})` : 'Brak danych'}</p>
                    <p className="item-meta">Usługa: {res.washService.type}</p>
                    <span className="status-badge badge-warning" style={{ color: getStatusColor(res.status) }}>{res.status}</span>
                  </div>
                  {res.status === 'Oczekująca' && (
                    <div className="row-actions">
                      <button onClick={() => handleCompleteReservation(res.id)} className="btn btn-success">✅ Zakończ</button>
                      <button onClick={() => handleCancelReservation(res.id)} className="btn btn-danger">❌ Anuluj</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeEmpTab === 'grafik' && canViewSchedule && (
        <div className="card schedule-card text-left">
          <ScheduleCalendar
            readOnly
            title="Grafik pracy"
            scheduleYear={scheduleYear}
            scheduleMonth={scheduleMonth}
            scheduleData={scheduleData}
            changeScheduleMonth={changeScheduleMonth}
            onMonthInput={handleScheduleMonthInput}
          />
        </div>
      )}

      {activeEmpTab === 'monitoring' && canViewMonitoring && (
        <MonitoringTab
          monitoringData={monitoringData}
          fetchMonitoring={fetchMonitoring}
        />
      )}

      {activeEmpTab === 'lpg' && canViewLpg && (
        <div className="card">
          <div className="flex-space-between mb-20" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Stan dystrybutora LPG</h3>
            <button onClick={() => fetchMonitoring()} className="btn btn-dark">Odśwież</button>
          </div>

          <div className="grid-responsive mb-20">
            <div className="data-box text-center">
              <h4 style={{ margin: 0, color: '#64748b' }}>Ciśnienie LPG</h4>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#0f172a' }}>
                {monitoringData?.lpg.pressure ?? '--'} bar
              </div>
            </div>
            <div className="data-box text-center">
              <h4 style={{ margin: 0, color: '#64748b' }}>Temperatura LPG</h4>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#0284c7' }}>
                {monitoringData?.lpg.temp ?? '--'} °C
              </div>
            </div>
            <div className="data-box text-center">
              <h4 style={{ margin: 0, color: '#64748b' }}>Poziom zbiornika LPG</h4>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#10b981' }}>
                {lpgFuel ? `${lpgFuel.tankLevel} / ${lpgFuel.maxLevel} L` : '--'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};