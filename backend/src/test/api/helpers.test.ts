import { describe, expect, it, beforeEach } from 'vitest';
import {
  futureReservationIso,
  nextFutureReservation,
  resetReservationSlots,
  shiftReservationTime,
} from './helpers.js';

describe('test helpers — rezerwacje', () => {
  beforeEach(() => {
    resetReservationSlots();
  });

  it('generuje lokalny datetime bez strefy Z', () => {
    const slot = nextFutureReservation();
    expect(slot.dateTime).toMatch(/^2030-12-\d{2}T\d{2}:\d{2}$/);
    expect(slot.dateTime).not.toContain('Z');
    expect(slot.time).toBe('08:00');
  });

  it('kolejne terminy są co 30 minut', () => {
    const first = nextFutureReservation();
    const second = nextFutureReservation();
    expect(second.time).toBe('08:30');
    expect(shiftReservationTime(first.time, 30)).toBe(second.time);
  });

  it('futureReservationIso zwraca dateTime', () => {
    resetReservationSlots();
    expect(futureReservationIso()).toBe('2030-12-10T08:00');
  });
});
