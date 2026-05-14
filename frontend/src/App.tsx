import React from 'react';
import './App.css';
import { useAppLogic } from './hooks/useAppLogic';
import { AuthScreen } from './components/AuthScreen';
import { CustomerPanel } from './components/CustomerPanel';
import { EmployeePanel } from './components/EmployeePanel';
import { OwnerPanel } from './components/OwnerPanel';

function App() {
  const appLogic = useAppLogic();

  if (appLogic.userRole === 'owner') {
    return <OwnerPanel {...appLogic} />;
  }

  if (appLogic.userRole === 'employee') {
    return <EmployeePanel {...appLogic} />;
  }

  if (appLogic.userRole === 'customer') {
    return <CustomerPanel {...appLogic} />;
  }

  return <AuthScreen {...appLogic} />;
}

export default App;