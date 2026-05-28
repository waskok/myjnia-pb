import { useState, useCallback, useEffect } from 'react';
import type { WashService, Reservation, Transaction, Fuel, Customer, Delivery, Employee, MonitoringData, ReportData, ReportPeriodType, ActiveCustTab, ScheduleMonthData } from '../types';
import { jsPDF } from 'jspdf';

type EmployeeJobRole = 'Kasjer' | 'Monitoring' | 'Obsługa Myjni' | 'Obsługa dystrybutora LPG';
type SessionRole = 'customer' | 'employee' | 'owner';
type StoredSession = {
  firstName: string;
  role: SessionRole;
  jobRole?: EmployeeJobRole;
};

type LoyaltyConfig = {
  pointsPerE95: number;
  pointsPerE98: number;
  pointsPerDiesel: number;
  pointsPerLpg: number;
};

type GeneratedInvoice = {
  number: string;
  issueDate: string;
  amount: number;
  paymentMethod: string;
  quantity: number;
  fuelType: string;
  unitPrice: number;
  buyer: {
    name: string;
    address: string;
    email: string;
    phone: string;
    type: 'individual' | 'company';
    identifiers: {
      pesel?: string;
      nip?: string;
      regon?: string;
    };
  };
};

export const useAppLogic = () => {
  const [message, setMessage] = useState('');
  const clearMessage = useCallback(() => setMessage(''), []);
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'employee' | 'owner' | null>(null);
  const [employeeJobRole, setEmployeeJobRole] = useState<EmployeeJobRole | null>(null);
  
  const [activeTab, setActiveTab] = useState<'cennik' | 'dostawy' | 'pracownicy' | 'klienci' | 'monitoring' | 'raporty' | 'grafik'>('cennik');
  const [activeEmpTab, setActiveEmpTab] = useState<'pos' | 'rezerwacje' | 'monitoring' | 'lpg' | 'grafik'>('pos');
  const [activeCustTab, setActiveCustTab] = useState<ActiveCustTab>('book');

  const [empResDateFilter, setEmpResDateFilter] = useState('');
  const [empResPhoneFilter, setEmpResPhoneFilter] = useState('');

  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    accountType: 'individual' as 'individual' | 'company',
    firstName: '',
    lastName: '',
    companyName: '',
    address: '',
    phone: '',
    email: '',
    password: '',
    pesel: '',
    nip: '',
    regon: '',
  });
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
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig>({
    pointsPerE95: 100,
    pointsPerE98: 100,
    pointsPerDiesel: 100,
    pointsPerLpg: 50
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', role: 'Kasjer', login: '', password: '', email: '', phone: '' });
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriodType>('all');
  const [reportDateStr, setReportDateStr] = useState<string>(new Date().toISOString().substring(0, 10));

  const now = new Date();
  const [scheduleYear, setScheduleYear] = useState(now.getFullYear());
  const [scheduleMonth, setScheduleMonth] = useState(now.getMonth() + 1);
  const [scheduleData, setScheduleData] = useState<ScheduleMonthData | null>(null);
  const [selectedScheduleDates, setSelectedScheduleDates] = useState<string[]>([]);
  const [scheduleEmployeeId, setScheduleEmployeeId] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('08:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('16:00');

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

  const toPdfText = (value: string) => {
    const polishMap: Record<string, string> = {
      ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
      Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
    };
    return value.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => polishMap[char] ?? char);
  };

  const downloadInvoicePdf = (invoice: GeneratedInvoice) => {
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Faktura VAT', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(toPdfText(`Numer: ${invoice.number}`), margin, y);
    y += 6;
    doc.text(toPdfText(`Data wystawienia: ${new Date(invoice.issueDate).toLocaleString('pl-PL')}`), margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Sprzedawca:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Myjnia PB', margin, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Nabywca:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(invoice.buyer.name), margin, y);
    y += 6;
    doc.text(toPdfText(invoice.buyer.address), margin, y);
    y += 6;
    doc.text(toPdfText(`Email: ${invoice.buyer.email}`), margin, y);
    y += 6;
    doc.text(toPdfText(`Telefon: ${invoice.buyer.phone}`), margin, y);
    y += 6;
    if (invoice.buyer.identifiers.pesel) {
      doc.text(`PESEL: ${invoice.buyer.identifiers.pesel}`, margin, y);
      y += 6;
    }
    if (invoice.buyer.identifiers.nip) {
      doc.text(`NIP: ${invoice.buyer.identifiers.nip}`, margin, y);
      y += 6;
    }
    if (invoice.buyer.identifiers.regon) {
      doc.text(`REGON: ${invoice.buyer.identifiers.regon}`, margin, y);
      y += 6;
    }

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Pozycja:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(toPdfText(`Paliwo ${invoice.fuelType}`), margin, y);
    y += 6;
    doc.text(`Ilosc: ${invoice.quantity.toFixed(2)} L`, margin, y);
    y += 6;
    doc.text(`Cena jednostkowa: ${invoice.unitPrice.toFixed(2)} PLN`, margin, y);
    y += 6;
    doc.text(`Metoda platnosci: ${toPdfText(invoice.paymentMethod)}`, margin, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Do zaplaty: ${invoice.amount.toFixed(2)} PLN`, margin, y);

    doc.save(`${invoice.number.replace(/[\\/]/g, '-')}.pdf`);
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
  const fetchEmployees = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/owner/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = (await res.json()) as Array<Employee & { isActive?: boolean | null }>;
        setEmployees(
          data.map((employee) => ({
            ...employee,
            // Backward compatibility for responses without isActive.
            isActive: employee.isActive !== false,
          }))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };
  const fetchCustomers = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/owner/customers', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setCustomers(await res.json()); } catch (e) { console.error(e); } };
  const fetchLoyaltyConfig = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/owner/loyalty-config', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setLoyaltyConfig(await res.json()); } catch (e) { console.error(e); } };
  const fetchMonitoring = async () => { const token = localStorage.getItem('token'); if (!token) return; try { const res = await fetch('http://localhost:5000/api/monitoring', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setMonitoringData(await res.json()); } catch (e) { console.error(e); } };

  const fetchSchedule = async (year = scheduleYear, month = scheduleMonth) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const schedulePath =
      userRole === 'employee' ? '/api/employee/schedule' : '/api/owner/schedule';
    try {
      const res = await fetch(
        `http://localhost:5000${schedulePath}?year=${year}&month=${month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.ok) {
        setScheduleData(data);
        setScheduleYear(data.year);
        setScheduleMonth(data.month);
      } else {
        setMessage('❌ ' + (data.error || 'Błąd pobierania grafiku.'));
      }
    } catch (e) {
      console.error(e);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  const changeScheduleMonth = (delta: number) => {
    let y = scheduleYear;
    let m = scheduleMonth + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setScheduleYear(y);
    setScheduleMonth(m);
    setSelectedScheduleDates([]);
    fetchSchedule(y, m);
  };

  const handleScheduleMonthInput = (val: string) => {
    if (!val) return;
    const [y, m] = val.split('-').map(Number);
    if (!y || !m) return;
    setScheduleYear(y);
    setScheduleMonth(m);
    setSelectedScheduleDates([]);
    fetchSchedule(y, m);
  };

  const toggleScheduleDate = (dateStr: string) => {
    setSelectedScheduleDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;
    if (!scheduleEmployeeId) {
      setMessage('❌ Wybierz pracownika.');
      return;
    }
    if (selectedScheduleDates.length === 0) {
      setMessage('❌ Zaznacz co najmniej jeden dzień w kalendarzu.');
      return;
    }
    if (scheduleEndTime <= scheduleStartTime) {
      setMessage('❌ Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/owner/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeId: Number(scheduleEmployeeId),
          startTime: scheduleStartTime,
          endTime: scheduleEndTime,
          dates: selectedScheduleDates,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ ' + data.message);
        setSelectedScheduleDates([]);
        fetchSchedule();
      } else {
        setMessage('❌ ' + (data.error || 'Błąd zapisu grafiku.'));
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  const handleDeleteScheduleEntry = async (id: number) => {
    if (!window.confirm('Usunąć ten wpis z grafiku?')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:5000/api/owner/schedule/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ ' + (data.message || 'Usunięto wpis.'));
        fetchSchedule();
      } else {
        setMessage('❌ ' + (data.error || 'Błąd usuwania.'));
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

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
          const resolvedRole = (data.user.role || 'customer') as SessionRole;
          localStorage.setItem('token', data.token);
          const sessionPayload: StoredSession = {
            firstName: data.user.firstName,
            role: resolvedRole,
            jobRole: resolvedRole === 'employee' ? (data.user.jobRole as EmployeeJobRole) : undefined
          };
          localStorage.setItem('sessionUser', JSON.stringify(sessionPayload));
          setLoggedInUser(data.user.firstName);
          setUserRole(resolvedRole);
          setEmployeeJobRole(resolvedRole === 'employee' ? (data.user.jobRole as EmployeeJobRole) : null);
          if (resolvedRole === 'owner') { 
            setActiveTab('cennik');
            fetchFuels(); fetchDeliveries(data.token); fetchEmployees(data.token); fetchCustomers(data.token); fetchLoyaltyConfig(data.token);
          } else if (resolvedRole === 'employee') { 
            const role = data.user.jobRole as EmployeeJobRole;
            if (role === 'Kasjer') {
              setActiveEmpTab('pos');
              fetchFuels();
            } else if (role === 'Monitoring') {
              setActiveEmpTab('monitoring');
              fetchMonitoring();
            } else if (role === 'Obsługa dystrybutora LPG') {
              setActiveEmpTab('lpg');
              fetchMonitoring();
            } else {
              setActiveEmpTab('rezerwacje');
              fetchAllReservations(data.token);
            }
          } else { fetchCustomerData(data.token); }
        } else {
          setIsLogin(true);
          setFormData({
            accountType: 'individual',
            firstName: '',
            lastName: '',
            companyName: '',
            address: '',
            phone: '',
            email: formData.email,
            password: '',
            pesel: '',
            nip: '',
            regon: '',
          });
        }
      } else setMessage('❌ ' + data.error);
    } catch (e) { console.error(e); setMessage('❌ Błąd połączenia z serwerem!'); }
  };

  const handleVerifyCustomer = async () => { if (!posCustomerQuery) return; try { const token = localStorage.getItem('token'); const res = await fetch(`http://localhost:5000/api/employee/customer/${encodeURIComponent(posCustomerQuery)}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (res.ok) { setPosVerifiedCustomer(data); setPosData({ ...posData, customerEmail: data.email }); setMessage('✅ Zweryfikowano!'); } else { setPosVerifiedCustomer(null); setPosData({ ...posData, customerEmail: '' }); setMessage('❌ ' + data.error); } } catch (e) { console.error(e); } };
  const handlePOSSubmit = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; if (posData.issueInvoice && !posVerifiedCustomer) { setMessage('❌ Aby wystawić fakturę, najpierw zweryfikuj klienta (e-mail lub telefon).'); return; } const res = await fetch('http://localhost:5000/api/transactions/fuel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(posData) }); const data = await res.json(); if (res.ok) { if (data.invoice) { downloadInvoicePdf(data.invoice as GeneratedInvoice); } setMessage('✅ ' + data.message); setPosData({ fuelId: posData.fuelId, quantity: 1, customerEmail: '', paymentMethod: 'Karta', issueInvoice: false }); setPosVerifiedCustomer(null); setPosCustomerQuery(''); fetchFuels(); } else setMessage('❌ ' + data.error); } catch (e) { console.error(e); } };
  const handleReservation = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, washServiceId: selectedService, date: reservationDate }) }); const data = await res.json(); if (res.ok) { setMessage('✅ ' + data.message); setReservationDate(''); fetchCustomerData(token); } else { setMessage('❌ ' + data.error); } } catch (e) { console.error(e); } };
  const handleCompleteReservation = async (id: number) => { try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/employee/reservations/${id}/complete`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Zakończono!'); fetchAllReservations(token); } } catch (e) { console.error(e); } };
  const handleCancelReservation = async (id: number) => { if (!window.confirm('Czy na pewno chcesz anulować tę rezerwację?')) return; try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/employee/reservations/${id}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Rezerwacja anulowana!'); fetchAllReservations(token); } } catch (e) { console.error(e); } };
  const handleOrderDelivery = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/owner/deliveries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newDelivery) }); if (res.ok) { setMessage('✅ Zlecono!'); fetchDeliveries(token); setNewDelivery({...newDelivery, deliveryDate: '', supplier: ''}); } } catch (e) { console.error(e); } };
  const handleCompleteDelivery = async (id: number) => { try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/owner/deliveries/${id}/complete`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Odebrano!'); fetchDeliveries(token); fetchFuels(); } } catch (e) { console.error(e); } };
  const handleUpdatePrice = async (id: number) => { if (!newPrice[id]) return; try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/owner/fuels/${id}/price`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ price: newPrice[id] }) }); if (res.ok) { setMessage('✅ Zmieniono!'); fetchFuels(); setNewPrice({ ...newPrice, [id]: 0 }); } } catch (e) { console.error(e); } };
  const handleLoyaltyConfigChange = (key: keyof LoyaltyConfig, value: number) => {
    setLoyaltyConfig((prev) => ({ ...prev, [key]: value }));
  };
  const handleSaveLoyaltyConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const payload = {
        pointsPerE95: Math.max(0, Math.floor(loyaltyConfig.pointsPerE95 || 0)),
        pointsPerE98: Math.max(0, Math.floor(loyaltyConfig.pointsPerE98 || 0)),
        pointsPerDiesel: Math.max(0, Math.floor(loyaltyConfig.pointsPerDiesel || 0)),
        pointsPerLpg: Math.max(0, Math.floor(loyaltyConfig.pointsPerLpg || 0))
      };
      const res = await fetch('http://localhost:5000/api/owner/loyalty-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setLoyaltyConfig({
          pointsPerE95: data.pointsPerE95,
          pointsPerE98: data.pointsPerE98,
          pointsPerDiesel: data.pointsPerDiesel,
          pointsPerLpg: data.pointsPerLpg
        });
        setMessage('✅ Zaktualizowano stawki punktów.');
      } else {
        setMessage('❌ ' + (data.error || 'Nie udało się zaktualizować stawek punktów.'));
      }
    } catch (e) {
      console.error(e);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };
  const handleAddEmployee = async (e: React.FormEvent) => { e.preventDefault(); const token = localStorage.getItem('token'); try { const res = await fetch('http://localhost:5000/api/owner/employees', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newEmployee) }); if (res.ok) { setMessage('✅ Dodano!'); setNewEmployee({ firstName: '', lastName: '', role: 'Kasjer', login: '', password: '', email: '', phone: '' }); if(token) fetchEmployees(token); } else { const err = await res.json(); setMessage('❌ ' + err.error); } } catch (e) { console.error(e); } };
  const handleChangeEmployeeLogin = async (id: number, currentLogin: string) => {
    const newLogin = window.prompt('Nowy login pracownika:', currentLogin)?.trim();
    if (!newLogin || newLogin === currentLogin) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:5000/api/owner/employees/${id}/login`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ login: newLogin })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ ' + (data.message || 'Zmieniono login.'));
        if (token) fetchEmployees(token);
      } else {
        setMessage('❌ ' + (data.error || 'Nie udało się zmienić loginu.'));
      }
    } catch (e) {
      console.error(e);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };
  const handleChangeEmployeePassword = async (id: number) => {
    const newPassword = window.prompt('Nowe hasło pracownika (min. 6 znaków):')?.trim();
    if (!newPassword) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:5000/api/owner/employees/${id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ ' + (data.message || 'Zmieniono hasło.'));
      } else {
        setMessage('❌ ' + (data.error || 'Nie udało się zmienić hasła.'));
      }
    } catch (e) {
      console.error(e);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };
  const handleArchiveEmployee = async (id: number) => {
    if (!window.confirm('Przenieść pracownika do archiwum?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:5000/api/owner/employees/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ ' + (data.message || 'Pracownik zarchiwizowany.'));
        if (token) fetchEmployees(token);
      } else {
        setMessage('❌ ' + (data.error || 'Nie udało się zarchiwizować pracownika.'));
      }
    } catch (e) {
      console.error(e);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };
  const handleRestoreEmployee = async (id: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:5000/api/owner/employees/${id}/restore`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ ' + (data.message || 'Pracownik przywrócony.'));
        if (token) fetchEmployees(token);
      } else {
        setMessage('❌ ' + (data.error || 'Nie udało się przywrócić pracownika.'));
      }
    } catch (e) {
      console.error(e);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };
  const handleDeleteEmployee = async (id: number) => {
    if (!window.confirm('Usunąć?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:5000/api/owner/employees/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        if (token) fetchEmployees(token);
        setMessage('✅ Usunięto.');
      } else {
        const err = await res.json();
        setMessage('❌ ' + (err.error || 'Nie udało się usunąć pracownika.'));
      }
    } catch (e) {
      console.error(e);
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const sessionRaw = localStorage.getItem('sessionUser');
    if (!token || !sessionRaw) return;

    try {
      const session = JSON.parse(sessionRaw) as StoredSession;
      if (!session.firstName || !session.role) return;

      setLoggedInUser(session.firstName);
      setUserRole(session.role);
      setEmployeeJobRole(session.role === 'employee' ? (session.jobRole || null) : null);

      if (session.role === 'owner') {
        setActiveTab('cennik');
        fetchFuels();
        fetchDeliveries(token);
        fetchEmployees(token);
        fetchCustomers(token);
        fetchLoyaltyConfig(token);
        } else if (session.role === 'employee') {
        const role = session.jobRole;
        if (role === 'Kasjer') {
          setActiveEmpTab('pos');
          fetchFuels();
        } else if (role === 'Monitoring') {
          setActiveEmpTab('monitoring');
          fetchMonitoring();
          } else if (role === 'Obsługa dystrybutora LPG') {
            setActiveEmpTab('lpg');
            fetchMonitoring();
        } else if (role === 'Obsługa Myjni') {
          setActiveEmpTab('rezerwacje');
          fetchAllReservations(token);
        } else {
          setActiveEmpTab('grafik');
        }
      } else if (session.role === 'customer') {
        fetchCustomerData(token);
      }
    } catch (error) {
      console.error(error);
      localStorage.removeItem('token');
      localStorage.removeItem('sessionUser');
    }
  }, []);

  const handleDateChange = (val: string) => {
    let fullDate = val;
    if (val.length === 7) fullDate = `${val}-01`;
    if (val.length === 4) fullDate = `${val}-01-01`;
    setReportDateStr(fullDate);
    fetchReports(reportPeriod, fullDate);
  };

  const logout = () => { localStorage.clear(); setLoggedInUser(null); setUserRole(null); setEmployeeJobRole(null); setMessage(''); setStaffData({ login: '', password: '' }); };

  return { message, clearMessage, loggedInUser, userRole, employeeJobRole, activeTab, setActiveTab, activeEmpTab, setActiveEmpTab, activeCustTab, setActiveCustTab, empResDateFilter, setEmpResDateFilter, empResPhoneFilter, setEmpResPhoneFilter, isLogin, setIsLogin, formData, loginMode, setLoginMode, staffData, services, selectedService, setSelectedService, reservationDate, setReservationDate, myReservations, loyaltyPoints, myTransactions, allReservations, fuels, posData, setPosData, posCustomerQuery, setPosCustomerQuery, posVerifiedCustomer, deliveries, newDelivery, newPrice, setNewPrice, loyaltyConfig, employees, customers, newEmployee, setNewEmployee, monitoringData, reportData, reportPeriod, setReportPeriod, reportDateStr, scheduleYear, scheduleMonth, scheduleData, selectedScheduleDates, scheduleEmployeeId, setScheduleEmployeeId, scheduleStartTime, setScheduleStartTime, scheduleEndTime, setScheduleEndTime, getMinDateTime, getStatusColor, handleCustomerChange, handleStaffChange, handleDeliveryChange, handlePosChange, handleAuthSubmit, handleVerifyCustomer, handlePOSSubmit, handleReservation, handleCompleteReservation, handleCancelReservation, handleOrderDelivery, handleCompleteDelivery, handleUpdatePrice, handleLoyaltyConfigChange, handleSaveLoyaltyConfig, handleAddEmployee, handleChangeEmployeeLogin, handleChangeEmployeePassword, handleArchiveEmployee, handleRestoreEmployee, handleDeleteEmployee, handleDateChange, fetchMonitoring, fetchReports, fetchSchedule, changeScheduleMonth, handleScheduleMonthInput, toggleScheduleDate, handleSaveSchedule, handleDeleteScheduleEntry, setSelectedScheduleDates, logout };
};
export type AppLogic = ReturnType<typeof useAppLogic>;