import { useState } from 'react';
import { api } from '../utils/apiClient';
import type { Fuel, Customer } from '../types';
import { downloadInvoicePdf, type GeneratedInvoice } from '../utils/pdfGenerator';

interface PosData {
  fuelId: string;
  quantity: number;
  customerEmail: string;
  paymentMethod: string;
  issueInvoice: boolean;
}

export const usePos = (
  setMessage: (msg: string) => void,
  fuels: Fuel[],
  onTransactionSuccess: () => void,
) => {
  const [posData, setPosData] = useState<PosData>({
    fuelId: '',
    quantity: 1,
    customerEmail: '',
    paymentMethod: 'Karta',
    issueInvoice: false,
  });
  const [posCustomerQuery, setPosCustomerQuery] = useState('');
  const [posVerifiedCustomer, setPosVerifiedCustomer] = useState<Customer | null>(null);

  const handlePosChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setPosData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setPosData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const initPosWithFuels = (loadedFuels: Fuel[]) => {
    if (loadedFuels.length > 0 && loadedFuels[0]) {
      setPosData((prev) => ({ ...prev, fuelId: String(loadedFuels[0]!.id) }));
    }
  };

  const handleVerifyCustomer = async () => {
    if (!posCustomerQuery) return;
    const res = await api.get(`/api/employee/customer/${encodeURIComponent(posCustomerQuery)}`);
    const data = (await res.json()) as Customer & { error?: string };
    if (res.ok) {
      setPosVerifiedCustomer(data);
      setPosData((prev) => ({ ...prev, customerEmail: data.email }));
      setMessage('✅ Zweryfikowano!');
    } else {
      setPosVerifiedCustomer(null);
      setPosData((prev) => ({ ...prev, customerEmail: '' }));
      setMessage('❌ ' + (data.error ?? 'Nie znaleziono klienta.'));
    }
  };

  const handlePOSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posData.issueInvoice && !posVerifiedCustomer) {
      setMessage('❌ Aby wystawić fakturę, najpierw zweryfikuj klienta (e-mail lub telefon).');
      return;
    }
    const res = await api.post('/api/transactions/fuel', posData);
    const data = (await res.json()) as { message?: string; error?: string; invoice?: unknown };
    if (res.ok) {
      if (data.invoice) downloadInvoicePdf(data.invoice as GeneratedInvoice);
      setMessage('✅ ' + (data.message ?? 'Transakcja zapisana.'));
      setPosData((prev) => ({
        fuelId: prev.fuelId,
        quantity: 1,
        customerEmail: '',
        paymentMethod: 'Karta',
        issueInvoice: false,
      }));
      setPosVerifiedCustomer(null);
      setPosCustomerQuery('');
      onTransactionSuccess();
    } else {
      setMessage('❌ ' + (data.error ?? 'Błąd transakcji.'));
    }
  };

  return {
    fuels,
    posData,
    setPosData,
    posCustomerQuery,
    setPosCustomerQuery,
    posVerifiedCustomer,
    handlePosChange,
    handlePOSSubmit,
    handleVerifyCustomer,
    initPosWithFuels,
  };
};
