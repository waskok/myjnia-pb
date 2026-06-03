import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';
import { api } from '../utils/apiClient';
import { jsonResponse } from '../test/mockApi';

vi.mock('../utils/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ ok: false } as Response);
  });

  it('normalizuje numer telefonu (tylko cyfry, max 9)', () => {
    const setMessage = vi.fn();
    const { result } = renderHook(() => useAuth(setMessage));

    act(() => {
      result.current.handleCustomerChange({
        target: { name: 'phone', value: '123-456-789' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.formData.phone).toBe('123456789');
  });

  it('przy rejestracji odrzuca hasło krótsze niż 8 znaków bez wywołania API', async () => {
    const setMessage = vi.fn();
    const { result } = renderHook(() => useAuth(setMessage));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/me'));

    act(() => result.current.setIsLogin(false));
    act(() => {
      result.current.handleCustomerChange({
        target: { name: 'password', value: 'krótkie' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleAuthSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(setMessage).toHaveBeenCalledWith('❌ Hasło musi mieć minimum 8 znaków.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('ustawia userRole po udanym logowaniu klienta', async () => {
    const setMessage = vi.fn();
    vi.mocked(api.post).mockResolvedValue({
      ok: true,
      json: async () => ({
        message: 'Zalogowano pomyślnie!',
        user: { firstName: 'Piotr', lastName: 'Kowalczyk', role: 'customer' },
      }),
    } as Response);

    const { result } = renderHook(() => useAuth(setMessage));
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    act(() => {
      result.current.handleCustomerChange({
        target: { name: 'email', value: 'piotr.kowalczyk@example.pl' },
      } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleCustomerChange({
        target: { name: 'password', value: 'Klient1234!' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleAuthSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(result.current.userRole).toBe('customer');
    expect(result.current.loggedInUser).toBe('Piotr');
    expect(setMessage).toHaveBeenCalledWith(expect.stringContaining('✅'));
  });

  it('przy rejestracji odrzuca różne hasła', async () => {
    const setMessage = vi.fn();
    const { result } = renderHook(() => useAuth(setMessage));
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    act(() => result.current.setIsLogin(false));
    act(() => {
      result.current.handleCustomerChange({
        target: { name: 'password', value: 'Haslo1234!' },
      } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleCustomerChange({
        target: { name: 'confirmPassword', value: 'Inne1234!' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleAuthSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(setMessage).toHaveBeenCalledWith('❌ Hasła muszą być takie same.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('przy błędnym logowaniu pokazuje komunikat błędu', async () => {
    const setMessage = vi.fn();
    vi.mocked(api.post).mockResolvedValue(
      jsonResponse(false, { error: 'Nieprawidłowy e-mail lub hasło!' }),
    );

    const { result } = renderHook(() => useAuth(setMessage));
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    act(() => {
      result.current.handleCustomerChange({
        target: { name: 'email', value: 'zly@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleCustomerChange({
        target: { name: 'password', value: 'zle' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleAuthSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    expect(setMessage).toHaveBeenCalledWith('❌ Nieprawidłowy e-mail lub hasło!');
    expect(result.current.userRole).toBeNull();
  });

  it('wylogowanie czyści stan sesji', async () => {
    const setMessage = vi.fn();
    vi.mocked(api.post).mockImplementation(async (path: string) => {
      if (path === '/api/login') {
        return {
          ok: true,
          json: async () => ({
            user: { firstName: 'Piotr', role: 'customer' },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    const { result } = renderHook(() => useAuth(setMessage));
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    act(() => {
      result.current.handleCustomerChange({
        target: { name: 'email', value: 'a@b.co' },
      } as React.ChangeEvent<HTMLInputElement>);
      result.current.handleCustomerChange({
        target: { name: 'password', value: 'haslo123' },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    await act(async () => {
      await result.current.handleAuthSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.userRole).toBeNull();
    expect(result.current.loggedInUser).toBeNull();
    expect(api.post).toHaveBeenCalledWith('/api/logout');
  });
});
