import type { Express } from 'express';
import request from 'supertest';

export const SEED_CUSTOMER = {
  email: 'piotr.kowalczyk@example.pl',
  password: 'Klient1234!',
};
export const SEED_OWNER = { login: 'owner', password: 'Admin1234!' };
export const SEED_EMPLOYEE = { login: 'kasjer01', password: 'Pracownik1!' };
export const SEED_MYJNIA = { login: 'myjnia01', password: 'Pracownik1!' };

let reservationSlot = 0;

/** Stałe terminy w grudniu 2030 UTC — z odstępem ≥3 h (reguła 1 h w API). */
export function futureReservationIso(): string {
  const i = reservationSlot++;
  const day = 10 + Math.floor(i / 4);
  const hour = 8 + (i % 4) * 3;
  return `2030-12-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
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
