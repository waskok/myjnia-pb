import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '../utils/apiClient';
import type { WashService, Reservation } from '../types';
import {
  combineReservationDateTime,
  type ReservationSlot,
} from '../utils/reservationSlots';

export const useReservations = (
  setMessage: (msg: string) => void,
  loyaltyPoints: number,
  setServices: Dispatch<SetStateAction<WashService[]>>,
  onReservationSuccess: () => void,
) => {
  const [selectedService, setSelectedService] = useState('');
  const [reservationDay, setReservationDay] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<ReservationSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
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

  const fetchAvailability = useCallback(async (day: string) => {
    if (!day) {
      setAvailableSlots([]);
      return;
    }

    setSlotsLoading(true);
    try {
      const res = await api.get(`/api/reservations/availability?date=${encodeURIComponent(day)}`);
      if (res.ok) {
        const data = (await res.json()) as { slots: ReservationSlot[] };
        setAvailableSlots(data.slots);
        setReservationTime((current) => {
          if (!current) return current;
          const slot = data.slots.find((entry) => entry.time === current);
          return slot?.available ? current : '';
        });
      } else {
        setAvailableSlots([]);
        const data = (await res.json()) as { error?: string };
        setMessage(`❌ ${data.error ?? 'Nie udało się pobrać dostępnych godzin.'}`);
      }
    } finally {
      setSlotsLoading(false);
    }
  }, [setMessage]);

  const handleReservationDayChange = (day: string) => {
    setReservationDay(day);
    setReservationTime('');
  };

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedService) {
      setMessage('❌ Wybierz wariant rezerwacji.');
      return;
    }
    if (!reservationDay) {
      setMessage('❌ Wybierz datę rezerwacji.');
      return;
    }
    if (!reservationTime) {
      setMessage('❌ Wybierz godzinę rezerwacji.');
      return;
    }

    const reservationDate = combineReservationDateTime(reservationDay, reservationTime);
    if (new Date(reservationDate).getTime() < Date.now()) {
      setMessage('❌ Nie można rezerwować terminów w przeszłości.');
      return;
    }

    const selectedSlot = availableSlots.find((slot) => slot.time === reservationTime);
    if (selectedSlot && !selectedSlot.available) {
      setMessage('❌ Wybrany termin jest już zajęty. Odśwież listę godzin.');
      void fetchAvailability(reservationDay);
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
      setReservationDay('');
      setReservationTime('');
      setAvailableSlots([]);
      setSelectedService('');
      await fetchMyReservations();
      onReservationSuccess();
    } else {
      setMessage('❌ ' + (data.error ?? 'Błąd rezerwacji.'));
      if (reservationDay) {
        void fetchAvailability(reservationDay);
      }
    }
  };

  return {
    selectedService,
    setSelectedService,
    reservationDay,
    reservationTime,
    setReservationTime,
    availableSlots,
    slotsLoading,
    handleReservationDayChange,
    fetchAvailability,
    myReservations,
    fetchServices,
    fetchMyReservations,
    handleReservation,
  };
};
