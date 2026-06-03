import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../createApp.js';
import { isApiTestDbConfigured } from '../env.js';
import { loginCustomer, loginEmployee, loginOwner } from './helpers.js';

const app = createApp({ rateLimit: false });
const runApiTests = isApiTestDbConfigured();

describe.skipIf(!runApiTests)('Role authorization (403)', () => {
  it('kasjer nie ma dostępu do GET /api/owner/employees', async () => {
    const agent = await loginEmployee(app);
    const res = await agent.get('/api/owner/employees').expect(403);
    expect(res.body.error).toMatch(/uprawnień/i);
  });

  it('klient nie ma dostępu do GET /api/owner/customers', async () => {
    const agent = await loginCustomer(app);
    await agent.get('/api/owner/customers').expect(403);
  });

  it('kasjer nie może PATCH /api/monitoring/config (tylko owner)', async () => {
    const agent = await loginEmployee(app);
    await agent
      .patch('/api/monitoring/config')
      .send({ samplingIntervalSec: 30 })
      .expect(403);
  });

  it('archiwalny pracownik nie może się zalogować → 403', async () => {
    const owner = await loginOwner(app);
    const login = `arch_${Date.now()}`;
    const password = 'Archiwum1!';

    await owner
      .post('/api/owner/employees')
      .send({
        firstName: 'Arch',
        lastName: 'Test',
        role: 'Kasjer',
        login,
        password,
      })
      .expect(201);

    const employees = await owner.get('/api/owner/employees').expect(200);
    const created = employees.body.find((e: { login: string }) => e.login === login);
    expect(created).toBeDefined();

    await owner.patch(`/api/owner/employees/${created.id}/archive`).expect(200);

    const res = await request(app)
      .post('/api/staff/login')
      .send({ login, password })
      .expect(403);

    expect(res.body.error).toMatch(/archiwalne/i);

    await owner.patch(`/api/owner/employees/${created.id}/restore`).expect(200);
  });

  it('klient nie ma dostępu do GET /api/employee/reservations', async () => {
    const agent = await loginCustomer(app);
    await agent.get('/api/employee/reservations').expect(403);
  });
});
