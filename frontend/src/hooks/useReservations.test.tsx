import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { useReservations } from './useReservations';
import { api } from '../utils/apiClient';
import { jsonResponse } from '../test/mockApi';
import type { WashService } from '../types';

vi.mock('../utils/apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const services: WashService[] = [
  { id: 1, type: 'Mycie standardowe', price: 39, loyaltyPoints: 5 },
];

function useReservationsHarness(loyaltyPoints = 450) {
  const setMessage = vi.fn();
  const onSuccess = vi.fn();
  const setServices = vi.fn() as unknown as Dispatch<SetStateAction<WashService[]>>;

  const hook = renderHook(() =>
    useReservations(setMessage, loyaltyPoints, setServices, onSuccess),
  );

  return { ...hook, setMessage, onSuccess };
}

describe('useReservations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchServices ustawia listę i domyślną usługę', async () => {
    vi.mocked(api.get).mockResolvedValue(jsonResponse(true, services));

    const { result } = useReservationsHarness();

    await act(async () => {
      await result.current.fetchServices();
    });

    expect(result.current.selectedService).toBe('1');
  });

  it('odrzuca rezerwację w przeszłości', async () => {
    const { result, setMessage } = useReservationsHarness();

    act(() => {
      result.current.setSelectedService('1');
      result.current.setReservationDate('2020-06-01T10:00');
    });

    await act(async () => {
      await result.current.handleReservation({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(setMessage).toHaveBeenCalledWith('❌ Nie można rezerwować terminów w przeszłości.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('odrzuca płatność punktami przy za małej liczbie punktów', async () => {
    const { result, setMessage } = useReservationsHarness(50);

    act(() => {
      result.current.setSelectedService('points:1:300');
      result.current.setReservationDate('2030-12-20T10:00');
    });

    await act(async () => {
      await result.current.handleReservation({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(setMessage).toHaveBeenCalledWith(expect.stringMatching(/Za mało punktów/));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('anuluje gdy użytkownik odrzuci confirm', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const { result, setMessage } = useReservationsHarness();

    act(() => {
      result.current.setSelectedService('1');
      result.current.setReservationDate('2030-12-21T10:00');
    });

    await act(async () => {
      await result.current.handleReservation({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(setMessage).not.toHaveBeenCalledWith(expect.stringMatching(/^✅/));
  });

  it('składa rezerwację gotówką po potwierdzeniu', async () => {
    vi.mocked(api.get).mockResolvedValue(jsonResponse(true, []));
    vi.mocked(api.post).mockResolvedValue(jsonResponse(true, { message: 'Złożono rezerwację.' }));

    const { result, setMessage, onSuccess } = useReservationsHarness();

    act(() => {
      result.current.setSelectedService('1');
      result.current.setReservationDate('2030-12-22T11:00');
    });

    await act(async () => {
      await result.current.handleReservation({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(api.post).toHaveBeenCalledWith(
      '/api/reservations',
      expect.objectContaining({
        washServiceId: 1,
        paymentMode: 'cash',
      }),
    );
    expect(setMessage).toHaveBeenCalledWith(expect.stringMatching(/^✅/));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('odrzuca gdy nie wybrano usługi', async () => {
    const { result, setMessage } = useReservationsHarness();

    act(() => {
      result.current.setSelectedService('');
      result.current.setReservationDate('2030-12-23T10:00');
    });

    await act(async () => {
      await result.current.handleReservation({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(setMessage).toHaveBeenCalledWith('❌ Wybierz wariant rezerwacji.');
  });
});
