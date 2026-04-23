import { useState } from 'react';

// --- TYPY ---
interface WashService {
  id: number;
  type: string;
  price: number;
  loyaltyPoints: number;
}

interface Reservation {
  id: number;
  date: string;
  status: string;
  washService: WashService;
  // Dodajemy opcjonalne dane klienta, bo pracownik je pobiera
  customer?: {
    firstName: string;
    lastName: string;
    phone: string;
  };
}

function App() {
  // --- STANY WSPÓLNE ---
  const [message, setMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'employee' | null>(null);

  // --- STANY KLIENTA ---
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', address: '', phone: '', email: '', password: ''
  });
  const [services, setServices] = useState<WashService[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);

  // --- STANY PRACOWNIKA ---
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);
  const [employeeData, setEmployeeData] = useState({ login: '', password: '' });
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);

  // --- HANDLERY ZMIAN W FORMULARZACH ---
  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmployeeData({ ...employeeData, [e.target.name]: e.target.value });
  };

  // --- FUNKCJE POBIERAJĄCE DANE ---
  const fetchServices = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/services');
      const data = await res.json();
      setServices(data);
      if (data.length > 0) setSelectedService(String(data[0].id));
    } catch {
      console.error('Błąd pobierania usług');
    }
  };

  const fetchMyReservations = async (tokenToUse: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/my-reservations', {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      });
      const data = await res.json();
      if (res.ok) setMyReservations(data);
    } catch {
      console.error('Błąd pobierania historii rezerwacji');
    }
  };

  const fetchAllReservations = async (tokenToUse: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/employee/reservations', {
        headers: { 'Authorization': `Bearer ${tokenToUse}` }
      });
      const data = await res.json();
      if (res.ok) setAllReservations(data);
    } catch {
      console.error('Błąd pobierania wszystkich rezerwacji');
    }
  };

  // --- LOGOWANIE / REJESTRACJA KLIENTA ---
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Przetwarzanie...');
    const endpoint = isLogin ? '/api/login' : '/api/register';

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (response.ok) {
        setMessage('✅ ' + data.message);
        if (isLogin) {
          localStorage.setItem('token', data.token);
          setLoggedInUser(data.user.firstName);
          setUserRole('customer');
          fetchServices();
          fetchMyReservations(data.token);
        } else {
          setIsLogin(true);
          setFormData({ ...formData, password: '' });
        }
      } else {
        setMessage('❌ Błąd: ' + data.error);
      }
    } catch {
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  // --- LOGOWANIE PRACOWNIKA ---
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Logowanie pracownika...');

    try {
      const response = await fetch('http://localhost:5000/api/employee/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      });
      const data = await response.json();

      if (response.ok) {
        setMessage('✅ ' + data.message);
        localStorage.setItem('token', data.token);
        setLoggedInUser(data.user.firstName);
        setUserRole('employee');
        fetchAllReservations(data.token);
      } else {
        setMessage('❌ Błąd: ' + data.error);
      }
    } catch {
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  // --- TWORZENIE REZERWACJI (KLIENT) ---
  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Przetwarzanie rezerwacji...');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:5000/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, washServiceId: selectedService, date: reservationDate })
      });
      
      const data = await response.json();
      if (response.ok) {
        setMessage('✅ ' + data.message);
        setReservationDate(''); 
        fetchMyReservations(token);
      } else {
        setMessage('❌ Błąd: ' + data.error);
      }
    } catch {
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  // --- ZMIANA STATUSU REZERWACJI (PRACOWNIK) ---
  const handleCompleteReservation = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:5000/api/employee/reservations/${id}/complete`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setMessage('✅ Status zmieniony na Zakończona!');
        fetchAllReservations(token); // Odświeżamy listę dla pracownika
      } else {
        setMessage('❌ Błąd zmiany statusu.');
      }
    } catch {
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setLoggedInUser(null);
    setUserRole(null);
    setMessage('');
    setEmployeeData({ login: '', password: '' });
    setFormData({ ...formData, password: '' });
  };


  // ==============================================
  // WIDOK 1: PANEL PRACOWNIKA
  // ==============================================
  if (userRole === 'employee') {
    return (
      <div style={{ maxWidth: '800px', margin: '50px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Witaj, {loggedInUser}! (Panel Pracownika) 👨‍🔧</h2>
        
        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#e9ecef' }}>
          <h3>Wszystkie rezerwacje w systemie</h3>
          {allReservations.length === 0 ? (
            <p>Brak rezerwacji.</p>
          ) : (
            <ul style={{ listStyleType: 'none', padding: 0, textAlign: 'left' }}>
              {allReservations.map((res) => (
                <li key={res.id} style={{ padding: '15px', borderBottom: '1px solid #ccc', marginBottom: '10px', backgroundColor: 'white', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{new Date(res.date).toLocaleString()}</strong> <br/>
                    Klient: {res.customer?.firstName} {res.customer?.lastName} (Tel: {res.customer?.phone}) <br/>
                    Usługa: {res.washService.type} <br/>
                    Status: <span style={{ color: res.status === 'Oczekująca' ? 'orange' : 'green', fontWeight: 'bold' }}>{res.status}</span>
                  </div>
                  
                  {res.status === 'Oczekująca' && (
                    <button 
                      onClick={() => handleCompleteReservation(res.id)}
                      style={{ padding: '10px 15px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', height: '40px' }}
                    >
                      Zakończ
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {message && <p style={{ marginTop: '15px', fontWeight: 'bold', color: message.includes('✅') ? 'green' : 'red' }}>{message}</p>}

        <button onClick={logout} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '30px' }}>
          Wyloguj się
        </button>
      </div>
    );
  }

  // ==============================================
  // WIDOK 2: PANEL KLIENTA (ZALOGOWANY)
  // ==============================================
  if (userRole === 'customer') {
    return (
      <div style={{ maxWidth: '600px', margin: '50px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Witaj, {loggedInUser}! 👋</h2>
        
        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#f9f9f9' }}>
          <h3>Zarezerwuj myjnię</h3>
          <form onSubmit={handleReservation} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <label style={{ textAlign: 'left', fontWeight: 'bold' }}>Wybierz usługę:</label>
            <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} style={{ padding: '10px' }} required>
              <option value="" disabled>-- Wybierz usługę --</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>{service.type} - {service.price} zł (+{service.loyaltyPoints} pkt)</option>
              ))}
            </select>
            <label style={{ textAlign: 'left', fontWeight: 'bold' }}>Wybierz datę i godzinę:</label>
            <input type="datetime-local" value={reservationDate} onChange={(e) => setReservationDate(e.target.value)} style={{ padding: '10px' }} required />
            <button type="submit" style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Potwierdź rezerwację</button>
          </form>
        </div>

        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#e9ecef' }}>
          <h3>Moje rezerwacje</h3>
          {myReservations.length === 0 ? <p>Brak rezerwacji.</p> : (
            <ul style={{ listStyleType: 'none', padding: 0, textAlign: 'left' }}>
              {myReservations.map((res) => (
                <li key={res.id} style={{ padding: '10px', borderBottom: '1px solid #ccc', marginBottom: '5px', backgroundColor: 'white', borderRadius: '5px' }}>
                  <strong>{new Date(res.date).toLocaleString()}</strong> <br/>
                  Usługa: {res.washService.type} <br/>
                  Status: <span style={{ color: res.status === 'Oczekująca' ? 'orange' : 'green', fontWeight: 'bold' }}>{res.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {message && <p style={{ marginTop: '15px', fontWeight: 'bold', color: message.includes('✅') ? 'green' : 'red' }}>{message}</p>}
        <button onClick={logout} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '30px' }}>Wyloguj się</button>
      </div>
    );
  }

  // ==============================================
  // WIDOK 3: FORMULARZE LOGOWANIA / REJESTRACJI
  // ==============================================
  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '10px' }}>
      
      {/* Przełącznik Klient / Pracownik */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button 
          onClick={() => { setIsEmployeeMode(!isEmployeeMode); setMessage(''); }}
          style={{ padding: '5px 15px', backgroundColor: isEmployeeMode ? '#ffc107' : '#17a2b8', color: 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isEmployeeMode ? 'Wróć do strefy Klienta' : 'Przejdź do strefy Pracownika'}
        </button>
      </div>

      <hr style={{ marginBottom: '20px' }} />

      {isEmployeeMode ? (
        // FORMULARZ PRACOWNIKA
        <>
          <h2 style={{ textAlign: 'center', color: '#ffc107', textShadow: '1px 1px 2px black' }}>Strefa Pracownika</h2>
          <form onSubmit={handleEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input name="login" placeholder="Login pracownika" value={employeeData.login} onChange={handleEmployeeChange} required />
            <input name="password" type="password" placeholder="Hasło" value={employeeData.password} onChange={handleEmployeeChange} required />
            <button type="submit" style={{ padding: '10px', backgroundColor: '#343a40', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px', fontWeight: 'bold' }}>Zaloguj jako pracownik</button>
          </form>
        </>
      ) : (
        // FORMULARZE KLIENTA
        <>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
            <button onClick={() => { setIsLogin(true); setMessage(''); }} style={{ padding: '10px', width: '50%', border: 'none', backgroundColor: isLogin ? '#007BFF' : '#f0f0f0', color: isLogin ? 'white' : 'black', cursor: 'pointer' }}>Logowanie</button>
            <button onClick={() => { setIsLogin(false); setMessage(''); }} style={{ padding: '10px', width: '50%', border: 'none', backgroundColor: !isLogin ? '#007BFF' : '#f0f0f0', color: !isLogin ? 'white' : 'black', cursor: 'pointer' }}>Rejestracja</button>
          </div>

          <h2 style={{ textAlign: 'center' }}>{isLogin ? 'Zaloguj się' : 'Zarejestruj się'} - Klient</h2>
          
          <form onSubmit={handleCustomerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!isLogin && (
              <>
                <input name="firstName" placeholder="Imię" value={formData.firstName} onChange={handleCustomerChange} required />
                <input name="lastName" placeholder="Nazwisko" value={formData.lastName} onChange={handleCustomerChange} required />
                <input name="address" placeholder="Adres" value={formData.address} onChange={handleCustomerChange} required />
                <input name="phone" placeholder="Telefon" value={formData.phone} onChange={handleCustomerChange} required />
              </>
            )}
            <input name="email" type="email" placeholder="E-mail" value={formData.email} onChange={handleCustomerChange} required />
            <input name="password" type="password" placeholder="Hasło" value={formData.password} onChange={handleCustomerChange} required />
            <button type="submit" style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px' }}>{isLogin ? 'Zaloguj się' : 'Załóż konto'}</button>
          </form>
        </>
      )}
      
      {message && <p style={{ marginTop: '15px', fontWeight: 'bold', textAlign: 'center' }}>{message}</p>}
    </div>
  );
}

export default App;