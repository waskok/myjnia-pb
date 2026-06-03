import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PublicPricing } from './PublicPricing';
import { api } from '../utils/apiClient';
import { jsonResponse } from '../test/mockApi';

vi.mock('../utils/apiClient', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('PublicPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wyświetla cennik paliw i myjni po załadowaniu', async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/api/fuels') {
        return jsonResponse(true, [{ id: 1, type: 'E95', pricePerLiter: 6.39, tankLevel: 100, maxLevel: 200 }]);
      }
      if (path === '/api/services') {
        return jsonResponse(true, [{ id: 1, type: 'Mycie standardowe', price: 39, loyaltyPoints: 5 }]);
      }
      if (path === '/api/loyalty-program') {
        return jsonResponse(true, {
          pointsPerE95: 100,
          pointsPerE98: 120,
          pointsPerDiesel: 100,
          pointsPerLpg: 50,
          pointsPerStandardWash: 300,
          pointsPerWaxWash: 400,
        });
      }
      return jsonResponse(false, { error: '?' });
    });

    render(<PublicPricing />);

    expect(screen.getByRole('heading', { name: 'Cennik' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('E95')).toBeInTheDocument();
      expect(screen.getByText(/6\.39 zł\/L/)).toBeInTheDocument();
      expect(screen.getByText('Mycie standardowe')).toBeInTheDocument();
    });
  });

  it('pokazuje błąd gdy API paliw zwraca failure', async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/api/fuels') return jsonResponse(false, { error: 'Brak paliw' });
      return jsonResponse(true, []);
    });

    render(<PublicPricing />);

    await waitFor(() => {
      expect(screen.getByText(/Brak paliw|Nie udało się pobrać paliw/i)).toBeInTheDocument();
    });
  });
});
