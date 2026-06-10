import type { Express } from 'express';
import request from 'supertest';

export const SEED_CUSTOMER = {
  email: 'piotr.kowalczyk@example.pl',
  password: 'Klient1234!',
};
export const SEED_OWNER = { login: 'owner', password: 'Admin1234!' };
export const SEED_EMPLOYEE = { login: 'kasjer01', password: 'Pracownik1!' };
export const SEED_MYJNIA = { login: 'myjnia01', password: 'Pracownik1!' };

const TEST_RESERVATION_YEAR = 2030;
const TEST_RESERVATION_MONTH = 12;
const TEST_RESERVATION_FIRST_DAY = 10;
const TEST_RESERVATION_OPEN_HOUR = 8;
const TEST_RESERVATION_CLOSE_HOUR = 22;
/** Odstęp między kolejnymi terminami w testach (≥ 30 min w API). */
const TEST_RESERVATION_STEP_MINUTES = 30;

let reservationSlot = 0;

export interface FutureReservationSlot {
  date: string;
  time: string;
  dateTime: string;
}

export function resetReservationSlots(): void {
  reservationSlot = 0;
}

/** Kolejny unikalny termin w grudniu 2030, sloty co 30 min (8:00–22:00), czas lokalny. */
export function nextFutureReservation(): FutureReservationSlot {
  const slotsPerDay =
    Math.floor(((TEST_RESERVATION_CLOSE_HOUR - TEST_RESERVATION_OPEN_HOUR) * 60) / TEST_RESERVATION_STEP_MINUTES) +
    1;
  const index = reservationSlot++;
  const dayOffset = Math.floor(index / slotsPerDay);
  const slotIndex = index % slotsPerDay;
  const totalMinutes = TEST_RESERVATION_OPEN_HOUR * 60 + slotIndex * TEST_RESERVATION_STEP_MINUTES;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const day = TEST_RESERVATION_FIRST_DAY + dayOffset;
  const date = `${TEST_RESERVATION_YEAR}-${String(TEST_RESERVATION_MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    date,
    time,
    dateTime: `${date}T${time}`,
  };
}

export function futureReservationIso(): string {
  return nextFutureReservation().dateTime;
}

export function shiftReservationTime(time: string, deltaMinutes: number): string {
  const [hoursRaw, minutesRaw] = time.split(':');
  const total = Number(hoursRaw) * 60 + Number(minutesRaw) + deltaMinutes;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export async function loginCustomer(app: Express) {
  const agent = request.agent(app);
  await agent.post('/api/login').send(SEED_CUSTOMER).expect(200);
  return agent;
}

export async function loginOwner(app: Express) {
  const agent = request.agent(app);
  await agent.post('/api/staff/login').send(SEED_OWNER).expect(200);
  return agent;
}

export async function loginEmployee(app: Express, creds = SEED_EMPLOYEE) {
  const agent = request.agent(app);
  await agent.post('/api/staff/login').send(creds).expect(200);
  return agent;
}
