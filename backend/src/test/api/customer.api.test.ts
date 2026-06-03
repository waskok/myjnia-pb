import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../createApp.js';
import prisma from '../../prismaClient.js';
import { isApiTestDbConfigured } from '../env.js';
import {
  futureReservationIso,
  loginCustomer,
  SEED_CUSTOMER,
} from './helpers.js';

const app = createApp({ rateLimit: false });
const runApiTests = isApiTestDbConfigured();

describe.skipIf(!runApiTests)('Customer API — rezerwacje', () => {
  beforeAll(async () => {
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
});
