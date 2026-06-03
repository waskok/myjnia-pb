import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  it('nie renderuje nic przy pustym komunikacie', () => {
    const { container } = render(<Toast message="" onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('pokazuje komunikat sukcesu bez emoji w tekście', () => {
    render(<Toast message="✅ Zalogowano pomyślnie!" onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Zalogowano pomyślnie!');
    expect(screen.getByRole('status')).toHaveClass('toast-success');
  });

  it('pokazuje komunikat błędu z klasą toast-error', () => {
    render(<Toast message="❌ Nieprawidłowy e-mail lub hasło!" onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveClass('toast-error');
    expect(screen.getByRole('status')).toHaveTextContent('Nieprawidłowy e-mail lub hasło!');
  });
});
