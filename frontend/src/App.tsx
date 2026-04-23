import { useState } from 'react';

function App() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address: '',
    phone: '',
    email: '',
    password: ''
  });
  const [message, setMessage] = useState('');

  // Funkcja aktualizująca stan podczas wpisywania
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Funkcja wysyłająca dane do backendu po kliknięciu "Zarejestruj"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Zatrzymuje przeładowanie strony
    setMessage('Przetwarzanie...');

    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ ' + data.message);
        // Czyszczenie formularza po sukcesie
        setFormData({ firstName: '', lastName: '', address: '', phone: '', email: '', password: '' });
      } else {
        setMessage('❌ Błąd: ' + data.error);
      }
    } catch {
      setMessage('❌ Błąd połączenia z serwerem!');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h2>Rejestracja - Myjnia PB</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input name="firstName" placeholder="Imię" value={formData.firstName} onChange={handleChange} required />
        <input name="lastName" placeholder="Nazwisko" value={formData.lastName} onChange={handleChange} required />
        <input name="address" placeholder="Adres" value={formData.address} onChange={handleChange} required />
        <input name="phone" placeholder="Telefon" value={formData.phone} onChange={handleChange} required />
        <input name="email" type="email" placeholder="E-mail" value={formData.email} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Hasło" value={formData.password} onChange={handleChange} required />
        
        <button type="submit" style={{ padding: '10px', backgroundColor: '#007BFF', color: 'white', border: 'none', cursor: 'pointer' }}>
          Zarejestruj się
        </button>
      </form>
      
      {message && <p style={{ marginTop: '15px', fontWeight: 'bold' }}>{message}</p>}
    </div>
  );
}

export default App;