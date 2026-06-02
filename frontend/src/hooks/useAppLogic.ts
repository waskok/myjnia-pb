import { useState, useCallback, useEffect } from 'react';
import type { Fuel, WashService, ActiveCustTab } from '../types';

import { useAuth } from './useAuth';
import { useCustomer } from './useCustomer';
import { useReservations } from './useReservations';
import { usePos } from './usePos';
import { useAdminPanel } from './useAdminPanel';
import { useMonitoring } from './useMonitoring';
import { useSchedule } from './useSchedule';

export const useAppLogic = () => {
  const [message, setMessage] = useState('');
  const clearMessage = useCallback(() => setMessage(''), []);

  const [fuels, setFuels] = useState<Fuel[]>([]);
  const [services, setServices] = useState<WashService[]>([]);

  const [activeEmpTab, setActiveEmpTab] = useState<
    'pos' | 'rezerwacje' | 'monitoring' | 'lpg' | 'grafik'
  >('pos');
  const [activeCustTab, setActiveCustTab] = useState<ActiveCustTab>('book');
  const [empResDateFilter, setEmpResDateFilter] = useState('');
  const [empResPhoneFilter, setEmpResPhoneFilter] = useState('');

  const auth = useAuth(setMessage);
  const customer = useCustomer(setMessage);
  const reservations = useReservations(setMessage, customer.loyaltyPoints, () => {
    void customer.fetchCustomerProfile();
    void customer.fetchMyTransactions();
    void reservations.fetchMyReservations();
  });
  const pos = usePos(setMessage, fuels, () => void admin.fetchFuels());
  const admin = useAdminPanel(setMessage, setFuels, setServices);
  const monitoring = useMonitoring(setMessage);
  const schedule = useSchedule(setMessage, auth.userRole);

  const [allReservations, setAllReservations] = useState<import('../types').Reservation[]>([]);

  const fetchAllReservations = async () => {
    const { api } = await import('../utils/apiClient');
    const res = await api.get('/api/employee/reservations');
    if (res.ok) setAllReservations((await res.json()) as import('../types').Reservation[]);
  };

  const handleCompleteReservation = async (id: number) => {
    const { api } = await import('../utils/apiClient');
    const res = await api.patch(`/api/employee/reservations/${id}/complete`);
    if (res.ok) {
      setMessage('✅ Zakończono!');
      await fetchAllReservations();
    }
  };

  const handleCancelReservation = async (id: number) => {
    if (!window.confirm('Czy na pewno chcesz anulować tę rezerwację?')) return;
    const { api } = await import('../utils/apiClient');
    const res = await api.patch(`/api/employee/reservations/${id}/cancel`);
    if (res.ok) {
      setMessage('✅ Rezerwacja anulowana!');
      await fetchAllReservations();
    }
  };

  useEffect(() => {
    const { userRole, employeeJobRole } = auth;
    if (!userRole) return;

    if (userRole === 'owner') {
      admin.setActiveTab('cennik');
      void admin.fetchFuels();
      void admin.fetchServices();
      void admin.fetchDeliveries();
      void admin.fetchEmployees();
      void admin.fetchCustomers();
      void admin.fetchLoyaltyConfig();
    } else if (userRole === 'employee') {
      if (employeeJobRole === 'Kasjer') {
        setActiveEmpTab('pos');
        void admin.fetchFuels();
      } else if (employeeJobRole === 'Monitoring') {
        setActiveEmpTab('monitoring');
        void monitoring.fetchMonitoring();
      } else if (employeeJobRole === 'Obsługa dystrybutora LPG') {
        setActiveEmpTab('lpg');
        void monitoring.fetchMonitoring();
      } else if (employeeJobRole === 'Obsługa Myjni') {
        setActiveEmpTab('rezerwacje');
        void fetchAllReservations();
      } else {
        setActiveEmpTab('grafik');
      }
    } else if (userRole === 'customer') {
      void reservations.fetchServices();
      void customer.fetchCustomerProfile();
      void customer.fetchMyTransactions();
      void reservations.fetchMyReservations();
      void customer.fetchLoyaltyRates();
    }
  }, [auth.userRole, auth.employeeJobRole]);

  useEffect(() => {
    if (fuels.length > 0) pos.initPosWithFuels(fuels);
  }, [fuels]);

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Zakończona') return '#28a745';
    if (status === 'Anulowana') return '#dc3545';
    if (status === 'Oczekująca') return '#ffc107';
    return '#334155';
  };

  return {
    message,
    clearMessage,
    fuels,
    services,
    activeEmpTab,
    setActiveEmpTab,
    activeCustTab,
    setActiveCustTab,
    empResDateFilter,
    setEmpResDateFilter,
    empResPhoneFilter,
    setEmpResPhoneFilter,
    allReservations,
    fetchAllReservations,
    handleCompleteReservation,
    handleCancelReservation,
    getMinDateTime,
    getStatusColor,
    ...auth,
    ...customer,
    ...reservations,
    ...pos,
    ...admin,
    ...monitoring,
    ...schedule,
  };
};

export type AppLogic = ReturnType<typeof useAppLogic>;
