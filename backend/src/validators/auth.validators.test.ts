import { describe, expect, it } from 'vitest';
import {
  LoginSchema,
  RegisterSchema,
  StaffLoginSchema,
} from './auth.validators.js';
import { firstZodError, parseOk } from './testHelpers.js';

const validIndividual = {
  accountType: 'individual' as const,
  firstName: 'Jan',
  lastName: 'Kowalski',
  address: 'ul. Testowa 12',
  phone: '123456789',
  email: 'jan@example.com',
  password: 'Haslo1234',
  pesel: '90010112345',
};

const validCompany = {
  accountType: 'company' as const,
  companyName: 'Firma Testowa Sp. z o.o.',
  address: 'ul. Biznesowa 1',
  phone: '987654321',
  email: 'firma@example.com',
  password: 'Haslo1234',
  nip: '1234567890',
  regon: '123456789',
};

describe('RegisterSchema', () => {
  it('akceptuje poprawną rejestrację osoby fizycznej', () => {
    const data = parseOk(RegisterSchema, validIndividual);
    expect(data.accountType).toBe('individual');
    expect(data.phone).toBe('123456789');
  });

  it('normalizuje telefon (usuwa znaki inne niż cyfry)', () => {
    const data = parseOk(RegisterSchema, {
      ...validIndividual,
      phone: '123-456-789',
    });
    expect(data.phone).toBe('123456789');
  });

  it('odrzuca hasło krótsze niż 8 znaków', () => {
    expect(firstZodError(RegisterSchema, { ...validIndividual, password: 'krótkie' })).toBe(
      'Hasło musi mieć minimum 8 znaków.',
    );
  });

  it('odrzuca niepoprawny e-mail', () => {
    expect(firstZodError(RegisterSchema, { ...validIndividual, email: 'bez-malpy' })).toMatch(
      /@/,
    );
  });

  it('odrzuca telefon o złej długości', () => {
    expect(firstZodError(RegisterSchema, { ...validIndividual, phone: '12345' })).toBe(
      'Numer telefonu musi mieć dokładnie 9 cyfr.',
    );
  });

  it('odrzuca niepoprawny PESEL', () => {
    expect(firstZodError(RegisterSchema, { ...validIndividual, pesel: '123' })).toBe(
      'PESEL musi mieć dokładnie 11 cyfr.',
    );
  });

  it('akceptuje poprawną rejestrację firmy', () => {
    const data = parseOk(RegisterSchema, validCompany);
    expect(data.accountType).toBe('company');
    expect(data.companyName).toBe('Firma Testowa Sp. z o.o.');
  });

  it('odrzuca REGON o złej długości', () => {
    expect(firstZodError(RegisterSchema, { ...validCompany, regon: '123' })).toMatch(/REGON/);
  });
});

describe('LoginSchema', () => {
  it('akceptuje niepusty e-mail i hasło', () => {
    const data = parseOk(LoginSchema, { email: 'a@b.co', password: 'x' });
    expect(data.email).toBe('a@b.co');
  });

  it('odrzuca pusty e-mail', () => {
    expect(firstZodError(LoginSchema, { email: '', password: 'x' })).toBe(
      'Podaj adres e-mail i hasło!',
    );
  });
});

describe('StaffLoginSchema', () => {
  it('akceptuje login i hasło', () => {
    const data = parseOk(StaffLoginSchema, { login: 'kasjer01', password: 'secret' });
    expect(data.login).toBe('kasjer01');
  });

  it('odrzuca pusty login', () => {
    expect(firstZodError(StaffLoginSchema, { login: '', password: 'x' })).toBe(
      'Podaj login i hasło!',
    );
  });
});
