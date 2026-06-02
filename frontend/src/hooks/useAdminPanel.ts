import { useState } from 'react';
import { api } from '../utils/apiClient';
import type {
  Fuel,
  WashService,
  Employee,
  Customer,
  Delivery,
  ReportData,
  WashReportData,
  MonitoringReportData,
  ReportPeriodType,
  OwnerReportKind,
} from '../types';

type LoyaltyConfig = {
  pointsPerE95: number;
  pointsPerE98: number;
  pointsPerDiesel: number;
  pointsPerLpg: number;
  pointsPerStandardWash: number;
  pointsPerWaxWash: number;
  earnPointsPerE95: number;
  earnPointsPerE98: number;
  earnPointsPerDiesel: number;
  earnPointsPerLpg: number;
  earnPointsPerStandardWash: number;
  earnPointsPerWaxWash: number;
};

export const useAdminPanel = (
  setMessage: (msg: string) => void,
  setSharedFuels: (fuels: Fuel[]) => void,
  setSharedServices: (services: WashService[]) => void,
) => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [newDelivery, setNewDelivery] = useState({
    fuelId: '',
    quantity: 1000,
    supplier: '',
    deliveryDate: '',
  });
  const [newPrice, setNewPrice] = useState<{ [key: number]: number }>({});
  const [newServicePrice, setNewServicePrice] = useState<{ [key: number]: number }>({});
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig>({
    pointsPerE95: 100,
    pointsPerE98: 100,
    pointsPerDiesel: 100,
    pointsPerLpg: 50,
    pointsPerStandardWash: 300,
    pointsPerWaxWash: 400,
    earnPointsPerE95: 2,
    earnPointsPerE98: 2,
    earnPointsPerDiesel: 2,
    earnPointsPerLpg: 1,
    earnPointsPerStandardWash: 5,
    earnPointsPerWaxWash: 10,
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    role: 'Kasjer',
    login: '',
    password: '',
    email: '',
    phone: '',
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [washReportData, setWashReportData] = useState<WashReportData | null>(null);
  const [monitoringReportData, setMonitoringReportData] = useState<MonitoringReportData | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriodType>('all');
  const [reportDateStr, setReportDateStr] = useState<string>(
    new Date().toISOString().substring(0, 10),
  );
  const [activeTab, setActiveTab] = useState<
    'cennik' | 'dostawy' | 'pracownicy' | 'klienci' | 'monitoring' | 'raporty' | 'grafik'
  >('cennik');

  const fetchFuels = async () => {
    const res = await api.get('/api/fuels');
    if (!res.ok) return;
    const data = (await res.json()) as Fuel[];
    setSharedFuels(data);
    if (data.length > 0 && data[0]) {
      setNewDelivery((prev) => ({ ...prev, fuelId: String(data[0]!.id) }));
    }
  };

  const fetchServices = async () => {
    const res = await api.get('/api/services');
    if (res.ok) setSharedServices((await res.json()) as WashService[]);
  };

  const fetchDeliveries = async () => {
    const res = await api.get('/api/owner/deliveries');
    if (res.ok) setDeliveries((await res.json()) as Delivery[]);
  };

  const fetchEmployees = async () => {
    const res = await api.get('/api/owner/employees');
    if (res.ok) {
      const data = (await res.json()) as Array<Employee & { isActive?: boolean | null }>;
      setEmployees(data.map((emp) => ({ ...emp, isActive: emp.isActive !== false })));
    }
  };

  const fetchCustomers = async () => {
    const res = await api.get('/api/owner/customers');
    if (res.ok) setCustomers((await res.json()) as Customer[]);
  };

  const fetchLoyaltyConfig = async () => {
    const res = await api.get('/api/owner/loyalty-config');
    if (res.ok) setLoyaltyConfig((await res.json()) as LoyaltyConfig);
  };

  const fetchReports = async (period = reportPeriod, dateVal = reportDateStr) => {
    const query = period !== 'all' ? `?period=${period}&date=${dateVal}` : '';
    const res = await api.get(`/api/owner/reports${query}`);
    if (res.ok) setReportData((await res.json()) as ReportData);
  };

  const fetchWashReports = async (period = reportPeriod, dateVal = reportDateStr) => {
    const query = period !== 'all' ? `?period=${period}&date=${dateVal}` : '';
    const res = await api.get(`/api/owner/reports/wash${query}`);
    if (res.ok) setWashReportData((await res.json()) as WashReportData);
  };

  const fetchMonitoringReports = async (period = reportPeriod, dateVal = reportDateStr) => {
    const query = period !== 'all' ? `?period=${period}&date=${dateVal}` : '';
    const res = await api.get(`/api/owner/reports/monitoring${query}`);
    if (res.ok) setMonitoringReportData((await res.json()) as MonitoringReportData);
  };

  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewDelivery((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleOrderDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(newDelivery.deliveryDate).getTime() < Date.now()) {
      setMessage('❌ Nie można zlecić dostawy na datę z przeszłości.');
      return;
    }
    const res = await api.post('/api/owner/deliveries', newDelivery);
    if (res.ok) {
      setMessage('✅ Zlecono!');
      await fetchDeliveries();
      setNewDelivery((prev) => ({ ...prev, deliveryDate: '', supplier: '' }));
    } else {
      const data = (await res.json()) as { error?: string };
      setMessage('❌ ' + (data.error ?? 'Błąd zlecania dostawy.'));
    }
  };

  const handleCompleteDelivery = async (id: number) => {
    const res = await api.patch(`/api/owner/deliveries/${id}/complete`);
    if (res.ok) {
      setMessage('✅ Odebrano!');
      await Promise.all([fetchDeliveries(), fetchFuels()]);
    }
  };

  const handleUpdatePrice = async (id: number) => {
    if (!newPrice[id]) return;
    const res = await api.patch(`/api/owner/fuels/${id}/price`, { price: newPrice[id] });
    if (res.ok) {
      setMessage('✅ Zmieniono!');
      await fetchFuels();
      setNewPrice((prev) => ({ ...prev, [id]: 0 }));
    }
  };

  const handleUpdateServicePrice = async (id: number) => {
    if (!newServicePrice[id]) return;
    const res = await api.patch(`/api/owner/services/${id}/price`, { price: newServicePrice[id] });
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setMessage('✅ ' + (data.message ?? 'Zmieniono cenę usługi.'));
      await fetchServices();
      setNewServicePrice((prev) => ({ ...prev, [id]: 0 }));
    } else {
      setMessage('❌ ' + (data.error ?? 'Nie udało się zmienić ceny usługi.'));
    }
  };

  const handleLoyaltyConfigChange = (key: keyof LoyaltyConfig, value: number) => {
    setLoyaltyConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveLoyaltyConfig = async () => {
    const payload = Object.fromEntries(
      Object.entries(loyaltyConfig).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]),
    );
    const res = await api.patch('/api/owner/loyalty-config', payload);
    const data = (await res.json()) as LoyaltyConfig & { message?: string; error?: string };
    if (res.ok) {
      setLoyaltyConfig({
        pointsPerE95: data.pointsPerE95,
        pointsPerE98: data.pointsPerE98,
        pointsPerDiesel: data.pointsPerDiesel,
        pointsPerLpg: data.pointsPerLpg,
        pointsPerStandardWash: data.pointsPerStandardWash,
        pointsPerWaxWash: data.pointsPerWaxWash,
        earnPointsPerE95: data.earnPointsPerE95,
        earnPointsPerE98: data.earnPointsPerE98,
        earnPointsPerDiesel: data.earnPointsPerDiesel,
        earnPointsPerLpg: data.earnPointsPerLpg,
        earnPointsPerStandardWash: data.earnPointsPerStandardWash,
        earnPointsPerWaxWash: data.earnPointsPerWaxWash,
      });
      setMessage('✅ Zaktualizowano stawki punktów.');
    } else {
      setMessage('❌ ' + (data.error ?? 'Nie udało się zaktualizować stawek punktów.'));
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.post('/api/owner/employees', newEmployee);
    if (res.ok) {
      setMessage('✅ Dodano!');
      setNewEmployee({ firstName: '', lastName: '', role: 'Kasjer', login: '', password: '', email: '', phone: '' });
      await fetchEmployees();
    } else {
      const err = (await res.json()) as { error?: string };
      setMessage('❌ ' + (err.error ?? 'Błąd dodawania pracownika.'));
    }
  };

  const handleChangeEmployeeLogin = async (id: number, currentLogin: string) => {
    const newLogin = window.prompt('Nowy login pracownika:', currentLogin)?.trim();
    if (!newLogin || newLogin === currentLogin) return;
    const res = await api.patch(`/api/owner/employees/${id}/login`, { login: newLogin });
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setMessage('✅ ' + (data.message ?? 'Zmieniono login.'));
      await fetchEmployees();
    } else {
      setMessage('❌ ' + (data.error ?? 'Nie udało się zmienić loginu.'));
    }
  };

  const handleChangeEmployeePassword = async (id: number) => {
    const newPassword = window.prompt('Nowe hasło pracownika (min. 8 znaków):')?.trim();
    if (!newPassword) return;
    const res = await api.patch(`/api/owner/employees/${id}/password`, { password: newPassword });
    const data = (await res.json()) as { message?: string; error?: string };
    setMessage(res.ok ? '✅ ' + (data.message ?? 'Zmieniono hasło.') : '❌ ' + (data.error ?? 'Błąd zmiany hasła.'));
  };

  const handleArchiveEmployee = async (id: number) => {
    if (!window.confirm('Przenieść pracownika do archiwum?')) return;
    const res = await api.patch(`/api/owner/employees/${id}/archive`);
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setMessage('✅ ' + (data.message ?? 'Pracownik zarchiwizowany.'));
      await fetchEmployees();
    } else {
      setMessage('❌ ' + (data.error ?? 'Nie udało się zarchiwizować pracownika.'));
    }
  };

  const handleRestoreEmployee = async (id: number) => {
    const res = await api.patch(`/api/owner/employees/${id}/restore`);
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setMessage('✅ ' + (data.message ?? 'Pracownik przywrócony.'));
      await fetchEmployees();
    } else {
      setMessage('❌ ' + (data.error ?? 'Nie udało się przywrócić pracownika.'));
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    if (!window.confirm('Usunąć?')) return;
    const res = await api.delete(`/api/owner/employees/${id}`);
    if (res.ok) {
      setMessage('✅ Usunięto.');
      await fetchEmployees();
    } else {
      const err = (await res.json()) as { error?: string };
      setMessage('❌ ' + (err.error ?? 'Nie udało się usunąć pracownika.'));
    }
  };

  const handleDateChange = (val: string, kind: OwnerReportKind = 'sales') => {
    let fullDate = val;
    if (val.length === 7) fullDate = `${val}-01`;
    if (val.length === 4) fullDate = `${val}-01-01`;
    setReportDateStr(fullDate);
    if (kind === 'sales') void fetchReports(reportPeriod, fullDate);
    if (kind === 'wash') void fetchWashReports(reportPeriod, fullDate);
    if (kind === 'monitoring') void fetchMonitoringReports(reportPeriod, fullDate);
  };

  return {
    deliveries,
    newDelivery,
    newPrice,
    setNewPrice,
    newServicePrice,
    setNewServicePrice,
    loyaltyConfig,
    employees,
    customers,
    newEmployee,
    setNewEmployee,
    reportData,
    washReportData,
    monitoringReportData,
    reportPeriod,
    setReportPeriod,
    reportDateStr,
    activeTab,
    setActiveTab,
    fetchFuels,
    fetchServices,
    fetchDeliveries,
    fetchEmployees,
    fetchCustomers,
    fetchLoyaltyConfig,
    fetchReports,
    fetchWashReports,
    fetchMonitoringReports,
    handleDeliveryChange,
    handleOrderDelivery,
    handleCompleteDelivery,
    handleUpdatePrice,
    handleUpdateServicePrice,
    handleLoyaltyConfigChange,
    handleSaveLoyaltyConfig,
    handleAddEmployee,
    handleChangeEmployeeLogin,
    handleChangeEmployeePassword,
    handleArchiveEmployee,
    handleRestoreEmployee,
    handleDeleteEmployee,
    handleDateChange,
  };
};
