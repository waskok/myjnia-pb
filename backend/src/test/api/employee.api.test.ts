import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../createApp.js';
import prisma from '../../prismaClient.js';
import { isApiTestDbConfigured } from '../env.js';
import {
  futureReservationIso,
  resetReservationSlots,
  loginCustomer,
  loginEmployee,
  loginOwner,
  SEED_CUSTOMER,
  SEED_MYJNIA,
} from './helpers.js';

const app = createApp({ rateLimit: false });
const runApiTests = isApiTestDbConfigured();

describe.skipIf(!runApiTests)('Employee API — POS i myjnia', () => {
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

  async function getFuelId(): Promise<number> {
    const res = await request(app).get('/api/fuels').expect(200);
    return res.body[0].id as number;
  }

  it('POST /api/transactions/fuel — sprzedaż kartą', async () => {
    const agent = await loginEmployee(app);
    const fuelId = await getFuelId();

    const res = await agent
      .post('/api/transactions/fuel')
      .send({
        fuelId,
        quantity: 1,
        paymentMethod: 'Karta',
        customerEmail: SEED_CUSTOMER.email,
      })
      .expect(201);

    expect(res.body.message).toMatch(/Sprzedano|zł/i);
  });

  it('POST /api/transactions/fuel — faktura dla zarejestrowanego klienta', async () => {
    const agent = await loginEmployee(app);
    const fuelId = await getFuelId();

    const res = await agent
      .post('/api/transactions/fuel')
      .send({
        fuelId,
        quantity: 2,
        paymentMethod: 'Karta',
        customerEmail: SEED_CUSTOMER.email,
        issueInvoice: true,
      })
      .expect(201);

    expect(res.body.message).toMatch(/Faktur/i);
    expect(res.body.invoice).toBeDefined();
  });

  it('POST /api/transactions/fuel — za mało punktów → 400', async () => {
    const customer = await prisma.customer.findUnique({
      where: { email: SEED_CUSTOMER.email },
    });
    const prev = customer!.loyaltyPoints;
    await prisma.customer.update({
      where: { id: customer!.id },
      data: { loyaltyPoints: 0 },
    });

    try {
      const agent = await loginEmployee(app);
      const fuelId = await getFuelId();

      const res = await agent
        .post('/api/transactions/fuel')
        .send({
          fuelId,
          quantity: 50,
          paymentMethod: 'Punkty',
          customerEmail: SEED_CUSTOMER.email,
        })
        .expect(400);

      expect(res.body.error).toMatch(/Za mało punktów/i);
    } finally {
      await prisma.customer.update({
        where: { id: customer!.id },
        data: { loyaltyPoints: prev },
      });
    }
  });

  it('GET /api/employee/reservations — lista rezerwacji', async () => {
    const agent = await loginEmployee(app, SEED_MYJNIA);
    const res = await agent.get('/api/employee/reservations').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH anulowanie rezerwacji przez obsługę myjni', async () => {
    const customerAgent = await loginCustomer(app);
    const services = await request(app).get('/api/services').expect(200);
    const washServiceId = services.body[0].id;
    const dateTime = futureReservationIso();
    const expectedMs = new Date(dateTime).getTime();

    await customerAgent
      .post('/api/reservations')
      .send({
        washServiceId,
        date: dateTime,
        paymentMode: 'cash',
      })
      .expect(201);

    const myjnia = await loginEmployee(app, SEED_MYJNIA);
    const list = await myjnia.get('/api/employee/reservations').expect(200);
    const pending = list.body.find(
      (r: { status: string; date: string }) =>
        r.status === 'Oczekująca' && new Date(r.date).getTime() === expectedMs,
    );
    expect(pending).toBeDefined();

    await myjnia
      .patch(`/api/employee/reservations/${pending.id}/cancel`)
      .expect(200);

    const updated = await myjnia.get('/api/employee/reservations').expect(200);
    const found = updated.body.find((r: { id: number }) => r.id === pending.id);
    expect(found.status).toBe('Anulowana');
  });
});

describe.skipIf(!runApiTests)('Employee API — monitoring', () => {
  it('GET /api/monitoring — dane monitoringu (kasjer)', async () => {
    const agent = await loginEmployee(app);
    const res = await agent.get('/api/monitoring').expect(200);
    expect(res.body).toHaveProperty('fuels');
    expect(res.body).toHaveProperty('alerts');
  });

  it('POST /api/monitoring/readings — zapis odczytu LPG', async () => {
    const agent = await loginEmployee(app);
    const res = await agent
      .post('/api/monitoring/readings')
      .send({
        readings: [
          { tank: 'LPG', type: 'level', value: 55 },
          { tank: 'LPG', type: 'pressure', value: 1.2 },
        ],
      })
      .expect(201);

    expect(res.body.message).toMatch(/zapisane/i);
  });

  it('GET /api/employee/schedule — grafik pracownika', async () => {
    const agent = await loginEmployee(app);
    const now = new Date();
    const res = await agent
      .get('/api/employee/schedule')
      .query({ year: now.getFullYear(), month: now.getMonth() + 1 })
      .expect(200);
    expect(Array.isArray(res.body.schedules)).toBe(true);
  });

  it('klient nie może POST /api/transactions/fuel → 403', async () => {
    const agent = await loginCustomer(app);
    await agent
      .post('/api/transactions/fuel')
      .send({ fuelId: 1, quantity: 1, paymentMethod: 'Karta' })
      .expect(403);
  });
});
