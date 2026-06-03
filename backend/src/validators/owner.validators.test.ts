import { describe, expect, it } from 'vitest';
import {
  AddEmployeeSchema,
  DeliverySchema,
  FuelPriceSchema,
  ScheduleCreateSchema,
  UpdateEmployeePasswordSchema,
} from './owner.validators.js';
import { firstZodError, parseOk } from './testHelpers.js';

describe('AddEmployeeSchema', () => {
  const valid = {
    firstName: 'Anna',
    lastName: 'Nowak',
    role: 'Kasjer',
    login: 'kasjer02',
    password: 'Haslo1234',
  };

  it('akceptuje poprawne dane pracownika', () => {
    expect(parseOk(AddEmployeeSchema, valid).login).toBe('kasjer02');
  });

  it('odrzuca zbyt krótkie hasło', () => {
    expect(firstZodError(AddEmployeeSchema, { ...valid, password: '123' })).toBe(
      'Hasło musi mieć minimum 8 znaków.',
    );
  });
});

describe('UpdateEmployeePasswordSchema', () => {
  it('wymaga minimum 8 znaków', () => {
    expect(firstZodError(UpdateEmployeePasswordSchema, { password: 'abc' })).toBe(
      'Hasło musi mieć minimum 8 znaków.',
    );
  });
});

describe('DeliverySchema', () => {
  it('akceptuje poprawną dostawę', () => {
    const data = parseOk(DeliverySchema, {
      fuelId: '1',
      quantity: '1000',
      supplier: 'Orlen',
      deliveryDate: '2026-06-01',
    });
    expect(data.fuelId).toBe(1);
    expect(data.quantity).toBe(1000);
  });

  it('odrzuca ujemną ilość', () => {
    expect(firstZodError(DeliverySchema, {
      fuelId: 1,
      quantity: -5,
      supplier: 'Orlen',
      deliveryDate: '2026-06-01',
    })).toMatch(/dodatnia/i);
  });
});

describe('FuelPriceSchema', () => {
  it('odrzuca cenę zerową lub ujemną', () => {
    expect(firstZodError(FuelPriceSchema, { price: 0 })).toMatch(/dodatnią/i);
    expect(firstZodError(FuelPriceSchema, { price: -1 })).toMatch(/dodatnią/i);
  });

  it('akceptuje dodatnią cenę', () => {
    expect(parseOk(FuelPriceSchema, { price: '6.39' }).price).toBe(6.39);
  });
});

describe('ScheduleCreateSchema', () => {
  const valid = {
    employeeId: '1',
    startTime: '08:00',
    endTime: '16:00',
    dates: ['2026-06-10'],
  };

  it('akceptuje poprawny grafik', () => {
    expect(parseOk(ScheduleCreateSchema, valid).startTime).toBe('08:00');
  });

  it('odrzuca godzinę zakończenia przed rozpoczęciem', () => {
    expect(
      firstZodError(ScheduleCreateSchema, {
        ...valid,
        startTime: '16:00',
        endTime: '08:00',
      }),
    ).toMatch(/późniejsza/i);
  });

  it('odrzuca zły format godziny', () => {
    expect(firstZodError(ScheduleCreateSchema, { ...valid, startTime: '8:00' })).toMatch(
      /HH:mm/,
    );
  });

  it('wymaga co najmniej jednej daty', () => {
    expect(firstZodError(ScheduleCreateSchema, { ...valid, dates: [] })).toBe(
      'Wymagana co najmniej jedna data.',
    );
  });
});
