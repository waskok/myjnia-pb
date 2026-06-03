import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthScreen } from './AuthScreen';
import type { AppLogic } from '../hooks/useAppLogic';

function authScreenProps(overrides: Partial<AppLogic> = {}): AppLogic {
  return {
    loginMode: 'customer',
    setLoginMode: vi.fn(),
    isLogin: true,
    setIsLogin: vi.fn(),
    handleAuthSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    formData: {
      accountType: 'individual',
      firstName: '',
      lastName: '',
      companyName: '',
      address: '',
      phone: '',
      email: 'test@example.com',
      password: '',
      confirmPassword: '',
      pesel: '',
      nip: '',
      regon: '',
    },
    staffData: { login: '', password: '' },
    handleCustomerChange: vi.fn(),
    handleStaffChange: vi.fn(),
    ...overrides,
  } as AppLogic;
}

describe('AuthScreen', () => {
  it('pokazuje formularz logowania klienta', () => {
    render(<AuthScreen {...authScreenProps()} />);
    expect(screen.getByRole('heading', { name: 'Zaloguj się' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zaloguj' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/E-mail/)).toBeInTheDocument();
  });

  it('pokazuje formularz rejestracji z min. 8 znaków hasła', () => {
    render(<AuthScreen {...authScreenProps({ isLogin: false })} />);
    expect(screen.getByRole('heading', { name: 'Zarejestruj się' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Hasło (min. 8 znaków)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Załóż konto' })).toBeInTheDocument();
  });

  it('pokazuje logowanie służbowe w trybie staff', () => {
    render(<AuthScreen {...authScreenProps({ loginMode: 'staff' })} />);
    expect(screen.getByRole('heading', { name: 'Logowanie służbowe' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Login pracownika lub właściciela')).toBeInTheDocument();
  });

  it('przełącza na rejestrację po kliknięciu linku', async () => {
    const setIsLogin = vi.fn();
    const user = userEvent.setup();
    render(<AuthScreen {...authScreenProps({ setIsLogin })} />);

    await user.click(screen.getByRole('button', { name: 'Nie masz konta? Zarejestruj się' }));
    expect(setIsLogin).toHaveBeenCalledWith(false);
  });
});
