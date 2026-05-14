import React, { useState } from 'react';
import './App.css'; 

// --- TYPY ---
interface Employee { id: number; firstName: string; lastName: string; role: string; login: string; email?: string; phone?: string; }
interface Customer { id: number; firstName: string; lastName: string; email: string; phone: string; loyaltyPoints: number; registered: boolean; }
interface WashService { id: number; type: string; price: number; loyaltyPoints: number; }
interface Reservation { id: number; date: string; status: string; washService: WashService; customer?: { firstName: string; lastName: string; phone: string; }; }
interface Fuel { id: number; type: string; pricePerLiter: number; tankLevel: number; maxLevel: number; percentage?: string; }
interface Delivery { id: number; fuel: Fuel; quantity: number; status: string; deliveryDate: string; supplier: string; owner?: { firstName: string; lastName: string; } }
interface MonitoringData { fuels: Fuel[]; lpg: { pressure: string; temp: string; }; carWash: { bay: number; occupied: boolean; camera: string; }[]; alerts: string[]; }
interface TransactionItem { product: string; quantity: number; value: number; }
interface Transaction { id: number; totalAmount: number; date: string; paymentMethod: string; customer?: { firstName: string; lastName: string; }; employee: { firstName: string; lastName: string; }; items?: TransactionItem[]; }
interface ReportData { totalRevenue: number; totalCount: number; transactions: Transaction[]; }

type ReportPeriodType = 'all' | 'daily' | 'monthly' | 'yearly';
type ActiveCustTab = 'book' | 'resHistory' | 'buyHistory' | 'contact';

