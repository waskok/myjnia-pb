import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { api } from './apiClient';

describe('apiClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET wysyła credentials: include', async () => {
    await api.get('/api/services');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/services'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('POST wysyła JSON i Content-Type', async () => {
    await api.post('/api/login', { email: 'a@b.co', password: 'x' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/login'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.co', password: 'x' }),
        credentials: 'include',
      }),
    );
  });
});
