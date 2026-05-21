import './App.css';
import { useAppLogic } from './hooks/useAppLogic';
import { AuthScreen } from './components/AuthScreen';
import { CustomerPanel } from './components/CustomerPanel';
import { EmployeePanel } from './components/EmployeePanel';
import { OwnerPanel } from './components/OwnerPanel';
import { Toast } from './components/Toast';

function App() {
  const appLogic = useAppLogic();

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

  return (
    <>
      {panel}
      <Toast message={appLogic.message} onDismiss={appLogic.clearMessage} />
    </>
  );
}

export default App;