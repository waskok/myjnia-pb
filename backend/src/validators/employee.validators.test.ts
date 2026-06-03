import { describe, expect, it } from 'vitest';
import { FuelTransactionSchema, MonitoringReadingsSchema } from './employee.validators.js';
import { firstZodError, parseOk } from './testHelpers.js';

describe('FuelTransactionSchema', () => {
  it('akceptuje poprawną transakcję paliwową', () => {
    const data = parseOk(FuelTransactionSchema, {
      fuelId: 1,
      quantity: 40.5,
      paymentMethod: 'Karta',
    });
    expect(data.paymentMethod).toBe('Karta');
    expect(data.issueInvoice).toBe(false);
  });

  it('odrzuca nieznaną metodę płatności', () => {
    expect(
      firstZodError(FuelTransactionSchema, {
        fuelId: 1,
        quantity: 10,
        paymentMethod: 'Bitcoin',
      }),
    ).toMatch(/metoda płatności/i);
  });

  it('odrzuca niepoprawne ID paliwa', () => {
    expect(
      firstZodError(FuelTransactionSchema, {
        fuelId: 0,
        quantity: 10,
        paymentMethod: 'Gotówka',
      }),
    ).toMatch(/ID paliwa/i);
  });
});

describe('MonitoringReadingsSchema', () => {
  it('akceptuje tablicę odczytów', () => {
    const data = parseOk(MonitoringReadingsSchema, {
      readings: [{ tank: 'E95', type: 'level', value: 75 }],
    });
    expect(data.readings).toHaveLength(1);
    expect(data.monitoringId).toBe(1);
  });

  it('odrzuca pustą listę odczytów', () => {
    expect(firstZodError(MonitoringReadingsSchema, { readings: [] })).toMatch(
      /Brak danych odczytów/i,
    );
  });
});
