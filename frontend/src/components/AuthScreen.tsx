import React from 'react';
import type { AppLogic } from '../hooks/useAppLogic';

export const AuthScreen: React.FC<AppLogic> = (props) => {
  const { loginMode, setLoginMode, isLogin, setIsLogin, handleAuthSubmit, formData, staffData, handleCustomerChange, handleStaffChange } = props;
  const isIndividual = formData.accountType === 'individual';

  return (
    <div className={`login-container ${!isLogin && loginMode === 'customer' ? 'login-container-register' : ''}`}>
      {loginMode === 'staff' ? (
        <form onSubmit={handleAuthSubmit} className="flex-col-sm">
          <h2>Logowanie służbowe</h2>
          <input name="login" className="input-field" placeholder="Login pracownika lub właściciela" value={staffData.login} onChange={handleStaffChange} required />
          <input name="password" type="password" className="input-field" placeholder="Hasło" value={staffData.password} onChange={handleStaffChange} required />
          <button type="submit" className="btn btn-dark">Zaloguj do systemu</button>
        </form>
      ) : (
        <>
          <h2>{isLogin ? 'Zaloguj się' : 'Zarejestruj się'}</h2>
          <form onSubmit={handleAuthSubmit} className="flex-col-sm">
            {!isLogin && (
              <>
                <label className="text-left form-label">Typ konta</label>
                <select
                  name="accountType"
                  className="select-field w-full"
                  value={formData.accountType}
                  onChange={handleCustomerChange}
                >
                  <option value="individual">Osoba fizyczna</option>
                  <option value="company">Firma</option>
                </select>

                {isIndividual ? (
                  <>
                    <input name="firstName" className="input-field" placeholder="Imię" value={formData.firstName} onChange={handleCustomerChange} required />
                    <input name="lastName" className="input-field" placeholder="Nazwisko" value={formData.lastName} onChange={handleCustomerChange} required />
                    <input name="pesel" className="input-field" placeholder="PESEL" value={formData.pesel} onChange={handleCustomerChange} required maxLength={11} />
                    <input name="nip" className="input-field" placeholder="NIP (opcjonalnie)" value={formData.nip} onChange={handleCustomerChange} maxLength={10} />
                  </>
                ) : (
                  <>
                    <input name="companyName" className="input-field" placeholder="Nazwa firmy" value={formData.companyName} onChange={handleCustomerChange} required />
                    <input name="nip" className="input-field" placeholder="NIP" value={formData.nip} onChange={handleCustomerChange} required maxLength={10} />
                    <input name="regon" className="input-field" placeholder="REGON" value={formData.regon} onChange={handleCustomerChange} required maxLength={14} />
                  </>
                )}

                <input name="address" className="input-field" placeholder="Adres" value={formData.address} onChange={handleCustomerChange} required />
                <input name="phone" className="input-field" placeholder="Telefon" value={formData.phone} onChange={handleCustomerChange} required />
              </>
            )}
            <input name="email" type="email" className="input-field" placeholder="E-mail" value={formData.email} onChange={handleCustomerChange} required />
            <input name="password" type="password" className="input-field" placeholder="Hasło" value={formData.password} onChange={handleCustomerChange} required />
            <button type="submit" className="btn btn-success">{isLogin ? 'Zaloguj' : 'Załóż konto'}</button>
          </form>
          {isLogin ? (
            <button type="button" className="link-btn" onClick={() => setIsLogin(false)}>Nie masz konta? Zarejestruj się</button>
          ) : (
            <button type="button" className="link-btn" onClick={() => setIsLogin(true)}>Powrót do logowania</button>
          )}
        </>
      )}
      {loginMode === 'staff' && (
        <button type="button" className="link-btn" onClick={() => setLoginMode('customer')}>
          Przejdź do strefy klienta
        </button>
      )}
    </div>
  );
};
