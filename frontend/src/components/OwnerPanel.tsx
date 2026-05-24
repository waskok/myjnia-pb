import React from 'react';
import type { AppLogic } from '../hooks/useAppLogic';
import { MonitoringTab } from './MonitoringTab';
import { OwnerScheduleTab } from './OwnerScheduleTab';
import type { ReportPeriodType } from '../types';

export const OwnerPanel: React.FC<AppLogic> = (props) => {
  const {
    activeTab, reportPeriod, setReportPeriod, reportDateStr,
    handleDateChange, fetchReports, reportData, fuels, newPrice, setNewPrice, handleUpdatePrice,
    newDelivery, handleDeliveryChange, handleOrderDelivery, deliveries, handleCompleteDelivery,
    newEmployee, setNewEmployee, handleAddEmployee, employees, handleDeleteEmployee, customers,
    fetchMonitoring, monitoringData, scheduleYear, scheduleMonth, scheduleData,
    selectedScheduleDates, scheduleEmployeeId, setScheduleEmployeeId, scheduleStartTime, setScheduleStartTime,
    changeScheduleMonth, handleScheduleMonthInput, toggleScheduleDate, handleSaveSchedule,
    handleDeleteScheduleEntry, setSelectedScheduleDates,
  } = props;

  return (
    <div className="panel-content">

      {activeTab === 'raporty' && (
        <div className="card">
          <div className="flex-space-between mb-20" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Raporty sprzedaży</h3>
            <div className="form-inline">
              <label className="form-label">Okres:</label>
              <select className="select-field" value={reportPeriod} onChange={e => { const p = e.target.value as ReportPeriodType; setReportPeriod(p); fetchReports(p, reportDateStr); }}>
                <option value="all">Cały czas</option><option value="daily">Dzienny</option><option value="monthly">Miesięczny</option><option value="yearly">Roczny</option>
              </select>
              {reportPeriod === 'daily' && <input type="date" className="input-field" value={reportDateStr.substring(0, 10)} onChange={e => handleDateChange(e.target.value)} />}
              {reportPeriod === 'monthly' && <input type="month" className="input-field" value={reportDateStr.substring(0, 7)} onChange={e => handleDateChange(e.target.value)} />}
              {reportPeriod === 'yearly' && <input type="number" min="2020" max="2100" className="input-field" value={reportDateStr.substring(0, 4)} onChange={e => handleDateChange(e.target.value)} />}
            </div>
          </div>
          
          <div className="grid-responsive mb-20">
            <div className="data-box text-center">
              <h4 style={{ margin: 0, color: '#64748b' }}>Utarg ({reportPeriod === 'all' ? 'Ogółem' : 'Wybrany Okres'})</h4>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#10b981' }}>{reportData?.totalRevenue.toFixed(2)} zł</div>
            </div>
            <div className="data-box text-center">
              <h4 style={{ margin: 0, color: '#64748b' }}>Liczba Transakcji</h4>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#0f172a' }}>{reportData?.totalCount}</div>
            </div>
            <div className="data-box text-center">
              <h4 style={{ margin: 0, color: '#64748b' }}>Średnia Transakcja</h4>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#0284c7' }}>{((reportData?.totalRevenue || 0) / (reportData?.totalCount || 1)).toFixed(2)} zł</div>
            </div>
          </div>

          <h3 className="mt-20">Historia transakcji {reportPeriod === 'all' && '(15 najnowszych)'}</h3>
          <div className="list-grid">
            {reportData?.transactions.map(t => (
              <article key={t.id} className="list-item card-like">
                <div>
                  <p className="item-title">{new Date(t.date).toLocaleString()}</p>
                  <p className="item-meta">Klient: {t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : 'Niezarejestrowany'}</p>
                  <p className="item-meta">Kasjer: {t.employee.firstName}</p>
                </div>
                <div className="summary-values">
                  <strong>{t.totalAmount.toFixed(2)} zł</strong>
                  <span>{t.paymentMethod}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'paliwa' && (
        <>
          <div className="card">
            <h3>📦 Zarządzanie cennikiem i magazynem</h3>
            <div className="list-grid">
              {fuels.map(f => (
                <article key={f.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{f.type}</p>
                    <p className="item-meta">Stan: <span className={f.tankLevel < 1000 ? 'text-danger' : ''}>{f.tankLevel} / {f.maxLevel} L</span></p>
                    <p className="item-meta">Aktualna cena: {f.pricePerLiter} zł/L</p>
                  </div>
                  <div className="row-actions">
                    <input type="number" step="0.01" className="input-field" value={newPrice[f.id] || ''} onChange={(e) => setNewPrice({ ...newPrice, [f.id]: parseFloat(e.target.value) })} />
                    <button onClick={() => handleUpdatePrice(f.id)} className="btn btn-success">Zmień</button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>🚚 Zarządzanie dostawami</h3>
            <form onSubmit={handleOrderDelivery} className="flex-row mb-20" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label>Paliwo</label><select name="fuelId" className="select-field w-full" value={newDelivery.fuelId} onChange={handleDeliveryChange} required><option value="" disabled>Paliwo</option>{fuels.map(f => <option key={f.id} value={f.id}>{f.type}</option>)}</select></div>
              <div style={{ flex: 1 }}><label>Ilość (L)</label><input type="number" name="quantity" className="input-field w-full" value={newDelivery.quantity} onChange={handleDeliveryChange} required /></div>
              <div style={{ flex: 1 }}><label>Dostawca</label><input type="text" name="supplier" className="input-field w-full" value={newDelivery.supplier} onChange={handleDeliveryChange} required /></div>
              <div style={{ flex: 1 }}><label>Data</label><input type="datetime-local" name="deliveryDate" className="input-field w-full" value={newDelivery.deliveryDate} onChange={handleDeliveryChange} required /></div>
              <button type="submit" className="btn btn-warning">Zleć dostawę</button>
            </form>
            
            <ul className="list-unstyled list-grid">
              {deliveries.map(d => (
                <li key={d.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{d.fuel.type} - {d.quantity} L</p>
                    <p className="item-meta">Dostawca: {d.supplier}</p>
                    <p className="item-meta">Planowana: {new Date(d.deliveryDate).toLocaleString()}</p>
                    <span className={`status-badge ${d.status === 'Dostarczona' ? 'badge-success' : 'badge-warning'}`}>{d.status}</span>
                  </div>
                  {d.status !== 'Dostarczona' && <button onClick={() => handleCompleteDelivery(d.id)} className="btn btn-primary">Odbierz dostawę</button>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {activeTab === 'pracownicy' && (
        <>
          <div className="card">
            <h3>Dodaj Pracownika</h3>
            <form onSubmit={handleAddEmployee} className="flex-row" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label>Imię</label><input className="input-field w-full" required value={newEmployee.firstName} onChange={e => setNewEmployee({...newEmployee, firstName: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label>Nazwisko</label><input className="input-field w-full" required value={newEmployee.lastName} onChange={e => setNewEmployee({...newEmployee, lastName: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label>Login</label><input className="input-field w-full" required value={newEmployee.login} onChange={e => setNewEmployee({...newEmployee, login: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label>Hasło</label><input type="password" className="input-field w-full" required value={newEmployee.password} onChange={e => setNewEmployee({...newEmployee, password: e.target.value})} /></div>
              <div style={{ flex: 1 }}><label>Rola</label><select className="select-field w-full" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}><option>Kasjer</option><option>Monitoring</option><option>Obsługa Myjni</option></select></div>
              <button type="submit" className="btn btn-success">Dodaj</button>
            </form>
          </div>
          
          <div className="card">
            <h3>Lista Pracowników</h3>
            <div className="list-grid">
              {employees.map(emp => (
                <article key={emp.id} className="list-item card-like">
                  <div>
                    <p className="item-title">{emp.firstName} {emp.lastName}</p>
                    <p className="item-meta">Rola: {emp.role}</p>
                    <p className="item-meta">Login: {emp.login}</p>
                  </div>
                  <button onClick={() => handleDeleteEmployee(emp.id)} className="btn btn-danger">Usuń</button>
                </article>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'klienci' && (
        <div className="card">
          <h3>Baza Zarejestrowanych Klientów</h3>
          <div className="list-grid">
            {customers.map(c => (
              <article key={c.id} className="list-item card-like">
                <div>
                  <p className="item-title">{c.firstName} {c.lastName}</p>
                  <p className="item-meta">{c.email}</p>
                  <p className="item-meta">{c.phone}</p>
                </div>
                <span className="status-badge badge-success">{c.loyaltyPoints} pkt</span>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'grafik' && (
        <OwnerScheduleTab
          scheduleYear={scheduleYear}
          scheduleMonth={scheduleMonth}
          scheduleData={scheduleData}
          selectedScheduleDates={selectedScheduleDates}
          scheduleEmployeeId={scheduleEmployeeId}
          setScheduleEmployeeId={setScheduleEmployeeId}
          scheduleStartTime={scheduleStartTime}
          setScheduleStartTime={setScheduleStartTime}
          employees={employees}
          changeScheduleMonth={changeScheduleMonth}
          handleScheduleMonthInput={handleScheduleMonthInput}
          toggleScheduleDate={toggleScheduleDate}
          handleSaveSchedule={handleSaveSchedule}
          handleDeleteScheduleEntry={handleDeleteScheduleEntry}
          setSelectedScheduleDates={setSelectedScheduleDates}
        />
      )}

      {activeTab === 'monitoring' && <MonitoringTab monitoringData={monitoringData} fetchMonitoring={fetchMonitoring} />}
    </div>
  );
};