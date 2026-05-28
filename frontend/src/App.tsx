import { useEffect, useMemo } from 'react';
import './App.css';
import { useAppLogic } from './hooks/useAppLogic';
import { AuthScreen } from './components/AuthScreen';
import { CustomerPanel } from './components/CustomerPanel';
import { EmployeePanel } from './components/EmployeePanel';
import { OwnerPanel } from './components/OwnerPanel';
import { Toast } from './components/Toast';
import heroImage from './assets/MyjniaPB.jpg';

function App() {
  const appLogic = useAppLogic();
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
  }, [appLogic.userRole, appLogic.activeEmpTab, appLogic.setActiveEmpTab, allowedEmployeeTabs]);

  let panel;
  if (appLogic.userRole === 'owner') {
    panel = <OwnerPanel {...appLogic} />;
  } else if (appLogic.userRole === 'employee') {
    panel = <EmployeePanel {...appLogic} />;
  } else if (appLogic.userRole === 'customer') {
    panel = <CustomerPanel {...appLogic} />;
  } else {
    panel = <AuthScreen {...appLogic} />;
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
        className={`tab-btn-large ${appLogic.loginMode === 'customer' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => {
          appLogic.setLoginMode('customer');
          appLogic.setIsLogin(true);
        }}
      >
        Strefa Klienta
      </button>
      <button
        type="button"
        className={`tab-btn-large ${appLogic.loginMode === 'staff' ? 'tab-active-primary' : 'tab-inactive'}`}
        onClick={() => appLogic.setLoginMode('staff')}
      >
        Strefa Pracownika
      </button>
    </>
  );

  const customerButtons = (
    <>
      <button type="button" className={`tab-btn-large ${appLogic.activeCustTab === 'book' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveCustTab('book')}>Rezerwacja</button>
      <button type="button" className={`tab-btn-large ${appLogic.activeCustTab === 'resHistory' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveCustTab('resHistory')}>Rezerwacje</button>
      <button type="button" className={`tab-btn-large ${appLogic.activeCustTab === 'buyHistory' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveCustTab('buyHistory')}>Historia</button>
      <button type="button" className={`tab-btn-large ${appLogic.activeCustTab === 'contact' ? 'tab-active-primary' : 'tab-inactive'}`} onClick={() => appLogic.setActiveCustTab('contact')}>Kontakt</button>
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
          <div className="global-navbar-left">{leftTitle}</div>
          <div className="global-navbar-right">{rightButtons}</div>
        </div>
      </header>
      <main className="main-shell">
        {panel}
      </main>
      <Toast message={appLogic.message} onDismiss={appLogic.clearMessage} />
    </div>
  );
}

export default App;