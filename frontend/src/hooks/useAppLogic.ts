import { useState } from 'react';
import type { WashService, Reservation, Transaction, Fuel, Customer, Delivery, Employee, MonitoringData, ReportData, ReportPeriodType, ActiveCustTab } from '../types';

export const useAppLogic = () => {
  const [message, setMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'employee' | 'owner' | null>(null);
  
  const [activeTab, setActiveTab] = useState<'paliwa' | 'pracownicy' | 'klienci' | 'monitoring' | 'raporty'>('paliwa');
  const [activeEmpTab, setActiveEmpTab] = useState<'pos' | 'rezerwacje' | 'monitoring'>('pos');
  const [activeCustTab, setActiveCustTab] = useState<ActiveCustTab>('book');

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

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Zakończona') return '#28a745'; 
    if (status === 'Anulowana') return '#dc3545';  
    if (status === 'Oczekująca') return '#ffc107'; 
    return '#334155';
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleStaffChange = (e: React.ChangeEvent<HTMLInputElement>) => setStaffData({ ...staffData, [e.target.name]: e.target.value });
  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNewDelivery({ ...newDelivery, [e.target.name]: e.target.value });
  const handlePosChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') setPosData({ ...posData, [name]: (e.target as HTMLInputElement).checked });
    else setPosData({ ...posData, [name]: value });
  };

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
      if (profRes.ok) { const profData = await profRes.json(); setLoyaltyPoints(profData.loyaltyPoints); }
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
      if (period !== 'all') url += `?period=${period}&date=${dateVal}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setReportData(await res.json());
    } catch (e) { console.error(e); }
  };

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
          } else { fetchCustomerData(data.token); }
        } else { setIsLogin(true); setFormData({ ...formData, password: '' }); }
      } else setMessage('❌ ' + data.error);
    } catch (e) { console.error(e); setMessage('❌ Błąd połączenia z serwerem!'); }
  };

  const handleVerifyCustomer = async () => { if (!posCustomerQuery) return; try { const token = localStorage.getItem('token'); const res = await fetch(`http://localhost:5000/api/employee/customer/${encodeURIComponent(posCustomerQuery)}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (res.ok) { setPosVerifiedCustomer(data); setPosData({ ...posData, customerEmail: data.email }); setMessage('✅ Zweryfikowano!'); } else { setPosVerifiedCustomer(null); setPosData({ ...posData, customerEmail: '' }); setMessage('❌ ' + data.error); } } catch (e) { console.error(e); } };
  const handlePOSSubmit = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/transactions/fuel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(posData) }); const data = await res.json(); if (res.ok) { setMessage('✅ ' + data.message); setPosData({ fuelId: posData.fuelId, quantity: 1, customerEmail: '', paymentMethod: 'Karta', issueInvoice: false }); setPosVerifiedCustomer(null); setPosCustomerQuery(''); fetchFuels(); } else setMessage('❌ ' + data.error); } catch (e) { console.error(e); } };
  const handleReservation = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, washServiceId: selectedService, date: reservationDate }) }); const data = await res.json(); if (res.ok) { setMessage('✅ ' + data.message); setReservationDate(''); fetchCustomerData(token); } else { setMessage('❌ ' + data.error); } } catch (e) { console.error(e); } };
  const handleCompleteReservation = async (id: number) => { try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/employee/reservations/${id}/complete`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Zakończono!'); fetchAllReservations(token); } } catch (e) { console.error(e); } };
  const handleCancelReservation = async (id: number) => { if (!window.confirm('Czy na pewno chcesz anulować tę rezerwację?')) return; try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/employee/reservations/${id}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Rezerwacja anulowana!'); fetchAllReservations(token); } } catch (e) { console.error(e); } };
  const handleOrderDelivery = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/owner/deliveries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newDelivery) }); if (res.ok) { setMessage('✅ Zlecono!'); fetchDeliveries(token); setNewDelivery({...newDelivery, deliveryDate: '', supplier: ''}); } } catch (e) { console.error(e); } };
  const handleCompleteDelivery = async (id: number) => { try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/owner/deliveries/${id}/complete`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Odebrano!'); fetchDeliveries(token); fetchFuels(); } } catch (e) { console.error(e); } };
  const handleUpdatePrice = async (id: number) => { if (!newPrice[id]) return; try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/owner/fuels/${id}/price`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ price: newPrice[id] }) }); if (res.ok) { setMessage('✅ Zmieniono!'); fetchFuels(); setNewPrice({ ...newPrice, [id]: 0 }); } } catch (e) { console.error(e); } };
  const handleAddEmployee = async (e: React.FormEvent) => { e.preventDefault(); const token = localStorage.getItem('token'); try { const res = await fetch('http://localhost:5000/api/owner/employees', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newEmployee) }); if (res.ok) { setMessage('✅ Dodano!'); setNewEmployee({ firstName: '', lastName: '', role: 'Kasjer', login: '', password: '', email: '', phone: '' }); if(token) fetchEmployees(token); } else { const err = await res.json(); setMessage('❌ ' + err.error); } } catch (e) { console.error(e); } };
  const handleDeleteEmployee = async (id: number) => { if (!window.confirm('Usunąć?')) return; const token = localStorage.getItem('token'); try { const res = await fetch(`http://localhost:5000/api/owner/employees/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { if(token) fetchEmployees(token); setMessage('✅ Usunięto.'); } } catch (e) { console.error(e); } };

  const handleDateChange = (val: string) => {
    let fullDate = val;
    if (val.length === 7) fullDate = `${val}-01`;
    if (val.length === 4) fullDate = `${val}-01-01`;
    setReportDateStr(fullDate);
    fetchReports(reportPeriod, fullDate);
  };

  const logout = () => { localStorage.clear(); setLoggedInUser(null); setUserRole(null); setMessage(''); setStaffData({ login: '', password: '' }); };

  return { message, loggedInUser, userRole, activeTab, setActiveTab, activeEmpTab, setActiveEmpTab, activeCustTab, setActiveCustTab, empResDateFilter, setEmpResDateFilter, empResPhoneFilter, setEmpResPhoneFilter, isLogin, setIsLogin, formData, loginMode, setLoginMode, staffData, services, selectedService, setSelectedService, reservationDate, setReservationDate, myReservations, loyaltyPoints, myTransactions, allReservations, fuels, posData, setPosData, posCustomerQuery, setPosCustomerQuery, posVerifiedCustomer, deliveries, newDelivery, newPrice, setNewPrice, employees, customers, newEmployee, setNewEmployee, monitoringData, reportData, reportPeriod, setReportPeriod, reportDateStr, getMinDateTime, getStatusColor, handleCustomerChange, handleStaffChange, handleDeliveryChange, handlePosChange, handleAuthSubmit, handleVerifyCustomer, handlePOSSubmit, handleReservation, handleCompleteReservation, handleCancelReservation, handleOrderDelivery, handleCompleteDelivery, handleUpdatePrice, handleAddEmployee, handleDeleteEmployee, handleDateChange, fetchMonitoring, fetchReports, logout };
};
export type AppLogic = ReturnType<typeof useAppLogic>;