function App() {
  const [message, setMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'employee' | 'owner' | null>(null);
  
  const [activeTab, setActiveTab] = useState<'paliwa' | 'pracownicy' | 'klienci' | 'monitoring' | 'raporty'>('paliwa');
  const [activeEmpTab, setActiveEmpTab] = useState<'pos' | 'rezerwacje' | 'monitoring'>('pos');
  const [activeCustTab, setActiveCustTab] = useState<ActiveCustTab>('book');

  // NOWE STANY: Filtry dla pracownika
  const [empResDateFilter, setEmpResDateFilter] = useState('');
  const [empResPhoneFilter, setEmpResPhoneFilter] = useState('');

  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', address: '', phone: '', email: '', password: '' });
  const [services, setServices] = useState<WashService[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);

  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [myTransactions, setMyTransactions] = useState<Transaction[]>([]);

  const [loginMode, setLoginMode] = useState<'customer' | 'staff'>('customer');
  const [staffData, setStaffData] = useState({ login: '', password: '' });
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [fuels, setFuels] = useState<Fuel[]>([]);
  
  const [posData, setPosData] = useState({ fuelId: '', quantity: 1, customerEmail: '', paymentMethod: 'Karta', issueInvoice: false });
  const [posCustomerQuery, setPosCustomerQuery] = useState('');
  const [posVerifiedCustomer, setPosVerifiedCustomer] = useState<Customer | null>(null);

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [newDelivery, setNewDelivery] = useState({ fuelId: '', quantity: 1000, supplier: '', deliveryDate: '' });
  const [newPrice, setNewPrice] = useState<{ [key: number]: number }>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', role: 'Kasjer', login: '', password: '', email: '', phone: '' });
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriodType>('all');
  const [reportDateStr, setReportDateStr] = useState<string>(new Date().toISOString().substring(0, 10)); 

  // --- OBLICZANIE BIEŻĄCEJ DATY DO BLOKOWANIA KALENDARZA (MIN) ---
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  // --- POMOCNICZA FUNKCJA DO KOLORÓW STATUSU ---
  const getStatusColor = (status: string) => {
    if (status === 'Zakończona') return '#28a745'; 
    if (status === 'Anulowana') return '#dc3545';  
    if (status === 'Oczekująca') return '#ffc107'; 
    return '#000';
  };

  // --- HANDLERY ZMIAN ---
  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleStaffChange = (e: React.ChangeEvent<HTMLInputElement>) => setStaffData({ ...staffData, [e.target.name]: e.target.value });
  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNewDelivery({ ...newDelivery, [e.target.name]: e.target.value });
  const handlePosChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') setPosData({ ...posData, [name]: (e.target as HTMLInputElement).checked });
    else setPosData({ ...posData, [name]: value });
  };

  // --- POBIERANIE DANYCH ---
  const fetchServices = async () => { try { const res = await fetch('http://localhost:5000/api/services'); const data = await res.json(); setServices(data); if (data.length > 0) setSelectedService(String(data[0].id)); } catch (e) { console.error(e); } };
  const fetchFuels = async () => { try { const res = await fetch('http://localhost:5000/api/fuels'); const data = await res.json(); setFuels(data); if (data.length > 0) { setPosData(prev => ({ ...prev, fuelId: String(data[0].id) })); setNewDelivery(prev => ({ ...prev, fuelId: String(data[0].id) })); } } catch (e) { console.error(e); } };
  
  const fetchCustomerData = async (token: string) => { 
    try {
      fetchServices();
      const resRes = await fetch('http://localhost:5000/api/my-reservations', { headers: { 'Authorization': `Bearer ${token}` } }); 
      if (resRes.ok) setMyReservations(await resRes.json()); 
      
      const transRes = await fetch('http://localhost:5000/api/my-transactions', { headers: { 'Authorization': `Bearer ${token}` } });
      if (transRes.ok) setMyTransactions(await transRes.json());
      
      const profRes = await fetch('http://localhost:5000/api/my-profile', { headers: { 'Authorization': `Bearer ${token}` } });
      if (profRes.ok) {
        const profData = await profRes.json();
        setLoyaltyPoints(profData.loyaltyPoints);
      }
    } catch (e) { console.error(e); } 
  };

  const fetchAllReservations = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/employee/reservations', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setAllReservations(await res.json()); } catch (e) { console.error(e); } };
  const fetchDeliveries = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/owner/deliveries', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setDeliveries(await res.json()); } catch (e) { console.error(e); } };
  const fetchEmployees = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/owner/employees', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setEmployees(await res.json()); } catch (e) { console.error(e); } };
  const fetchCustomers = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/owner/customers', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setCustomers(await res.json()); } catch (e) { console.error(e); } };
  const fetchMonitoring = async () => { const token = localStorage.getItem('token'); if (!token) return; try { const res = await fetch('http://localhost:5000/api/monitoring', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setMonitoringData(await res.json()); } catch (e) { console.error(e); } };

  const fetchReports = async (period = reportPeriod, dateVal = reportDateStr) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      let url = 'http://localhost:5000/api/owner/reports';
      if (period !== 'all') {
        url += `?period=${period}&date=${dateVal}`;
      }
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setReportData(await res.json());
    } catch (e) { console.error(e); }
  };

  // --- LOGOWANIE ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Logowanie...');
    const endpoint = loginMode === 'customer' ? (isLogin ? '/api/login' : '/api/register') : '/api/staff/login';
    const bodyData = loginMode === 'customer' ? formData : staffData;

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyData) });
      const data = await res.json();
      
      if (res.ok) {
        setMessage('✅ ' + data.message);
        if (loginMode !== 'customer' || isLogin) {
          localStorage.setItem('token', data.token);
          setLoggedInUser(data.user.firstName);
          setUserRole(data.user.role || 'customer');
          
          if (data.user.role === 'owner') { 
            setActiveTab('paliwa');
            fetchFuels(); fetchDeliveries(data.token); fetchEmployees(data.token); fetchCustomers(data.token);
          } else if (data.user.role === 'employee') { 
            setActiveEmpTab('pos');
            fetchFuels(); fetchAllReservations(data.token); 
          } else { 
            fetchCustomerData(data.token); 
          }
        } else { setIsLogin(true); setFormData({ ...formData, password: '' }); }
      } else setMessage('❌ ' + data.error);
    } catch (e) { console.error(e); setMessage('❌ Błąd połączenia z serwerem!'); }
  };

  // --- AKCJE KASY I INNE ---
  const handleVerifyCustomer = async () => { if (!posCustomerQuery) return; try { const token = localStorage.getItem('token'); const res = await fetch(`http://localhost:5000/api/employee/customer/${encodeURIComponent(posCustomerQuery)}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (res.ok) { setPosVerifiedCustomer(data); setPosData({ ...posData, customerEmail: data.email }); setMessage('✅ Zweryfikowano!'); } else { setPosVerifiedCustomer(null); setPosData({ ...posData, customerEmail: '' }); setMessage('❌ ' + data.error); } } catch (e) { console.error(e); } };
  const handlePOSSubmit = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/transactions/fuel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(posData) }); const data = await res.json(); if (res.ok) { setMessage('✅ ' + data.message); setPosData({ fuelId: posData.fuelId, quantity: 1, customerEmail: '', paymentMethod: 'Karta', issueInvoice: false }); setPosVerifiedCustomer(null); setPosCustomerQuery(''); fetchFuels(); } else setMessage('❌ ' + data.error); } catch (e) { console.error(e); } };
  const handleReservation = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    try { 
      const token = localStorage.getItem('token'); 
      if (!token) return; 
      const res = await fetch('http://localhost:5000/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, washServiceId: selectedService, date: reservationDate }) }); 
      const data = await res.json(); 
      if (res.ok) { 
        setMessage('✅ ' + data.message); 
        setReservationDate(''); 
        fetchCustomerData(token); 
      } else {
        setMessage('❌ ' + data.error);
      }
    } catch (e) { console.error(e); } 
  };

  const handleCompleteReservation = async (id: number) => { try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/employee/reservations/${id}/complete`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Zakończono!'); fetchAllReservations(token); } } catch (e) { console.error(e); } };
  
  const handleCancelReservation = async (id: number) => {
    if (!window.confirm('Czy na pewno chcesz anulować tę rezerwację?')) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`http://localhost:5000/api/employee/reservations/${id}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setMessage('✅ Rezerwacja anulowana!');
        fetchAllReservations(token);
      }
    } catch (e) { console.error(e); }
  };

  const handleOrderDelivery = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/owner/deliveries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newDelivery) }); if (res.ok) { setMessage('✅ Zlecono!'); fetchDeliveries(token); setNewDelivery({...newDelivery, deliveryDate: '', supplier: ''}); } } catch (e) { console.error(e); } };
  const handleCompleteDelivery = async (id: number) => { try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/owner/deliveries/${id}/complete`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Odebrano!'); fetchDeliveries(token); fetchFuels(); } } catch (e) { console.error(e); } };
  const handleUpdatePrice = async (id: number) => { if (!newPrice[id]) return; try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/owner/fuels/${id}/price`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ price: newPrice[id] }) }); if (res.ok) { setMessage('✅ Zmieniono!'); fetchFuels(); setNewPrice({ ...newPrice, [id]: 0 }); } } catch (e) { console.error(e); } };
  const handleAddEmployee = async (e: React.FormEvent) => { e.preventDefault(); const token = localStorage.getItem('token'); try { const res = await fetch('http://localhost:5000/api/owner/employees', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newEmployee) }); if (res.ok) { setMessage('✅ Dodano!'); setNewEmployee({ firstName: '', lastName: '', role: 'Kasjer', login: '', password: '', email: '', phone: '' }); if(token) fetchEmployees(token); } else { const err = await res.json(); setMessage('❌ ' + err.error); } } catch (e) { console.error(e); } };
  const handleDeleteEmployee = async (id: number) => { if (!window.confirm('Usunąć?')) return; const token = localStorage.getItem('token'); try { const res = await fetch(`http://localhost:5000/api/owner/employees/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { if(token) fetchEmployees(token); setMessage('✅ Usunięto.'); } } catch (e) { console.error(e); } };

  const logout = () => { localStorage.clear(); setLoggedInUser(null); setUserRole(null); setMessage(''); setStaffData({ login: '', password: '' }); };
  const renderMessage = () => message && <div className={`msg ${message.includes('✅') ? 'msg-success' : 'msg-error'}`}>{message}</div>;

  const renderMonitoringTab = () => (
    <div style={{ background: '#fff', border: '1px solid #ced4da', borderRadius: '8px', padding: '20px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: '#343a40' }}>Centrum Monitoringu PB 📡</h3>
        <button onClick={fetchMonitoring} className="btn btn-dark">Odśwież odczyty</button>
      </div>

      {monitoringData?.alerts && monitoringData.alerts.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          {monitoringData.alerts.map((al, idx) => (
            <div key={idx} style={{ backgroundColor: '#f8d7da', borderLeft: '6px solid #dc3545', color: '#721c24', padding: '15px 20px', marginBottom: '10px', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'pre-wrap', textAlign: 'left', fontSize: '15px' }}>
              ⚠️ {al}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {monitoringData?.fuels.map(f => (
          <div key={f.id} style={{ border: '1px solid #ced4da', borderRadius: '10px', padding: '20px', backgroundColor: '#f8f9fa', textAlign: 'left' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057', fontSize: '18px' }}>Zbiornik {f.type}</h4>
            <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#212529' }}>
              {f.tankLevel} L <span style={{fontSize:'14px', fontWeight:'normal', color: '#6c757d'}}>z {f.maxLevel} L</span>
            </div>
            <div style={{ backgroundColor: '#e9ecef', borderRadius: '10px', height: '24px', width: '100%', overflow: 'hidden', marginTop: '15px' }}>
              <div style={{ height: '100%', transition: 'width 0.5s ease-in-out', width: `${f.percentage}%`, backgroundColor: Number(f.percentage) < 20 ? '#dc3545' : '#28a745' }}></div>
            </div>
          </div>
        ))}
        {monitoringData?.lpg && (
          <div style={{ border: '2px solid #17a2b8', borderRadius: '10px', padding: '20px', backgroundColor: '#f8f9fa', textAlign: 'left' }}>
            <h4 style={{ color: '#17a2b8', margin: '0 0 15px 0', fontSize: '18px' }}>Instalacja LPG</h4>
            <div style={{ fontSize: '16px', marginBottom: '8px', color: '#212529' }}><strong>Ciśnienie:</strong> {monitoringData.lpg.pressure} bar</div>
            <div style={{ fontSize: '16px', color: '#212529' }}><strong>Temperatura:</strong> {monitoringData.lpg.temp} °C</div>
          </div>
        )}
        <div style={{ border: '2px solid #ffc107', borderRadius: '10px', padding: '20px', backgroundColor: '#f8f9fa', textAlign: 'left' }}>
          <h4 style={{ color: '#d39e00', margin: '0 0 15px 0', fontSize: '18px' }}>Kamery Myjni (CCTV)</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {monitoringData?.carWash.map(bay => (
              <li key={bay.bay} style={{ marginBottom: '15px', borderBottom: '1px solid #dee2e6', paddingBottom: '10px' }}>
                <span style={{ fontSize: '16px', color: '#495057' }}>Stanowisko {bay.bay}:</span>
                <span style={{ color: bay.occupied ? '#dc3545' : '#28a745', fontWeight: 'bold', marginLeft: '10px', fontSize: '16px' }}>
                  {bay.occupied ? '🔴 Zajęte' : '🟢 Wolne'}
                </span>
                <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '5px' }}>📹 Status: {bay.camera}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const handleDateChange = (val: string) => {
    let fullDate = val;
    if (val.length === 7) fullDate = `${val}-01`;
    if (val.length === 4) fullDate = `${val}-01-01`;
    setReportDateStr(fullDate);
    fetchReports(reportPeriod, fullDate);
  };

  const selectedFuel = fuels.find(f => String(f.id) === posData.fuelId);
  const costPLN = selectedFuel ? (selectedFuel.pricePerLiter * posData.quantity).toFixed(2) : '0.00';
  const pointsCostPerLiter = selectedFuel?.type === 'LPG' ? 50 : 100;
  const costPoints = Math.floor(posData.quantity) * pointsCostPerLiter;
  const canAffordWithPoints = posVerifiedCustomer && posVerifiedCustomer.loyaltyPoints >= costPoints;

  // ==============================================
  // WIDOK 1: WŁAŚCICIEL
  // ==============================================
  if (userRole === 'owner') {
    return (
      <div className="app-container">
        <h2>Witaj, {loggedInUser}! (Panel Właściciela) 💼</h2>
        
        <div className="tabs-container">
          <button onClick={() => setActiveTab('paliwa')} className={`tab-btn-large ${activeTab === 'paliwa' ? 'tab-active-paliwa' : 'tab-inactive'}`}>⛽ Paliwa</button>
          <button onClick={() => setActiveTab('pracownicy')} className={`tab-btn-large ${activeTab === 'pracownicy' ? 'tab-active-pracownicy' : 'tab-inactive'}`}>👨‍🔧 Pracownicy</button>
          <button onClick={() => setActiveTab('klienci')} className={`tab-btn-large ${activeTab === 'klienci' ? 'tab-active-klienci' : 'tab-inactive'}`}>👥 Klienci</button>
          <button onClick={() => { setActiveTab('monitoring'); fetchMonitoring(); }} className={`tab-btn-large ${activeTab === 'monitoring' ? 'tab-active-paliwa' : 'tab-inactive'}`}>📡 Monitoring</button>
          <button onClick={() => { setActiveTab('raporty'); fetchReports(); }} className={`tab-btn-large ${activeTab === 'raporty' ? 'tab-active-pracownicy' : 'tab-inactive'}`}>📊 Raporty</button>
        </div>

        {activeTab === 'raporty' && (
          <div className="card card-light">
            <div className="flex-space-between mb-20" style={{ alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Raporty Sprzedaży 📊</h3>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label className="text-bold">Okres:</label>
                <select 
                  className="select-field input-small w-auto" 
                  value={reportPeriod} 
                  onChange={e => {
                    const p = e.target.value as ReportPeriodType;
                    setReportPeriod(p);
                    fetchReports(p, reportDateStr);
                  }}
                >
                  <option value="all">Cały czas</option>
                  <option value="daily">Dzienny</option>
                  <option value="monthly">Miesięczny</option>
                  <option value="yearly">Roczny</option>
                </select>

                {reportPeriod === 'daily' && <input type="date" className="input-field input-small w-auto" value={reportDateStr.substring(0, 10)} onChange={e => handleDateChange(e.target.value)} />}
                {reportPeriod === 'monthly' && <input type="month" className="input-field input-small w-auto" value={reportDateStr.substring(0, 7)} onChange={e => handleDateChange(e.target.value)} />}
                {reportPeriod === 'yearly' && <input type="number" min="2020" max="2100" className="input-field input-small w-auto" value={reportDateStr.substring(0, 4)} onChange={e => handleDateChange(e.target.value)} />}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                <h4 style={{ margin: 0, color: '#6c757d' }}>Utarg ({reportPeriod === 'all' ? 'Ogółem' : 'Wybrany Okres'})</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#28a745' }}>{reportData?.totalRevenue.toFixed(2)} zł</div>
              </div>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                <h4 style={{ margin: 0, color: '#6c757d' }}>Liczba Transakcji</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#212529' }}>{reportData?.totalCount}</div>
              </div>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                <h4 style={{ margin: 0, color: '#6c757d' }}>Średnia Transakcja</h4>
                <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px', color: '#17a2b8' }}>{((reportData?.totalRevenue || 0) / (reportData?.totalCount || 1)).toFixed(2)} zł</div>
              </div>
            </div>

            <div className="card card-gray">
              <h3 className="text-left">Historia Transakcji {reportPeriod === 'all' && '(15 najnowszych)'}</h3>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Data</th><th>Klient</th><th>Kwota</th><th>Płatność</th><th>Kasjer</th></tr></thead>
                  <tbody>
                    {reportData?.transactions.map(t => (
                      <tr key={t.id}>
                        <td>{new Date(t.date).toLocaleString()}</td>
                        <td>{t.customer ? `${t.customer.firstName} ${t.customer.lastName}` : <span style={{color: '#888'}}>Niezarejestrowany</span>}</td>
                        <td className="text-bold">{t.totalAmount.toFixed(2)} zł</td>
                        <td>{t.paymentMethod}</td>
                        <td>{t.employee.firstName}</td>
                      </tr>
                    ))}
                    {reportData?.transactions.length === 0 && (
                      <tr><td colSpan={5} className="text-center">Brak transakcji w wybranym okresie.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'paliwa' && (
          <>
            <div className="card card-danger">
              <h3>Zarządzanie Cennikiem i Magazynem 📈</h3>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Paliwo</th><th>Stan Zbiornika</th><th>Aktualna Cena</th><th>Nowa Cena</th><th>Akcja</th></tr></thead>
                  <tbody>
                    {fuels.map(f => (
                      <tr key={f.id}>
                        <td><strong>{f.type}</strong></td>
                        <td className={f.tankLevel < 1000 ? 'text-danger' : ''}>{f.tankLevel} / {f.maxLevel} L</td>
                        <td>{f.pricePerLiter} zł/L</td>
                        <td><input type="number" step="0.01" className="input-field input-small w-60" value={newPrice[f.id] || ''} onChange={(e) => setNewPrice({ ...newPrice, [f.id]: parseFloat(e.target.value) })} /></td>
                        <td><button onClick={() => handleUpdatePrice(f.id)} className="btn btn-success">Zmień</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card card-warning">
              <h3>Zarządzanie Dostawami 🚚</h3>
              <form onSubmit={handleOrderDelivery} className="flex-row">
                <select name="fuelId" className="select-field input-small" value={newDelivery.fuelId} onChange={handleDeliveryChange} required>
                  <option value="" disabled>Paliwo</option>
                  {fuels.map(f => <option key={f.id} value={f.id}>{f.type}</option>)}
                </select>
                <input type="number" name="quantity" className="input-field input-small" placeholder="Ilość litrów" value={newDelivery.quantity} onChange={handleDeliveryChange} required />
                <input type="text" name="supplier" className="input-field input-small" placeholder="Nazwa dostawcy" value={newDelivery.supplier} onChange={handleDeliveryChange} required />
                <input type="datetime-local" name="deliveryDate" className="input-field w-auto" value={newDelivery.deliveryDate} onChange={handleDeliveryChange} required />
                <button type="submit" className="btn btn-warning">Zleć dostawę</button>
              </form>
              
              <ul className="list-unstyled mt-20">
                {deliveries.map(d => (
                  <li key={d.id} className="list-item flex-space-between">
                    <div>
                      <strong>{d.fuel.type}</strong> - {d.quantity} L (Dostawca: {d.supplier})<br/> 
                      Planowana: {new Date(d.deliveryDate).toLocaleString()} <br/>
                      Status: <span className="text-bold">{d.status}</span>
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
            <div className="card card-info">
              <h3>Dodaj Pracownika</h3>
              <form onSubmit={handleAddEmployee} className="flex-row">
                <input placeholder="Imię" className="input-field input-small" required value={newEmployee.firstName} onChange={e => setNewEmployee({...newEmployee, firstName: e.target.value})} />
                <input placeholder="Nazwisko" className="input-field input-small" required value={newEmployee.lastName} onChange={e => setNewEmployee({...newEmployee, lastName: e.target.value})} />
                <input placeholder="Login" className="input-field input-small" required value={newEmployee.login} onChange={e => setNewEmployee({...newEmployee, login: e.target.value})} />
                <input placeholder="Hasło" type="password" className="input-field input-small" required value={newEmployee.password} onChange={e => setNewEmployee({...newEmployee, password: e.target.value})} />
                <select className="select-field input-small" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}>
                  <option>Kasjer</option><option>Monitoring</option><option>Obsługa Myjni</option>
                </select>
                <button type="submit" className="btn btn-success">Dodaj</button>
              </form>
            </div>
            
            <div className="card card-gray">
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
          <div className="card card-warning">
            <h3>Baza Zarejestrowanych Klientów</h3>
            <table className="data-table">
              <thead><tr><th>Klient</th><th>E-mail / Tel</th><th>Punkty</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td>{c.firstName} {c.lastName}</td><td>{c.email}<br/><small>{c.phone}</small></td>
                    <td><strong className="text-success">{c.loyaltyPoints} pkt</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'monitoring' && renderMonitoringTab()}

        {renderMessage()}
        <button onClick={logout} className="btn btn-danger mt-30">Wyloguj się</button>
      </div>
    );
  }

  // ==============================================
  // WIDOK 2: PRACOWNIK
  // ==============================================
  if (userRole === 'employee') {
    return (
      <div className="app-container">
        <h2>Witaj, {loggedInUser}! (Panel Pracownika) 👨‍🔧</h2>

        <div className="tabs-container">
          <button onClick={() => setActiveEmpTab('pos')} className={`tab-btn-large ${activeEmpTab === 'pos' ? 'tab-active-pracownicy' : 'tab-inactive'}`}>⛽ Kasa POS</button>
          <button onClick={() => setActiveEmpTab('rezerwacje')} className={`tab-btn-large ${activeEmpTab === 'rezerwacje' ? 'tab-active-pracownicy' : 'tab-inactive'}`}>🧼 Rezerwacje</button>
          <button onClick={() => { setActiveEmpTab('monitoring'); fetchMonitoring(); }} className={`tab-btn-large ${activeEmpTab === 'monitoring' ? 'tab-active-paliwa' : 'tab-inactive'}`}>📡 Monitoring</button>
        </div>

        {activeEmpTab === 'pos' && (
          <div className="card card-info">
            <h3>Kasa Fiskalna (Sprzedaż Paliwa)</h3>
            
            <div className="flex-row text-left flex-end mb-15">
               <div className="flex-1">
                 <label>1. Skanuj klienta (E-mail lub Telefon):</label>
                 <input type="text" className="input-field" value={posCustomerQuery} onChange={e => setPosCustomerQuery(e.target.value)} placeholder="Wpisz dane i kliknij Sprawdź..." />
               </div>
               <button type="button" onClick={handleVerifyCustomer} className="btn btn-dark">Sprawdź</button>
               <button type="button" onClick={() => { setPosVerifiedCustomer(null); setPosCustomerQuery(''); setPosData({...posData, customerEmail: '', paymentMethod: 'Karta', issueInvoice: false}); }} className="btn btn-light">Pomiń</button>
            </div>

            {posVerifiedCustomer && (
               <div className="verification-box">
                  <strong>Zweryfikowano:</strong> {posVerifiedCustomer.firstName} | <strong>Dostępne punkty:</strong> {posVerifiedCustomer.loyaltyPoints} pkt
               </div>
            )}

            <form onSubmit={handlePOSSubmit} className="flex-col">
              <div className="flex-row text-left">
                <div className="flex-1"><label>2. Wybierz paliwo:</label><select name="fuelId" className="select-field" value={posData.fuelId} onChange={handlePosChange}>{fuels.map(f => <option key={f.id} value={f.id}>{f.type} - {f.pricePerLiter} zł/l (Dostępne: {f.tankLevel} l)</option>)}</select></div>
                <div className="flex-1"><label>Ilość (L):</label><input type="number" name="quantity" className="input-field" min="1" step="0.01" value={posData.quantity} onChange={handlePosChange} required /></div>
              </div>
              
              <div className="payment-summary">
                <strong>Do zapłaty:</strong> {costPLN} zł {posVerifiedCustomer && (<span> albo <strong>{costPoints} pkt</strong></span>)}
              </div>

              <div className="flex-row text-left">
                <div className="flex-1">
                  <label>3. Płatność:</label>
                  <select name="paymentMethod" className="select-field" value={posData.paymentMethod} onChange={handlePosChange}>
                    <option value="Karta">Karta</option><option value="Gotówka">Gotówka</option>
                    {posVerifiedCustomer && <option value="Punkty" disabled={!canAffordWithPoints}>Punkty Lojalnościowe {canAffordWithPoints ? '' : '(Zbyt mało)'}</option>}
                  </select>
                </div>
              </div>

              <div className="flex-row text-left flex-start">
                <input type="checkbox" name="issueInvoice" id="issueInvoice" className="checkbox-large" checked={posData.issueInvoice} onChange={handlePosChange} />
                <label htmlFor="issueInvoice" className="text-bold">Wystaw Fakturę VAT</label>
              </div>
              <button type="submit" className="btn btn-info mt-10">Zatwierdź sprzedaż</button>
            </form>
          </div>
        )}

        {activeEmpTab === 'rezerwacje' && (
          <div className="card card-gray">
            <h3>Rezerwacje myjni do obsłużenia</h3>
            
            {/* NOWE: Filtry dla pracownika */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ced4da' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Wybierz dzień:</label>
                <input type="date" className="input-field input-small" style={{ margin: 0 }} value={empResDateFilter} onChange={e => setEmpResDateFilter(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Szukaj po numerze telefonu:</label>
                <input type="text" className="input-field input-small" placeholder="Np. 123456789" style={{ margin: 0 }} value={empResPhoneFilter} onChange={e => setEmpResPhoneFilter(e.target.value)} />
              </div>
              <div style={{ marginTop: '22px' }}>
                <button type="button" className="btn btn-light" onClick={() => { setEmpResDateFilter(''); setEmpResPhoneFilter(''); }}>Wyczyść filtry</button>
              </div>
            </div>

            {allReservations.length === 0 ? <p>Brak rezerwacji w systemie.</p> : (
              <ul className="list-unstyled">
                {allReservations.filter(res => {
                  let matchDate = true;
                  let matchPhone = true;
                  if (empResDateFilter) {
                    const resDay = new Date(res.date).toISOString().substring(0, 10);
                    matchDate = resDay === empResDateFilter;
                  }
                  if (empResPhoneFilter) {
                    const phone = res.customer?.phone || '';
                    matchPhone = phone.includes(empResPhoneFilter);
                  }
                  return matchDate && matchPhone;
                }).map((res) => (
                  <li key={res.id} className="list-item flex-space-between" style={{ alignItems: 'center' }}>
                    <div>
                      <strong>{new Date(res.date).toLocaleString()}</strong> <br/> 
                      {/* NOWE: Wyświetlanie danych klienta */}
                      Klient: {res.customer ? `${res.customer.firstName} ${res.customer.lastName} (Tel: ${res.customer.phone})` : 'Brak danych'} <br/>
                      Usługa: {res.washService.type} <br/> 
                      Status: <b style={{ color: getStatusColor(res.status) }}>{res.status}</b>
                    </div>
                    {res.status === 'Oczekująca' && (
                      <div>
                        <button onClick={() => handleCompleteReservation(res.id)} className="btn btn-success" style={{ marginRight: '10px' }}>Zakończ</button>
                        <button onClick={() => handleCancelReservation(res.id)} className="btn btn-danger">Anuluj</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeEmpTab === 'monitoring' && renderMonitoringTab()}

        {renderMessage()}
        <button onClick={logout} className="btn btn-danger mt-30">Wyloguj się</button>
      </div>
    );
  }

  // ==============================================
  // WIDOK 3: KLIENT
  // ==============================================
  if (userRole === 'customer') {
    return (
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>Witaj, {loggedInUser}! 👋</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: '#e9ecef', padding: '10px 15px', borderRadius: '30px', fontWeight: 'bold', border: '1px solid #dee2e6', fontSize: '14px' }}>
              💰 Punkty: <span style={{ color: '#28a745', fontSize: '18px', marginLeft: '5px' }}>{loyaltyPoints}</span>
            </div>
            <button onClick={logout} className="btn btn-danger">Wyloguj</button>
          </div>
        </div>

        <div className="tabs-container" style={{ marginTop: '20px' }}>
          <button onClick={() => setActiveCustTab('book')} className={`tab-btn-large ${activeCustTab === 'book' ? 'tab-active-pracownicy' : 'tab-inactive'}`}>🧼 Zarezerwuj myjnię</button>
          <button onClick={() => setActiveCustTab('resHistory')} className={`tab-btn-large ${activeCustTab === 'resHistory' ? 'tab-active-pracownicy' : 'tab-inactive'}`}>📅 Moje rezerwacje</button>
          <button onClick={() => setActiveCustTab('buyHistory')} className={`tab-btn-large ${activeCustTab === 'buyHistory' ? 'tab-active-pracownicy' : 'tab-inactive'}`}>🛒 Historia zakupów</button>
          <button onClick={() => setActiveCustTab('contact')} className={`tab-btn-large ${activeCustTab === 'contact' ? 'tab-active-pracownicy' : 'tab-inactive'}`}>📞 Kontakt</button>
        </div>

        {activeCustTab === 'book' && (
          <div className="card card-light mt-20">
            <h3 className="text-left">Nowa rezerwacja myjni</h3>
            <form onSubmit={handleReservation} className="flex-col text-left">
              <label>Wybierz usługę:</label>
              <select value={selectedService} className="select-field" onChange={(e) => setSelectedService(e.target.value)} required>
                <option value="" disabled>-- Wybierz usługę --</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.type} - {s.price} zł (+{s.loyaltyPoints} pkt)</option>)}
              </select>
              <label className="mt-10">Data i godzina rezerwacji:</label>
              {/* NOWE: Zabezpieczenie frontendu (min=teraz) */}
              <input type="datetime-local" className="input-field" value={reservationDate} min={getMinDateTime()} onChange={(e) => setReservationDate(e.target.value)} required />
              <button type="submit" className="btn btn-success mt-10">Potwierdź rezerwację</button>
            </form>
          </div>
        )}

        {activeCustTab === 'resHistory' && (
          <div className="card card-gray mt-20">
            <h3 className="text-left">Moje rezerwacje</h3>
            {myReservations.length === 0 ? <p className="text-left">Brak historii rezerwacji.</p> : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>Data</th><th>Usługa</th><th>Status</th></tr></thead>
                    <tbody>
                      {myReservations.map((res: Reservation, idx) => (
                        <tr key={idx}>
                          <td>{new Date(res.date).toLocaleString()}</td>
                          <td>{res.washService.type}</td>
                          <td><span className="text-bold" style={{ color: getStatusColor(res.status) }}>{res.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '13px', color: '#6c757d', marginTop: '15px', textAlign: 'left', fontStyle: 'italic' }}>
                  W celu anulowania rezerwacji prosimy o kontakt telefoniczny z pracownikiem stacji.
                </p>
              </>
            )}
          </div>
        )}

        {activeCustTab === 'buyHistory' && (
          <div className="card card-info mt-20">
            <h3 className="text-left">Twoja historia zakupów (kasa POS)</h3>
            {myTransactions.length === 0 ? <p className="text-left">Brak historii zakupów na stacji.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Data</th><th>Produkt / Usługa</th><th>Kwota</th><th>Płatność</th></tr></thead>
                  <tbody>
                    {myTransactions.map((t: Transaction) => (
                      <tr key={t.id}>
                        <td>{new Date(t.date).toLocaleString()}</td>
                        <td>{t.items && t.items[0] ? t.items[0].product : 'Brak danych'}</td>
                        <td className="text-bold">{t.totalAmount.toFixed(2)} zł</td>
                        <td>{t.paymentMethod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* NOWA ZAKŁADKA KONTAKT */}
        {activeCustTab === 'contact' && (
          <div className="card card-light mt-20 text-left">
            <h3 style={{ marginTop: 0 }}>Kontakt z Myjnią PB</h3>
            <p style={{ color: '#495057' }}>Masz pytania lub chcesz anulować rezerwację? Skontaktuj się z nami!</p>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ced4da', marginTop: '15px' }}>
              <p style={{ margin: '5px 0' }}>📍 <strong>Adres:</strong> ul. Jana Pawła II 37, 31-864 Kraków</p>
              <p style={{ margin: '5px 0' }}>📞 <strong>Telefon:</strong> +48 123 456 789</p>
              <p style={{ margin: '5px 0' }}>✉️ <strong>E-mail:</strong> kontakt@myjniapb.pl</p>
            </div>
          </div>
        )}
        
        {renderMessage()}
      </div>
    );
  }

  // ==============================================
  // WIDOK 4: LOGOWANIE
  // ==============================================
  return (
    <div className="login-container">
      <div className="flex-space-around">
        <button onClick={() => { setLoginMode('customer'); setMessage(''); }} className={`btn-tab ${loginMode === 'customer' ? 'btn-success' : 'btn-light'}`}>Strefa Klienta</button>
        <button onClick={() => { setLoginMode('staff'); setMessage(''); }} className={`btn-tab ${loginMode === 'staff' ? 'btn-dark' : 'btn-light'}`}>Strefa Służbowa</button>
      </div>

      {loginMode === 'staff' ? (
        <form onSubmit={handleAuthSubmit} className="flex-col-sm">
          <h2>Logowanie Służbowe</h2>
          <input name="login" className="input-field" placeholder="Login pracownika lub właściciela" value={staffData.login} onChange={handleStaffChange} required />
          <input name="password" type="password" className="input-field" placeholder="Hasło" value={staffData.password} onChange={handleStaffChange} required />
          <button type="submit" className="btn btn-dark">Zaloguj do systemu</button>
        </form>
      ) : (
        <>
          <div className="flex-space-around">
            <button onClick={() => { setIsLogin(true); setMessage(''); }} className={`btn-tab ${isLogin ? 'btn-primary' : 'btn-light'}`}>Logowanie</button>
            <button onClick={() => { setIsLogin(false); setMessage(''); }} className={`btn-tab ${!isLogin ? 'btn-primary' : 'btn-light'}`}>Rejestracja</button>
          </div>
          <h2>{isLogin ? 'Zaloguj się' : 'Zarejestruj się'}</h2>
          <form onSubmit={handleAuthSubmit} className="flex-col-sm">
            {!isLogin && (
              <>
                <input name="firstName" className="input-field" placeholder="Imię" value={formData.firstName} onChange={handleCustomerChange} required />
                <input name="lastName" className="input-field" placeholder="Nazwisko" value={formData.lastName} onChange={handleCustomerChange} required />
                <input name="address" className="input-field" placeholder="Adres" value={formData.address} onChange={handleCustomerChange} required />
                <input name="phone" className="input-field" placeholder="Telefon" value={formData.phone} onChange={handleCustomerChange} required />
              </>
            )}
            <input name="email" type="email" className="input-field" placeholder="E-mail" value={formData.email} onChange={handleCustomerChange} required />
            <input name="password" type="password" className="input-field" placeholder="Hasło" value={formData.password} onChange={handleCustomerChange} required />
            <button type="submit" className="btn btn-success">{isLogin ? 'Zaloguj' : 'Załóż konto'}</button>
          </form>
        </>
      )}
      {renderMessage()}
    </div>
  );
}

export default App;