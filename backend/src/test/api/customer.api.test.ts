import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../createApp.js';
import prisma from '../../prismaClient.js';
import { isApiTestDbConfigured } from '../env.js';
import {
  futureReservationIso,
  loginCustomer,
  loginEmployee,
  nextFutureReservation,
  resetReservationSlots,
  SEED_CUSTOMER,
  SEED_MYJNIA,
  shiftReservationTime,
} from './helpers.js';

const app = createApp({ rateLimit: false });
const runApiTests = isApiTestDbConfigured();

describe.skipIf(!runApiTests)('Customer API — rezerwacje', () => {
  beforeAll(async () => {
    resetReservationSlots();
    await prisma.reservation.deleteMany({
      where: { date: { gte: new Date('2030-01-01T00:00:00.000Z') } },
    });
    await prisma.customer.update({
      where: { email: SEED_CUSTOMER.email },
      data: { loyaltyPoints: 450 },
    });
  });

  async function getStandardWashId(): Promise<number> {
    const res = await request(app).get('/api/services').expect(200);
    const standard = res.body.find((s: { type: string }) =>
      /standardowe/i.test(s.type),
    );
    expect(standard).toBeDefined();
    return standard.id as number;
  }

  it('POST /api/reservations — rezerwacja gotówką', async () => {
    const agent = await loginCustomer(app);
    const washServiceId = await getStandardWashId();

    const res = await agent
      .post('/api/reservations')
      .send({
        washServiceId,
        date: futureReservationIso(),
        paymentMode: 'cash',
      })
      .expect(201);

    expect(res.body.message).toMatch(/rezerwacj/i);
  });

  it('POST /api/reservations — rezerwacja za punkty', async () => {
    const agent = await loginCustomer(app);
    const washServiceId = await getStandardWashId();

    const profile = await agent.get('/api/my-profile').expect(200);
    const beforePoints = profile.body.loyaltyPoints as number;

    await agent
      .post('/api/reservations')
      .send({
        washServiceId,
        date: futureReservationIso(),
        paymentMode: 'points',
        pointsCost: 300,
      })
      .expect(201);

    const after = await agent.get('/api/my-profile').expect(200);
    expect(after.body.loyaltyPoints).toBe(beforePoints - 300);
  });

  it('POST /api/reservations — za mało punktów → 400', async () => {
    const customer = await prisma.customer.findUnique({
      where: { email: SEED_CUSTOMER.email },
    });
    expect(customer).toBeTruthy();

    const previousPoints = customer!.loyaltyPoints;
    await prisma.customer.update({
      where: { id: customer!.id },
      data: { loyaltyPoints: 5 },
    });

    try {
      const agent = await loginCustomer(app);
      const washServiceId = await getStandardWashId();

      const res = await agent
        .post('/api/reservations')
        .send({
          washServiceId,
          date: futureReservationIso(),
          paymentMode: 'points',
          pointsCost: 300,
        })
        .expect(400);

      expect(res.body.error).toMatch(/Za mało punktów/i);
    } finally {
      await prisma.customer.update({
        where: { id: customer!.id },
        data: { loyaltyPoints: previousPoints },
      });
    }
  });

  it('GET /api/my-reservations — lista rezerwacji klienta', async () => {
    const agent = await loginCustomer(app);
    const res = await agent.get('/api/my-reservations').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/reservations bez logowania → 401', async () => {
    await request(app)
      .post('/api/reservations')
      .send({ washServiceId: 1, date: futureReservationIso() })
      .expect(401);
  });

  it('GET /api/reservations/availability — zwraca sloty dla daty', async () => {
    const res = await request(app)
      .get('/api/reservations/availability')
      .query({ date: '2030-12-25' })
      .expect(200);

    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots[0]).toMatchObject({ time: '08:00', available: expect.any(Boolean) });
    expect(res.body.slots.some((slot: { time: string }) => slot.time === '22:00')).toBe(true);
  });

  it('POST /api/reservations — blokuje sąsiednie sloty (±15 min)', async () => {
    const agent = await loginCustomer(app);
    const washServiceId = await getStandardWashId();
    const { date, time, dateTime } = nextFutureReservation();

    await agent
      .post('/api/reservations')
      .send({
        washServiceId,
        date: dateTime,
        paymentMode: 'cash',
      })
      .expect(201);

    const availability = await request(app)
      .get('/api/reservations/availability')
      .query({ date })
      .expect(200);

    const slot = (slotTime: string) =>
      availability.body.slots.find((entry: { time: string }) => entry.time === slotTime);

    expect(slot(shiftReservationTime(time, -15))?.available).toBe(false);
    expect(slot(time)?.available).toBe(false);
    expect(slot(shiftReservationTime(time, 15))?.available).toBe(false);
    expect(slot(shiftReservationTime(time, 30))?.available).toBe(true);

    await agent
      .post('/api/reservations')
      .send({
        washServiceId,
        date: `${date}T${shiftReservationTime(time, 15)}`,
        paymentMode: 'cash',
      })
      .expect(400);
  });

  it('GET /api/reservations/availability — po anulowaniu slot wraca do dyspozycji', async () => {
    const customer = await loginCustomer(app);
    const myjnia = await loginEmployee(app, SEED_MYJNIA);
    const washServiceId = await getStandardWashId();
    const { date, time, dateTime } = nextFutureReservation();
    const expectedMs = new Date(dateTime).getTime();

    await customer
      .post('/api/reservations')
      .send({
        washServiceId,
        date: dateTime,
        paymentMode: 'cash',
      })
      .expect(201);

    const blocked = await request(app)
      .get('/api/reservations/availability')
      .query({ date })
      .expect(200);
    expect(
      blocked.body.slots.find((entry: { time: string }) => entry.time === time)?.available,
    ).toBe(false);

    const list = await myjnia.get('/api/employee/reservations').expect(200);
    const pending = list.body.find(
      (entry: { date: string; status: string }) =>
        entry.status === 'Oczekująca' && new Date(entry.date).getTime() === expectedMs,
    );
    expect(pending).toBeDefined();

    await myjnia.patch(`/api/employee/reservations/${pending.id}/cancel`).expect(200);

    const afterCancel = await request(app)
      .get('/api/reservations/availability')
      .query({ date })
      .expect(200);
    expect(
      afterCancel.body.slots.find((entry: { time: string }) => entry.time === time)?.available,
    ).toBe(true);
  });
});
