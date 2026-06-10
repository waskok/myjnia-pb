import { describe, expect, it } from 'vitest';
import {
  buildAvailabilitySlots,
  combineDateAndTime,
  generateSlotTimes,
  hasReservationConflict,
  reservationsConflict,
} from './reservationSlots.js';

describe('reservationSlots', () => {
  it('generuje sloty od 8:00 do 22:00 co 15 minut', () => {
    const slots = generateSlotTimes();
    expect(slots[0]).toBe('08:00');
    expect(slots[1]).toBe('08:15');
    expect(slots.at(-1)).toBe('22:00');
    expect(slots).toContain('21:45');
    expect(slots).not.toContain('22:15');
  });

  it('rezerwacja o 8:30 blokuje 8:15 i 8:45, ale nie 9:00', () => {
    const existing = combineDateAndTime('2030-06-10', '08:30');

    expect(reservationsConflict(combineDateAndTime('2030-06-10', '08:15'), existing)).toBe(true);
    expect(reservationsConflict(combineDateAndTime('2030-06-10', '08:30'), existing)).toBe(true);
    expect(reservationsConflict(combineDateAndTime('2030-06-10', '08:45'), existing)).toBe(true);
    expect(reservationsConflict(combineDateAndTime('2030-06-10', '09:00'), existing)).toBe(false);
  });

  it('buildAvailabilitySlots oznacza zajęte i przeszłe terminy', () => {
    const existing = [combineDateAndTime('2030-06-10', '08:30')];
    const now = combineDateAndTime('2030-06-10', '07:00');
    const slots = buildAvailabilitySlots('2030-06-10', existing, now);

    const slot815 = slots.find((slot) => slot.time === '08:15');
    const slot845 = slots.find((slot) => slot.time === '08:45');
    const slot900 = slots.find((slot) => slot.time === '09:00');

    expect(slot815?.available).toBe(false);
    expect(slot845?.available).toBe(false);
    expect(slot900?.available).toBe(true);
  });

  it('hasReservationConflict uwzględnia wiele rezerwacji', () => {
    const existing = [
      combineDateAndTime('2030-06-10', '10:00'),
      combineDateAndTime('2030-06-10', '14:30'),
    ];

    expect(hasReservationConflict(combineDateAndTime('2030-06-10', '10:15'), existing)).toBe(true);
    expect(hasReservationConflict(combineDateAndTime('2030-06-10', '15:00'), existing)).toBe(false);
  });
});
