export const RESERVATION_OPEN_HOUR = 8;
export const RESERVATION_CLOSE_HOUR = 22;
export const RESERVATION_SLOT_MINUTES = 15;
/** Minimalny odstęp między początkami rezerwacji (np. 8:30 blokuje 8:15 i 8:45, 9:00 wolne). */
export const RESERVATION_MIN_GAP_MINUTES = 30;
export const ACTIVE_RESERVATION_STATUS = 'Oczekująca';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ReservationSlot {
  time: string;
  available: boolean;
}

export function isValidReservationDate(date: string): boolean {
  return DATE_ONLY_REGEX.test(date);
}

export function formatSlotTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function generateSlotTimes(): string[] {
  const slots: string[] = [];
  for (let hour = RESERVATION_OPEN_HOUR; hour <= RESERVATION_CLOSE_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += RESERVATION_SLOT_MINUTES) {
      if (hour === RESERVATION_CLOSE_HOUR && minute > 0) break;
      slots.push(formatSlotTime(hour, minute));
    }
  }
  return slots;
}

export function combineDateAndTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export function getDayBounds(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return { start, end };
}

export function isAllowedSlotTime(time: string): boolean {
  if (!TIME_REGEX.test(time)) return false;
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (minutes % RESERVATION_SLOT_MINUTES !== 0) return false;
  if (hours < RESERVATION_OPEN_HOUR || hours > RESERVATION_CLOSE_HOUR) return false;
  if (hours === RESERVATION_CLOSE_HOUR && minutes > 0) return false;
  return true;
}

export function getMinutesDifference(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (60 * 1000);
}

export function reservationsConflict(candidate: Date, existing: Date): boolean {
  return getMinutesDifference(candidate, existing) < RESERVATION_MIN_GAP_MINUTES;
}

export function hasReservationConflict(
  candidate: Date,
  existingReservations: Date[],
): boolean {
  return existingReservations.some((existing) => reservationsConflict(candidate, existing));
}

export function buildAvailabilitySlots(
  date: string,
  existingReservations: Date[],
  now: Date = new Date(),
): ReservationSlot[] {
  return generateSlotTimes().map((time) => {
    const slotDate = combineDateAndTime(date, time);
    const isPast = slotDate.getTime() < now.getTime();
    const isTaken = hasReservationConflict(slotDate, existingReservations);
    return {
      time,
      available: !isPast && !isTaken,
    };
  });
}
