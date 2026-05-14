import React from 'react';
import type { AppLogic } from '../hooks/useAppLogic';
import { MonitoringTab } from './MonitoringTab';
import type { ReportPeriodType } from '../types';

export const OwnerPanel: React.FC<AppLogic> = (props) => {
  const { loggedInUser, logout, activeTab, setActiveTab, reportPeriod, setReportPeriod, reportDateStr, handleDateChange, fetchReports, reportData, fuels, newPrice, setNewPrice, handleUpdatePrice, newDelivery, handleDeliveryChange, handleOrderDelivery, deliveries, handleCompleteDelivery, newEmployee, setNewEmployee, handleAddEmployee, employees, handleDeleteEmployee, customers, fetchMonitoring, monitoringData, message } = props;

  return (
    <div className="app-container">
      <div className="header-bar">
        <h2 style={{ margin: 0 }}>Witaj, {loggedInUser}! (Panel Właściciela) 💼</h2>
        <button onClick={logout} className="btn btn-danger">Wyloguj się</button>
      </div>
      
      <div className="tabs-container">
        <button onClick={() => setActiveTab('paliwa')} className={`tab-btn-large ${activeTab === 'paliwa' ? 'tab-active-primary' : 'tab-inactive'}`}>⛽ Paliwa</button>
        <button onClick={() => setActiveTab('pracownicy')} className={`tab-btn-large ${activeTab === 'pracownicy' ? 'tab-active-primary' : 'tab-inactive'}`}>👨‍🔧 Pracownicy</button>
        <button onClick={() => setActiveTab('klienci')} className={`tab-btn-large ${activeTab === 'klienci' ? 'tab-active-primary' : 'tab-inactive'}`}>👥 Klienci</button>
        <button onClick={() => { setActiveTab('monitoring'); fetchMonitoring(); }} className={`tab-btn-large ${activeTab === 'monitoring' ? 'tab-active-primary' : 'tab-inactive'}`}>📡 Monitoring</button>
        <button onClick={() => { setActiveTab('raporty'); fetchReports(); }} className={`tab-btn-large ${activeTab === 'raporty' ? 'tab-active-primary' : 'tab-inactive'}`}>📊 Raporty</button>
      </div>

      {activeTab === 'raporty' && (
        <div className="card">
          <div className="flex-space-between mb-20" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Raporty Sprzedaży 📊</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold' }}>Okres:</label>
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

          <h3 className="mt-20">Historia Transakcji {reportPeriod === 'all' && '(15 najnowszych)'}</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Data</th><th>Klient</th><th>Kwota</th><th>Płatność</th><th>Kasjer</th></tr></thead>
              <tbody>
                {reportData?.transactions.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleString()}</td>
                    <td>{t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : <span className="text-muted">Niezarejestrowany</span>}</td>
                    <td style={{ fontWeight: 'bold' }}>{t.totalAmount.toFixed(2)} zł</td>
                    <td>{t.paymentMethod}</td>
                    <td>{t.employee.firstName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'paliwa' && (
        <>
          <div className="card">
            <h3>Zarządzanie Cennikiem i Magazynem 📈</h3>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Paliwo</th><th>Stan Zbiornika</th><th>Aktualna Cena</th><th>Nowa Cena</th><th>Akcja</th></tr></thead>
                <tbody>
                  {fuels.map(f => (
                    <tr key={f.id}>
                      <td><strong>{f.type}</strong></td>
                      <td style={{ color: f.tankLevel < 1000 ? '#ef4444' : 'inherit', fontWeight: f.tankLevel < 1000 ? 'bold' : 'normal' }}>{f.tankLevel} / {f.maxLevel} L</td>
                      <td>{f.pricePerLiter} zł/L</td>
                      <td><input type="number" step="0.01" className="input-field w-full" value={newPrice[f.id] || ''} onChange={(e) => setNewPrice({ ...newPrice, [f.id]: parseFloat(e.target.value) })} /></td>
                      <td><button onClick={() => handleUpdatePrice(f.id)} className="btn btn-success">Zmień</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Zarządzanie Dostawami 🚚</h3>
            <form onSubmit={handleOrderDelivery} className="flex-row mb-20" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label>Paliwo</label><select name="fuelId" className="select-field w-full" value={newDelivery.fuelId} onChange={handleDeliveryChange} required><option value="" disabled>Paliwo</option>{fuels.map(f => <option key={f.id} value={f.id}>{f.type}</option>)}</select></div>
              <div style={{ flex: 1 }}><label>Ilość (L)</label><input type="number" name="quantity" className="input-field w-full" value={newDelivery.quantity} onChange={handleDeliveryChange} required /></div>
              <div style={{ flex: 1 }}><label>Dostawca</label><input type="text" name="supplier" className="input-field w-full" value={newDelivery.supplier} onChange={handleDeliveryChange} required /></div>
              <div style={{ flex: 1 }}><label>Data</label><input type="datetime-local" name="deliveryDate" className="input-field w-full" value={newDelivery.deliveryDate} onChange={handleDeliveryChange} required /></div>
              <button type="submit" className="btn btn-warning">Zleć dostawę</button>
            </form>
            
            <ul className="list-unstyled">
              {deliveries.map(d => (
                <li key={d.id} className="list-item">
                  <div>
                    <strong style={{ fontSize: '16px' }}>{d.fuel.type}</strong> - {d.quantity} L (Dostawca: {d.supplier})<br/> 
                    <span className="text-muted">Planowana:</span> {new Date(d.deliveryDate).toLocaleString()} <br/>
                    <span className="text-muted">Status:</span> <span style={{ fontWeight: 'bold', color: d.status === 'Dostarczona' ? '#10b981' : '#f59e0b' }}>{d.status}</span>
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
            <table className="data-table">
              <thead><tr><th>Imię i Nazwisko</th><th>Rola</th><th>Login</th><th>Akcja</th></tr></thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td>{emp.firstName} {emp.lastName}</td><td>{emp.role}</td><td>{emp.login}</td>
                    <td><button onClick={() => handleDeleteEmployee(emp.id)} className="btn btn-danger">Usuń</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'klienci' && (
        <div className="card">
          <h3>Baza Zarejestrowanych Klientów</h3>
          <table className="data-table">
            <thead><tr><th>Klient</th><th>E-mail / Tel</th><th>Punkty</th></tr></thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td>{c.firstName} {c.lastName}</td>
                  <td>{c.email}<br/><small className="text-muted">{c.phone}</small></td>
                  <td><strong style={{ color: '#10b981', fontSize: '16px' }}>{c.loyaltyPoints} pkt</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'monitoring' && <MonitoringTab monitoringData={monitoringData} fetchMonitoring={fetchMonitoring} />}
      {message && <div className={`msg ${message.includes('✅') ? 'msg-success' : 'msg-error'}`}>{message}</div>}
    </div>
  );
};