import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomer } from './useCustomer';
import { api } from '../utils/apiClient';
import { jsonResponse } from '../test/mockApi';

vi.mock('../utils/apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('useCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchCustomerProfile ustawia punkty lojalnościowe', async () => {
    vi.mocked(api.get).mockResolvedValue(
      jsonResponse(true, { loyaltyPoints: 450, firstName: 'Piotr' }),
    );

    const { result } = renderHook(() => useCustomer());

    await act(async () => {
      await result.current.fetchCustomerProfile();
    });

    expect(result.current.loyaltyPoints).toBe(450);
    expect(api.get).toHaveBeenCalledWith('/api/my-profile');
  });

  it('fetchMyTransactions ładuje historię', async () => {
    vi.mocked(api.get).mockResolvedValue(
      jsonResponse(true, [{ id: 1, totalAmount: 100, date: '2026-01-01', paymentMethod: 'Karta' }]),
    );

    const { result } = renderHook(() => useCustomer());

    await act(async () => {
      await result.current.fetchMyTransactions();
    });

    expect(result.current.myTransactions).toHaveLength(1);
    expect(result.current.myTransactions[0]?.totalAmount).toBe(100);
  });

  it('fetchLoyaltyRates ustawia koszt mycia w punktach', async () => {
    vi.mocked(api.get).mockResolvedValue(
      jsonResponse(true, { pointsPerStandardWash: 300, pointsPerWaxWash: 400 }),
    );

    const { result } = renderHook(() => useCustomer());

    await act(async () => {
      await result.current.fetchLoyaltyRates();
    });

    expect(result.current.customerWashPointsCost).toEqual({ standard: 300, wax: 400 });
  });

  it('fetchLoyaltyRates — fallback przy braku pól w odpowiedzi', async () => {
    vi.mocked(api.get).mockResolvedValue(jsonResponse(true, {}));

    const { result } = renderHook(() => useCustomer());

    await act(async () => {
      await result.current.fetchLoyaltyRates();
    });

    expect(result.current.customerWashPointsCost).toEqual({ standard: 300, wax: 400 });
  });
});
