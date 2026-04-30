import { useState } from 'react';
import './App.css'; 

// --- TYPY ---
interface WashService { id: number; type: string; price: number; loyaltyPoints: number; }
interface Reservation { id: number; date: string; status: string; washService: WashService; customer?: { firstName: string; lastName: string; phone: string; }; }
interface Fuel { id: number; type: string; pricePerLiter: number; tankLevel: number; maxLevel: number; }
interface Delivery { id: number; fuel: Fuel; quantity: number; status: string; deliveryDate: string; supplier: string; owner: { firstName: string; lastName: string; } }

function App() {
  const [message, setMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'employee' | 'owner' | null>(null);

  // --- STANY KLIENTA ---
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', address: '', phone: '', email: '', password: '' });
  const [services, setServices] = useState<WashService[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);

  // --- STANY SŁUŻBOWE (Pracownik + Właściciel) ---
  const [loginMode, setLoginMode] = useState<'customer' | 'staff'>('customer');
  const [staffData, setStaffData] = useState({ login: '', password: '' });
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [fuels, setFuels] = useState<Fuel[]>([]);
  const [posData, setPosData] = useState({ fuelId: '', quantity: 1, customerEmail: '', paymentMethod: 'Karta' });

  // --- STANY WŁAŚCICIELA ---
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [newDelivery, setNewDelivery] = useState({ fuelId: '', quantity: 1000, supplier: '', deliveryDate: '' });
  const [newPrice, setNewPrice] = useState<{ [key: number]: number }>({});

  // --- HANDLERY ---
  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleStaffChange = (e: React.ChangeEvent<HTMLInputElement>) => setStaffData({ ...staffData, [e.target.name]: e.target.value });
  const handlePosChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPosData({ ...posData, [e.target.name]: e.target.value });
  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNewDelivery({ ...newDelivery, [e.target.name]: e.target.value });

  // --- POBIERANIE DANYCH (Poprawione catch(e)) ---
  const fetchServices = async () => { try { const res = await fetch('http://localhost:5000/api/services'); const data = await res.json(); setServices(data); if (data.length > 0) setSelectedService(String(data[0].id)); } catch (e) { console.error(e); } };
  const fetchFuels = async () => { try { const res = await fetch('http://localhost:5000/api/fuels'); const data = await res.json(); setFuels(data); if (data.length > 0) { setPosData(prev => ({ ...prev, fuelId: String(data[0].id) })); setNewDelivery(prev => ({ ...prev, fuelId: String(data[0].id) })); } } catch (e) { console.error(e); } };
  const fetchMyReservations = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/my-reservations', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setMyReservations(await res.json()); } catch (e) { console.error(e); } };
  const fetchAllReservations = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/employee/reservations', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setAllReservations(await res.json()); } catch (e) { console.error(e); } };
  const fetchDeliveries = async (token: string) => { try { const res = await fetch('http://localhost:5000/api/owner/deliveries', { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setDeliveries(await res.json()); } catch (e) { console.error(e); } };

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
          
          if (data.user.role === 'owner') { fetchFuels(); fetchDeliveries(data.token); }
          else if (data.user.role === 'employee') { fetchFuels(); fetchAllReservations(data.token); }
          else { fetchServices(); fetchMyReservations(data.token); }
        } else { setIsLogin(true); setFormData({ ...formData, password: '' }); }
      } else setMessage('❌ ' + data.error);
    } catch (e) { console.error(e); setMessage('❌ Błąd połączenia z serwerem!'); }
  };

  // --- AKCJE ---
  const handleReservation = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, washServiceId: selectedService, date: reservationDate }) }); const data = await res.json(); if (res.ok) { setMessage('✅ ' + data.message); setReservationDate(''); fetchMyReservations(token); } } catch (e) { console.error(e); } };
  const handleCompleteReservation = async (id: number) => { try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/employee/reservations/${id}/complete`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Status zmieniony!'); fetchAllReservations(token); } } catch (e) { console.error(e); } };
  const handlePOSSubmit = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/transactions/fuel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(posData) }); const data = await res.json(); if (res.ok) { setMessage('✅ ' + data.message); setPosData({ ...posData, quantity: 1, customerEmail: '' }); fetchFuels(); } else setMessage('❌ ' + data.error); } catch (e) { console.error(e); } };
  const handleOrderDelivery = async (e: React.FormEvent) => { e.preventDefault(); try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch('http://localhost:5000/api/owner/deliveries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newDelivery) }); if (res.ok) { setMessage('✅ Dostawa zlecona!'); fetchDeliveries(token); setNewDelivery({...newDelivery, deliveryDate: '', supplier: ''}); } } catch (e) { console.error(e); } };
  const handleCompleteDelivery = async (id: number) => { try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/owner/deliveries/${id}/complete`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { setMessage('✅ Paliwo dolane!'); fetchDeliveries(token); fetchFuels(); } } catch (e) { console.error(e); } };
  const handleUpdatePrice = async (id: number) => { if (!newPrice[id]) return; try { const token = localStorage.getItem('token'); if (!token) return; const res = await fetch(`http://localhost:5000/api/owner/fuels/${id}/price`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ price: newPrice[id] }) }); if (res.ok) { setMessage('✅ Cena zmieniona!'); fetchFuels(); setNewPrice({ ...newPrice, [id]: 0 }); } } catch (e) { console.error(e); } };

  const logout = () => { localStorage.clear(); setLoggedInUser(null); setUserRole(null); setMessage(''); setStaffData({ login: '', password: '' }); };

  const renderMessage = () => message && <div className={`msg ${message.includes('✅') ? 'msg-success' : 'msg-error'}`}>{message}</div>;

  // ==============================================
  // WIDOK 1: PANEL WŁAŚCICIELA
  // ==============================================
  if (userRole === 'owner') {
    return (
      <div className="app-container" >
        <h2 >Witaj, {loggedInUser}! (Panel Właściciela) 💼</h2>
        
        <div className="card card-danger">
          <h3>Zarządzanie Cennikiem i Magazynem 📈</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Paliwo</th><th>Stan Zbiornika</th><th>Aktualna Cena</th><th>Nowa Cena</th><th>Akcja</th></tr></thead>
              <tbody>
                {fuels.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.type}</strong></td>
                    <td style={{ color: f.tankLevel < 1000 ? 'red' : 'black', fontWeight: f.tankLevel < 1000 ? 'bold' : 'normal' }}>{f.tankLevel} / {f.maxLevel} L</td>
                    <td>{f.pricePerLiter} zł/L</td>
                    <td><input type="number" step="0.01" className="input-small" value={newPrice[f.id] || ''} onChange={(e) => setNewPrice({ ...newPrice, [f.id]: parseFloat(e.target.value) })} /></td>
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
            <input type="datetime-local" name="deliveryDate" className="input-field" style={{width: 'auto'}} value={newDelivery.deliveryDate} onChange={handleDeliveryChange} required />
            <button type="submit" className="btn btn-warning">Zleć dostawę</button>
          </form>
          
          <ul className="list-unstyled">
            {deliveries.map(d => (
              <li key={d.id} className="list-item flex-space-between">
                <div>
                  <strong>{d.fuel.type}</strong> - {d.quantity} L (Dostawca: {d.supplier})<br/> 
                  Planowana data: {new Date(d.deliveryDate).toLocaleString()} <br/>
                  Status: <span className="text-bold" style={{ color: d.status === 'Dostarczona' ? 'green' : 'orange' }}>{d.status}</span>
                </div>
                {d.status !== 'Dostarczona' && <button onClick={() => handleCompleteDelivery(d.id)} className="btn btn-primary">Odbierz dostawę</button>}
              </li>
            ))}
          </ul>
        </div>
        
        {renderMessage()}
        <button onClick={logout} className="btn btn-danger" style={{marginTop: '30px'}}>Wyloguj się</button>
      </div>
    );
  }

  // ==============================================
  // WIDOK 2: PANEL PRACOWNIKA
  // ==============================================
  if (userRole === 'employee') {
    return (
      <div className="app-container">
        <h2>Witaj, {loggedInUser}! (Panel Pracownika) 👨‍🔧</h2>
        
        <div className="card card-info">
          <h3>Kasa Fiskalna (Sprzedaż Paliwa) ⛽</h3>
          <form onSubmit={handlePOSSubmit} className="flex-col">
            <div className="flex-row text-left">
              <div style={{ flex: 1 }}><label>Paliwo:</label><select name="fuelId" className="select-field" value={posData.fuelId} onChange={handlePosChange}>{fuels.map(f => <option key={f.id} value={f.id}>{f.type} - {f.pricePerLiter} zł/l (Dostępne: {f.tankLevel} l)</option>)}</select></div>
              <div style={{ flex: 1 }}><label>Ilość (L):</label><input type="number" name="quantity" className="input-field" min="1" step="0.01" value={posData.quantity} onChange={handlePosChange} required /></div>
            </div>
            <div className="flex-row text-left">
              <div style={{ flex: 1 }}><label>Płatność:</label><select name="paymentMethod" className="select-field" value={posData.paymentMethod} onChange={handlePosChange}><option>Karta</option><option>Gotówka</option></select></div>
              <div style={{ flex: 1 }}><label>Email (Punkty):</label><input type="email" name="customerEmail" className="input-field" placeholder="Opcjonalnie" value={posData.customerEmail} onChange={handlePosChange} /></div>
            </div>
            <button type="submit" className="btn btn-info">Zatwierdź sprzedaż</button>
          </form>
        </div>

        <div className="card card-gray">
          <h3>Rezerwacje myjni do obsłużenia</h3>
          {allReservations.length === 0 ? <p>Brak rezerwacji.</p> : (
            <ul className="list-unstyled">
              {allReservations.map((res) => (
                <li key={res.id} className="list-item flex-space-between">
                  <div><strong>{new Date(res.date).toLocaleString()}</strong> <br/> Usługa: {res.washService.type} <br/> Status: <b>{res.status}</b></div>
                  {res.status === 'Oczekująca' && <button onClick={() => handleCompleteReservation(res.id)} className="btn btn-primary">Zakończ</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {renderMessage()}
        <button onClick={logout} className="btn btn-danger" style={{marginTop: '30px'}}>Wyloguj się</button>
      </div>
    );
  }

  // ==============================================
  // WIDOK 3: PANEL KLIENTA
  // ==============================================
  if (userRole === 'customer') {
    return (
      <div className="app-container">
        <h2>Witaj, {loggedInUser}! 👋</h2>
        
        <div className="card card-light">
          <h3 className="text-left">Zarezerwuj myjnię</h3>
          <form onSubmit={handleReservation} className="flex-col text-left">
            <select value={selectedService} className="select-field" onChange={(e) => setSelectedService(e.target.value)} required><option value="" disabled>-- Wybierz usługę --</option>{services.map(service => <option key={service.id} value={service.id}>{service.type} - {service.price} zł (+{service.loyaltyPoints} pkt)</option>)}</select>
            <input type="datetime-local" className="input-field" value={reservationDate} onChange={(e) => setReservationDate(e.target.value)} required />
            <button type="submit" className="btn btn-success">Potwierdź rezerwację</button>
          </form>
        </div>

        <div className="card card-gray">
          <h3 className="text-left">Moje rezerwacje</h3>
          {myReservations.length === 0 ? <p className="text-left">Brak rezerwacji.</p> : (
            <ul className="list-unstyled">
              {myReservations.map((res) => <li key={res.id} className="list-item"><strong>{new Date(res.date).toLocaleString()}</strong> <br/> Usługa: {res.washService.type} <br/> Status: <b>{res.status}</b></li>)}
            </ul>
          )}
        </div>
        {renderMessage()}
        <button onClick={logout} className="btn btn-danger" style={{marginTop: '30px'}}>Wyloguj się</button>
      </div>
    );
  }

  // ==============================================
  // WIDOK 4: EKRAN LOGOWANIA
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