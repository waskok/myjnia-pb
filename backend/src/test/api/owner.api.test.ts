import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../createApp.js';
import { isApiTestDbConfigured } from '../env.js';
import { loginOwner } from './helpers.js';

const app = createApp({ rateLimit: false });
const runApiTests = isApiTestDbConfigured();

describe.skipIf(!runApiTests)('Owner API', () => {
  it('GET /api/owner/employees — lista pracowników', async () => {
    const agent = await loginOwner(app);
    const res = await agent.get('/api/owner/employees').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('login');
  });

  it('GET /api/owner/customers — lista klientów', async () => {
    const agent = await loginOwner(app);
    const res = await agent.get('/api/owner/customers').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/owner/fuels/:id/price — zmiana ceny paliwa', async () => {
    const agent = await loginOwner(app);
    const fuels = await request(app).get('/api/fuels').expect(200);
    const fuelId = fuels.body[0].id;

    const res = await agent
      .patch(`/api/owner/fuels/${fuelId}/price`)
      .send({ price: 6.5 })
      .expect(200);

    expect(res.body.message).toMatch(/zaktualizowana/i);
  });

  it('GET /api/owner/deliveries — lista dostaw', async () => {
    const agent = await loginOwner(app);
    const res = await agent.get('/api/owner/deliveries').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/owner/deliveries — nowa dostawa', async () => {
    const agent = await loginOwner(app);
    const fuels = await request(app).get('/api/fuels').expect(200);

    const res = await agent
      .post('/api/owner/deliveries')
      .send({
        fuelId: fuels.body[0].id,
        quantity: 500,
        supplier: 'Test Supplier Sp. z o.o.',
        deliveryDate: '2030-07-01',
      })
      .expect(201);

    expect(res.body.message).toMatch(/zlecono dostawę/i);
  });

  it('GET /api/owner/reports — raport sprzedaży', async () => {
    const agent = await loginOwner(app);
    const res = await agent.get('/api/owner/reports').query({ period: 'all' }).expect(200);
    expect(res.body).toHaveProperty('totalRevenue');
    expect(res.body).toHaveProperty('transactions');
  });

  it('GET /api/owner/reports/wash — raport myjni', async () => {
    const agent = await loginOwner(app);
    const res = await agent
      .get('/api/owner/reports/wash')
      .query({ period: 'all' })
      .expect(200);
    expect(res.body).toHaveProperty('washes');
  });

  it('GET /api/owner/loyalty-config — konfiguracja lojalności', async () => {
    const agent = await loginOwner(app);
    const res = await agent.get('/api/owner/loyalty-config').expect(200);
    expect(res.body).toHaveProperty('pointsPerStandardWash');
  });

  it('GET /api/owner/schedule — grafik (owner)', async () => {
    const agent = await loginOwner(app);
    const now = new Date();
    const res = await agent
      .get('/api/owner/schedule')
      .query({ year: now.getFullYear(), month: now.getMonth() + 1 })
      .expect(200);
    expect(Array.isArray(res.body.schedules)).toBe(true);
  });

  it('GET /api/monitoring — owner ma dostęp do monitoringu', async () => {
    const agent = await loginOwner(app);
    const res = await agent.get('/api/monitoring').expect(200);
    expect(res.body).toHaveProperty('lpg');
  });
});
