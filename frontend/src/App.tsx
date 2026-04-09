import { useEffect, useState } from 'react';

function App() {
  const [message, setMessage] = useState('Ładowanie danych z serwera...');

  useEffect(() => {
    // Odpytujemy nasz serwer backendowy (który działa na porcie 5000)
    fetch('http://localhost:5000/api/db-check')
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Błąd połączenia z serwerem!'));
  }, []);

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Panel Myjni PB</h1>
      <div style={{ padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Status serwera:</h3>
        <p style={{ color: 'green', fontWeight: 'bold' }}>{message}</p>
      </div>
    </div>
  );
}

export default App;