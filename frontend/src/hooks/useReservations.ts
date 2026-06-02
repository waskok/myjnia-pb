import { useState } from 'react';
import { api } from '../utils/apiClient';
import type { WashService, Reservation } from '../types';

export const useReservations = (
  setMessage: (msg: string) => void,
  loyaltyPoints: number,
  onReservationSuccess: () => void,
) => {
  const [services, setServices] = useState<WashService[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);

  const fetchServices = async () => {
    const res = await api.get('/api/services');
    if (res.ok) {
      const data = (await res.json()) as WashService[];
      setServices(data);
      if (data.length > 0 && data[0]) setSelectedService(String(data[0].id));
    }
  };

  const fetchMyReservations = async () => {
    const res = await api.get('/api/my-reservations');
    if (res.ok) setMyReservations((await res.json()) as Reservation[]);
  };

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedService) {
      setMessage('❌ Wybierz wariant rezerwacji.');
      return;
    }
    if (new Date(reservationDate).getTime() < Date.now()) {
      setMessage('❌ Nie można rezerwować terminów w przeszłości.');
      return;
    }

    const [modeRaw, serviceIdRaw, pointsRaw] = selectedService.split(':');
    const isPointsPayment = modeRaw === 'points';
    const washServiceId = isPointsPayment ? Number(serviceIdRaw) : Number(selectedService);
    const pointsCost = isPointsPayment ? Number(pointsRaw) : 0;

    if (!Number.isFinite(washServiceId) || washServiceId <= 0) {
      setMessage('❌ Nieprawidłowo wybrana usługa.');
      return;
    }
    if (isPointsPayment) {
      if (!Number.isFinite(pointsCost) || pointsCost <= 0) {
        setMessage('❌ Nieprawidłowa liczba punktów dla wybranej usługi.');
        return;
      }
      if (loyaltyPoints < pointsCost) {
        setMessage(`❌ Za mało punktów. Potrzebujesz ${pointsCost} pkt, a masz ${loyaltyPoints} pkt.`);
        return;
      }
    }

    const confirmMsg = isPointsPayment
      ? 'Czy na pewno chcesz potwierdzić rezerwację opłaconą punktami?\n\nW przypadku anulowania rezerwacji opłaconej punktami punkty nie podlegają zwrotowi.\nUpewnij się, że data i godzina są poprawne.'
      : 'Czy na pewno chcesz potwierdzić rezerwację?\n\nUpewnij się, że data i godzina są poprawne.';
    if (!window.confirm(confirmMsg)) return;

    const res = await api.post('/api/reservations', {
      washServiceId,
      date: reservationDate,
      paymentMode: isPointsPayment ? 'points' : 'cash',
      pointsCost: isPointsPayment ? pointsCost : undefined,
    });
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setMessage('✅ ' + (data.message ?? 'Złożono rezerwację.'));
      setReservationDate('');
      setSelectedService('');
      onReservationSuccess();
    } else {
      setMessage('❌ ' + (data.error ?? 'Błąd rezerwacji.'));
    }
  };

  return {
    services,
    setServices,
    selectedService,
    setSelectedService,
    reservationDate,
    setReservationDate,
    myReservations,
    fetchServices,
    fetchMyReservations,
    handleReservation,
  };
};
