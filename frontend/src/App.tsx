import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { useAppLogic } from './hooks/useAppLogic';
import { AuthScreen } from './components/AuthScreen';
import { CustomerPanel } from './components/CustomerPanel';
import { EmployeePanel } from './components/EmployeePanel';
import { OwnerPanel } from './components/OwnerPanel';
import { Toast } from './components/Toast';
import { PublicPricing } from './components/PublicPricing';
import { PublicLoyaltyProgramPage } from './components/PublicLoyaltyProgram';
import heroImage from './assets/MyjniaPB.jpg';

function App() {
  const appLogic = useAppLogic();
  const [publicPage, setPublicPage] = useState<'home' | 'pricing' | 'loyalty' | 'auth'>('home');
  type EmployeeTab = 'pos' | 'rezerwacje' | 'monitoring' | 'lpg' | 'grafik';
  const allowedEmployeeTabs = useMemo(() => {
    if (appLogic.employeeJobRole === 'Kasjer') return ['pos', 'grafik'] as EmployeeTab[];
    if (appLogic.employeeJobRole === 'Monitoring') return ['monitoring', 'grafik'] as EmployeeTab[];
    if (appLogic.employeeJobRole === 'Obsługa Myjni') return ['rezerwacje', 'grafik'] as EmployeeTab[];
    if (appLogic.employeeJobRole === 'Obsługa dystrybutora LPG') return ['lpg', 'grafik'] as EmployeeTab[];
    return ['grafik'] as EmployeeTab[];
  }, [appLogic.employeeJobRole]);

  useEffect(() => {
    if (appLogic.userRole !== 'employee') return;
    if (allowedEmployeeTabs.includes(appLogic.activeEmpTab)) return;
    appLogic.setActiveEmpTab(allowedEmployeeTabs[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only correct tab when role/tabs change
  }, [appLogic.userRole, appLogic.activeEmpTab, appLogic.setActiveEmpTab, allowedEmployeeTabs]);

  let panel;
  if (appLogic.userRole === 'owner') {
    panel = <OwnerPanel {...appLogic} />;
  } else if (appLogic.userRole === 'employee') {
    panel = <EmployeePanel {...appLogic} />;
  } else if (appLogic.userRole === 'customer') {
    panel =
      publicPage === 'pricing' ? (
        <PublicPricing />
      ) : publicPage === 'loyalty' ? (
        <PublicLoyaltyProgramPage />
      ) : (
        <CustomerPanel {...appLogic} />
      );
  } else {
    panel = publicPage === 'home' ? (
      <div className="card home-card">
        <h2>Witamy w Myjnia PB</h2>
        <p>
          Myjnia PB to nowoczesna stacja i myjnia samochodowa z szybkim systemem rezerwacji,
          programem lojalnościowym oraz wygodną obsługą klientów indywidualnych i firm.
        </p>
        <p>
          Na miejscu oferujemy paliwa, usługi myjni oraz przejrzysty system historii zakupów i rezerwacji.
          Zarezerwuj termin online albo zaloguj się do odpowiedniej strefy, aby zarządzać swoim kontem.
        </p>
      </div>
    ) : publicPage === 'pricing' ? (
      <PublicPricing />
    ) : publicPage === 'loyalty' ? (
      <PublicLoyaltyProgramPage />
    ) : (
      <AuthScreen {...appLogic} />
    );
  }

  const leftTitle =
    appLogic.userRole === 'customer'
      ? 'Strefa Klienta'
      : appLogic.userRole === 'employee'
        ? 'Strefa Pracownika'
        : appLogic.userRole === 'owner'
          ? 'Strefa Właściciela'
          : 'Myjnia PB';

  const authButtons = (
    <>
      <button
        type="button"
        className={`tab-btn-large ${publicPage === 'home' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => setPublicPage('home')}
      >
        Strona główna
      </button>
      <button
        type="button"
        className={`tab-btn-large ${publicPage === 'pricing' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => setPublicPage('pricing')}
      >
        Cennik
      </button>
      <button
        type="button"
        className={`tab-btn-large ${publicPage === 'loyalty' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => setPublicPage('loyalty')}
      >
        Program lojalnościowy
      </button>
      <span className="nav-divider-vertical" aria-hidden="true" />
      <button
        type="button"
        className={`tab-btn-large ${publicPage === 'auth' && appLogic.loginMode === 'customer' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => {
          setPublicPage('auth');
          appLogic.setLoginMode('customer');
          appLogic.setIsLogin(true);
        }}
      >
        Strefa Klienta
      </button>
      <button
        type="button"
        className={`tab-btn-large ${publicPage === 'auth' && appLogic.loginMode === 'staff' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => {
          setPublicPage('auth');
          appLogic.setLoginMode('staff');
        }}
      >
        Strefa Pracownika
      </button>
    </>
  );

  const customerButtons = (
    <>
      <button type="button" className={`tab-btn-large ${appLogic.activeCustTab === 'book' && publicPage !== 'pricing' && publicPage !== 'loyalty' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => { setPublicPage('home'); appLogic.setActiveCustTab('book'); }}>Umów mycie auta</button>
      <button type="button" className={`tab-btn-large ${appLogic.activeCustTab === 'resHistory' && publicPage !== 'pricing' && publicPage !== 'loyalty' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => { setPublicPage('home'); appLogic.setActiveCustTab('resHistory'); }}>Moje rezerwacje</button>
      <button type="button" className={`tab-btn-large ${appLogic.activeCustTab === 'buyHistory' && publicPage !== 'pricing' && publicPage !== 'loyalty' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => { setPublicPage('home'); appLogic.setActiveCustTab('buyHistory'); }}>Historia zakupów</button>
      <button type="button" className="btn btn-danger" onClick={appLogic.logout}>Wyloguj</button>
    </>
  );

  const employeeButtons = (
    <>
      {allowedEmployeeTabs.includes('pos') && (
        <button type="button" className={`tab-btn-large ${appLogic.activeEmpTab === 'pos' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveEmpTab('pos')}>Kasa</button>
      )}
      {allowedEmployeeTabs.includes('rezerwacje') && (
        <button type="button" className={`tab-btn-large ${appLogic.activeEmpTab === 'rezerwacje' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveEmpTab('rezerwacje')}>Myjnia</button>
      )}
      <button
        type="button"
        className={`tab-btn-large ${appLogic.activeEmpTab === 'grafik' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => {
          appLogic.setActiveEmpTab('grafik');
          appLogic.fetchSchedule();
        }}
      >
        Grafik
      </button>
      {allowedEmployeeTabs.includes('monitoring') && (
        <button
          type="button"
          className={`tab-btn-large ${appLogic.activeEmpTab === 'monitoring' ? 'tab-active-primary' : 'tab-inactive'}`}
          onClick={() => {
            appLogic.setActiveEmpTab('monitoring');
            appLogic.fetchMonitoring();
          }}
        >
          Monitoring
        </button>
      )}
      {allowedEmployeeTabs.includes('lpg') && (
        <button
          type="button"
          className={`tab-btn-large ${appLogic.activeEmpTab === 'lpg' ? 'tab-active-primary' : 'tab-inactive'}`}
          onClick={() => {
            appLogic.setActiveEmpTab('lpg');
            appLogic.fetchMonitoring();
          }}
        >
          Stan LPG
        </button>
      )}
      <button type="button" className="btn btn-danger" onClick={appLogic.logout}>Wyloguj</button>
    </>
  );

  const ownerButtons = (
    <>
      <button type="button" className={`tab-btn-large ${appLogic.activeTab === 'cennik' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveTab('cennik')}>Cennik</button>
      <button type="button" className={`tab-btn-large ${appLogic.activeTab === 'dostawy' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveTab('dostawy')}>Dostawy</button>
      <button type="button" className={`tab-btn-large ${appLogic.activeTab === 'pracownicy' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveTab('pracownicy')}>Pracownicy</button>
      <button
        type="button"
        className={`tab-btn-large ${appLogic.activeTab === 'grafik' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => {
          appLogic.setActiveTab('grafik');
          appLogic.fetchSchedule();
        }}
      >
        Grafik
      </button>
      <button type="button" className={`tab-btn-large ${appLogic.activeTab === 'klienci' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveTab('klienci')}>Klienci</button>
      <button
        type="button"
        className={`tab-btn-large ${appLogic.activeTab === 'monitoring' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => {
          appLogic.setActiveTab('monitoring');
          appLogic.fetchMonitoring();
        }}
      >
        Monitoring
      </button>
      <button
        type="button"
        className={`tab-btn-large ${appLogic.activeTab === 'raporty' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => {
          appLogic.setActiveTab('raporty');
          appLogic.fetchReports();
        }}
      >
        Raporty
      </button>
      <button type="button" className="btn btn-danger" onClick={appLogic.logout}>Wyloguj</button>
    </>
  );

  const rightButtons =
    appLogic.userRole === 'customer'
      ? customerButtons
      : appLogic.userRole === 'employee'
        ? employeeButtons
        : appLogic.userRole === 'owner'
          ? ownerButtons
          : authButtons;

  const shouldShowFooter = appLogic.userRole === null || appLogic.userRole === 'customer';

  return (
    <div
      className="app-background"
      style={{
        backgroundImage:
          `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.55)), url(${heroImage})`,
      }}
    >
      <header className="global-navbar">
        <div className="global-navbar-inner">
          <div className="global-navbar-left">
            {appLogic.userRole ? (
              <span>{leftTitle}</span>
            ) : (
              <button type="button" className="navbar-brand-link" onClick={() => setPublicPage('home')}>
                Myjnia PB
              </button>
            )}
            {appLogic.userRole === 'customer' && (
              <>
                <span className="navbar-loyalty-inline">
                  Twoje punkty lojalnościowe: <strong>{appLogic.loyaltyPoints}</strong>
                </span>
                <button
                  type="button"
                  className={`tab-btn-large ${publicPage === 'pricing' ? 'tab-active-primary' : 'tab-inactive'}`}
                  onClick={() => setPublicPage('pricing')}
                >
                  Cennik
                </button>
                <button
                  type="button"
                  className={`tab-btn-large ${publicPage === 'loyalty' ? 'tab-active-primary' : 'tab-inactive'}`}
                  onClick={() => setPublicPage('loyalty')}
                >
                  Program lojalnościowy
                </button>
              </>
            )}
            {appLogic.userRole === 'employee' && appLogic.loggedInUser && (
              <span className="navbar-employee-inline">
                Zalogowano jako: <strong>{`${appLogic.loggedInUser}${appLogic.loggedInUserLastInitial ? ` ${appLogic.loggedInUserLastInitial}` : ''} - ${appLogic.employeeJobRole ?? 'Pracownik'}`}</strong>
              </span>
            )}
          </div>
          <div className="global-navbar-right">{rightButtons}</div>
        </div>
      </header>
      <main className="main-shell">
        {panel}
      </main>
      {shouldShowFooter && (
        <footer className="global-footer">
          <div className="global-footer-inner">
            <span className="footer-brand">Myjnia PB</span>
            <span>ul. Jana Pawła II 37, 31-864 Kraków</span>
            <span>+48 123 456 789</span>
            <span>kontakt@myjniapb.pl</span>
          </div>
        </footer>
      )}
      <Toast key={appLogic.message || 'idle'} message={appLogic.message} onDismiss={appLogic.clearMessage} />
    </div>
  );
}

export default App;