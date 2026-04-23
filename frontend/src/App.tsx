import { useState } from 'react';

// 1. Definiujemy typy, żeby TypeScript nie krzyczał o "any"
interface WashService {
  id: number;
  type: string;
  price: number;
  loyaltyPoints: number;
}

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', address: '', phone: '', email: '', password: ''
  });
  const [message, setMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);

  const [services, setServices] = useState<WashService[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [reservationDate, setReservationDate] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Funkcja pobierająca cennik
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

  const handleSubmit = async (e: React.FormEvent) => {
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
          // Pobieramy cennik bezpiecznie zaraz po zalogowaniu, bez używania useEffect!
          fetchServices();
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

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Przetwarzanie rezerwacji...');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, washServiceId: selectedService, date: reservationDate })
      });
      
      const data = await response.json();
      if (response.ok) {
        setMessage('✅ ' + data.message);
        setReservationDate(''); // Czyścimy datę po udanej rezerwacji
      } else {
        setMessage('❌ Błąd: ' + data.error);
      }
    } catch {
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  // WIDOK 1: Zalogowany użytkownik (TYLKO TWORZENIE REZERWACJI)
  if (loggedInUser) {
    return (
      <div style={{ maxWidth: '600px', margin: '50px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Witaj, {loggedInUser}! 👋</h2>
        <p>Jesteś pomyślnie zalogowany do systemu Myjni PB.</p>
        
        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#f9f9f9' }}>
          <h3>Zarezerwuj myjnię</h3>
          <form onSubmit={handleReservation} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            
            <label style={{ textAlign: 'left', fontWeight: 'bold' }}>Wybierz usługę:</label>
            <select 
              value={selectedService} 
              onChange={(e) => setSelectedService(e.target.value)}
              style={{ padding: '10px' }}
              required
            >
              <option value="" disabled>-- Wybierz usługę --</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.type} - {service.price} zł (+{service.loyaltyPoints} pkt)
                </option>
              ))}
            </select>

            <label style={{ textAlign: 'left', fontWeight: 'bold' }}>Wybierz datę i godzinę:</label>
            <input 
              type="datetime-local" 
              value={reservationDate} 
              onChange={(e) => setReservationDate(e.target.value)} 
              style={{ padding: '10px' }}
              required 
            />

            <button type="submit" style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
              Potwierdź rezerwację
            </button>
          </form>
        </div>

        {message && <p style={{ marginTop: '15px', fontWeight: 'bold', color: message.includes('✅') ? 'green' : 'red' }}>{message}</p>}

        <button 
          onClick={() => {
            localStorage.removeItem('token');
            setLoggedInUser(null);
            setMessage('');
            setFormData({ firstName: '', lastName: '', address: '', phone: '', email: '', password: '' });
          }}
          style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '30px' }}
        >
          Wyloguj się
        </button>
      </div>
    );
  }

  // WIDOK 2: Formularze logowania i rejestracji
  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
        <button 
          onClick={() => { setIsLogin(true); setMessage(''); }} 
          style={{ padding: '10px', width: '50%', border: 'none', backgroundColor: isLogin ? '#007BFF' : '#f0f0f0', color: isLogin ? 'white' : 'black', cursor: 'pointer' }}
        >
          Logowanie
        </button>
        <button 
          onClick={() => { setIsLogin(false); setMessage(''); }} 
          style={{ padding: '10px', width: '50%', border: 'none', backgroundColor: !isLogin ? '#007BFF' : '#f0f0f0', color: !isLogin ? 'white' : 'black', cursor: 'pointer' }}
        >
          Rejestracja
        </button>
      </div>

      <h2>{isLogin ? 'Zaloguj się' : 'Zarejestruj się'} - Myjnia PB</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {!isLogin && (
          <>
            <input name="firstName" placeholder="Imię" value={formData.firstName} onChange={handleChange} required />
            <input name="lastName" placeholder="Nazwisko" value={formData.lastName} onChange={handleChange} required />
            <input name="address" placeholder="Adres" value={formData.address} onChange={handleChange} required />
            <input name="phone" placeholder="Telefon" value={formData.phone} onChange={handleChange} required />
          </>
        )}
        <input name="email" type="email" placeholder="E-mail" value={formData.email} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Hasło" value={formData.password} onChange={handleChange} required />
        
        <button type="submit" style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px' }}>
          {isLogin ? 'Zaloguj się' : 'Załóż konto'}
        </button>
      </form>
      
      {message && <p style={{ marginTop: '15px', fontWeight: 'bold', textAlign: 'center' }}>{message}</p>}
    </div>
  );
}

export default App;