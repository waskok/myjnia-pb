import { useState } from 'react';

function App() {
  // Stan do przełączania między logowaniem a rejestracją
  const [isLogin, setIsLogin] = useState(true);

  // Stan przechowujący dane z formularza
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', address: '', phone: '', email: '', password: ''
  });
  
  // Stan do wyświetlania komunikatów (błędy/sukcesy)
  const [message, setMessage] = useState('');
  
  // Stan przechowujący imię użytkownika po udanym zalogowaniu
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);

  // Funkcja aktualizująca dane podczas wpisywania
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Główna funkcja wysyłająca dane do serwera
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Przetwarzanie...');

    // Zależnie od tego, która zakładka jest aktywna, uderzamy pod inny adres
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
          // Jeśli to było logowanie -> zapisujemy token w przeglądarce (Local Storage)
          localStorage.setItem('token', data.token);
          setLoggedInUser(data.user.firstName);
        } else {
          // Jeśli to była rejestracja -> przełączamy użytkownika na zakładkę logowania
          setIsLogin(true);
          // Czyścimy tylko pole hasła dla bezpieczeństwa
          setFormData({ ...formData, password: '' });
        }
      } else {
        setMessage('❌ Błąd: ' + data.error);
      }
    } catch {
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  // WIDOK 1: Zalogowany użytkownik
  if (loggedInUser) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Witaj, {loggedInUser}! 👋</h2>
        <p>Jesteś pomyślnie zalogowany do systemu Myjni PB.</p>
        <button 
          onClick={() => {
            // Wylogowywanie: usuwamy token i czyścimy stan
            localStorage.removeItem('token');
            setLoggedInUser(null);
            setMessage('');
            setFormData({ ...formData, password: '' });
          }}
          style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '20px' }}
        >
          Wyloguj się
        </button>
      </div>
    );
  }

  // WIDOK 2: Formularze logowania i rejestracji
  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '10px' }}>
      
      {/* Zakładki */}
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
      
      {/* Formularz dopasowujący się do wybranej zakładki */}
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
      
      {/* Komunikaty */}
      {message && <p style={{ marginTop: '15px', fontWeight: 'bold', textAlign: 'center' }}>{message}</p>}
    </div>
  );
}

export default App;