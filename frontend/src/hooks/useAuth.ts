import { useState, useEffect } from 'react';
import { api } from '../utils/apiClient';

type EmployeeJobRole = 'Kasjer' | 'Monitoring' | 'Obsługa Myjni' | 'Obsługa dystrybutora LPG';
type SessionRole = 'customer' | 'employee' | 'owner';

interface MeResponse {
  firstName: string;
  lastName?: string;
  role: SessionRole;
  jobRole?: EmployeeJobRole;
}

interface AuthFormData {
  accountType: 'individual' | 'company';
  firstName: string;
  lastName: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  pesel: string;
  nip: string;
  regon: string;
}

export const useAuth = (setMessage: (msg: string) => void) => {
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [loggedInUserLastInitial, setLoggedInUserLastInitial] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<SessionRole | null>(null);
  const [employeeJobRole, setEmployeeJobRole] = useState<EmployeeJobRole | null>(null);

  const [isLogin, setIsLogin] = useState(true);
  const [loginMode, setLoginMode] = useState<'customer' | 'staff'>('customer');
  const [formData, setFormData] = useState<AuthFormData>({
    accountType: 'individual',
    firstName: '',
    lastName: '',
    companyName: '',
    address: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    pesel: '',
    nip: '',
    regon: '',
  });
  const [staffData, setStaffData] = useState({ login: '', password: '' });

  const applySession = (data: MeResponse) => {
    setLoggedInUser(data.firstName);
    setLoggedInUserLastInitial(
      typeof data.lastName === 'string' && data.lastName.length > 0
        ? data.lastName.charAt(0).toUpperCase()
        : null,
    );
    setUserRole(data.role);
    setEmployeeJobRole(data.role === 'employee' ? (data.jobRole ?? null) : null);
  };

  useEffect(() => {
    api.get('/api/me').then(async (res) => {
      if (res.ok) applySession((await res.json()) as MeResponse);
    }).catch(() => {});
  }, []);

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData((prev) => ({ ...prev, phone: value.replace(/\D/g, '').slice(0, 9) }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStaffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStaffData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loginMode === 'customer' && !isLogin) {
      if (formData.password.length < 8) {
        setMessage('❌ Hasło musi mieć minimum 8 znaków.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setMessage('❌ Hasła muszą być takie same.');
        return;
      }
      const payload = { ...formData, confirmPassword: undefined };
      const res = await api.post('/api/register', payload);
      const data = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setMessage('✅ Zarejestrowano pomyślnie! Możesz się teraz zalogować.');
        setIsLogin(true);
        setFormData((prev) => ({
          accountType: 'individual',
          firstName: '',
          lastName: '',
          companyName: '',
          address: '',
          phone: '',
          email: prev.email,
          password: '',
          confirmPassword: '',
          pesel: '',
          nip: '',
          regon: '',
        }));
      } else {
        setMessage('❌ ' + (data.error ?? 'Błąd rejestracji.'));
      }
      return;
    }

    const endpoint = loginMode === 'customer' ? '/api/login' : '/api/staff/login';
    const body = loginMode === 'customer' ? { email: formData.email, password: formData.password } : staffData;

    const res = await api.post(endpoint, body);
    const data = await res.json() as { message?: string; error?: string; user?: MeResponse };
    if (res.ok && data.user) {
      setMessage('✅ ' + (data.message ?? 'Zalogowano!'));
      applySession(data.user);
    } else {
      setMessage('❌ ' + (data.error ?? 'Błąd logowania.'));
    }
  };

  const logout = async () => {
    await api.post('/api/logout');
    setLoggedInUser(null);
    setLoggedInUserLastInitial(null);
    setUserRole(null);
    setEmployeeJobRole(null);
    setMessage('');
    setStaffData({ login: '', password: '' });
  };

  return {
    loggedInUser,
    loggedInUserLastInitial,
    userRole,
    employeeJobRole,
    isLogin,
    setIsLogin,
    loginMode,
    setLoginMode,
    formData,
    staffData,
    handleCustomerChange,
    handleStaffChange,
    handleAuthSubmit,
    logout,
  };
};
