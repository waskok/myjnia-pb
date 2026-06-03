import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerPanel } from './CustomerPanel';
import type { AppLogic } from '../hooks/useAppLogic';

function panelProps(overrides: Partial<AppLogic> = {}): AppLogic {
  return {
    activeCustTab: 'book',
    handleReservation: vi.fn((e: React.FormEvent) => e.preventDefault()),
    selectedService: '1',
    setSelectedService: vi.fn(),
    services: [{ id: 1, type: 'Mycie standardowe', price: 39, loyaltyPoints: 5 }],
    customerWashPointsCost: { standard: 300, wax: 400 },
    reservationDate: '',
    getMinDateTime: () => '2030-01-01T00:00',
    setReservationDate: vi.fn(),
    myReservations: [
      {
        id: 1,
        date: '2030-06-01T10:00:00.000Z',
        status: 'Oczekująca',
        washService: { id: 1, type: 'Mycie standardowe', price: 39, loyaltyPoints: 5 },
      },
    ],
    getStatusColor: () => '#000',
    myTransactions: [],
    ...overrides,
  } as AppLogic;
}

describe('CustomerPanel', () => {
  it('zakładka book — formularz rezerwacji', () => {
    render(<CustomerPanel {...panelProps({ activeCustTab: 'book' })} />);
    expect(screen.getByRole('heading', { name: 'Umów mycie auta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Potwierdź rezerwację' })).toBeInTheDocument();
  });

  it('zakładka resHistory — lista rezerwacji ze statusem', () => {
    render(<CustomerPanel {...panelProps({ activeCustTab: 'resHistory' })} />);
    expect(screen.getByText('Moje rezerwacje')).toBeInTheDocument();
    expect(screen.getByText('Oczekująca')).toBeInTheDocument();
  });

  it('zakładka buyHistory — historia zakupów (pusta)', () => {
    render(<CustomerPanel {...panelProps({ activeCustTab: 'buyHistory' })} />);
    expect(screen.getByText('Historia zakupów')).toBeInTheDocument();
    expect(screen.getByText(/Brak historii zakupów na stacji/i)).toBeInTheDocument();
  });

  it('zakładka buyHistory — pokazuje transakcję', () => {
    render(
      <CustomerPanel
        {...panelProps({
          activeCustTab: 'buyHistory',
          myTransactions: [
            {
              id: 10,
              totalAmount: 50,
              date: '2026-05-01T12:00:00.000Z',
              paymentMethod: 'Karta',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/50\.00 zł/)).toBeInTheDocument();
  });
});
