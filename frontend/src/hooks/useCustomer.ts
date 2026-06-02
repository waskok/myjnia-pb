import { useState } from 'react';
import { api } from '../utils/apiClient';
import type { Transaction } from '../types';

type LoyaltyConfig = {
  pointsPerStandardWash: number;
  pointsPerWaxWash: number;
};

export const useCustomer = (_setMessage: (msg: string) => void) => {
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [myTransactions, setMyTransactions] = useState<Transaction[]>([]);
  const [customerWashPointsCost, setCustomerWashPointsCost] = useState({
    standard: 300,
    wax: 400,
  });

  const fetchCustomerProfile = async () => {
    const res = await api.get('/api/my-profile');
    if (res.ok) {
      const data = (await res.json()) as { loyaltyPoints: number };
      setLoyaltyPoints(data.loyaltyPoints);
    }
  };

  const fetchMyTransactions = async () => {
    const res = await api.get('/api/my-transactions');
    if (res.ok) setMyTransactions((await res.json()) as Transaction[]);
  };

  const fetchLoyaltyRates = async () => {
    const res = await api.get('/api/loyalty-program');
    if (res.ok) {
      const data = (await res.json()) as Partial<LoyaltyConfig>;
      setCustomerWashPointsCost({
        standard: Number(data.pointsPerStandardWash) || 300,
        wax: Number(data.pointsPerWaxWash) || 400,
      });
    }
  };

  return {
    loyaltyPoints,
    setLoyaltyPoints,
    myTransactions,
    customerWashPointsCost,
    fetchCustomerProfile,
    fetchMyTransactions,
    fetchLoyaltyRates,
  };
};
