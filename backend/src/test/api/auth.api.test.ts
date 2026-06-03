import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../createApp.js';
import { isApiTestDbConfigured } from '../env.js';
import { SEED_CUSTOMER, SEED_EMPLOYEE, SEED_OWNER } from './helpers.js';

const app = createApp({ rateLimit: false });

const runApiTests = isApiTestDbConfigured();

describe.skipIf(!runApiTests)('Auth API', () => {
  describe('POST /api/login', () => {
    it('loguje klienta i ustawia cookie', async () => {
      const res = await request(app)
        .post('/api/login')
        .send(SEED_CUSTOMER)
        .expect(200);

      expect(res.body.message).toMatch(/Zalogowano/i);
      expect(res.body.user).toMatchObject({
        role: 'customer',
        firstName: 'Piotr',
      });
      expect(res.headers['set-cookie']?.some((c: string) => c.startsWith('token='))).toBe(true);
    });

    it('zwraca 401 przy złym haśle', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ ...SEED_CUSTOMER, password: 'zle-haslo' })
        .expect(401);

      expect(res.body.error).toMatch(/Nieprawidłowy/i);
    });

    it('zwraca 400 przy pustym e-mailu', async () => {
      await request(app).post('/api/login').send({ email: '', password: 'x' }).expect(400);
    });
  });

  describe('GET /api/me', () => {
    it('zwraca 401 bez ciasteczka', async () => {
      await request(app).get('/api/me').expect(401);
    });

    it('zwraca profil po zalogowaniu (cookie)', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send(SEED_CUSTOMER).expect(200);

      const res = await agent.get('/api/me').expect(200);
      expect(res.body).toMatchObject({
        role: 'customer',
        firstName: 'Piotr',
        lastName: 'Kowalczyk',
      });
    });
  });

  describe('POST /api/staff/login', () => {
    it('loguje właściciela', async () => {
      const res = await request(app).post('/api/staff/login').send(SEED_OWNER).expect(200);

      expect(res.body.user.role).toBe('owner');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('loguje pracownika z jobRole', async () => {
      const res = await request(app).post('/api/staff/login').send(SEED_EMPLOYEE).expect(200);

      expect(res.body.user).toMatchObject({
        role: 'employee',
        jobRole: 'Kasjer',
      });
    });

    it('zwraca 401 przy złym loginie', async () => {
      await request(app)
        .post('/api/staff/login')
        .send({ login: 'nie-istnieje', password: 'x' })
        .expect(401);
    });
  });

  describe('POST /api/logout', () => {
    it('czyści sesję — /api/me po wylogowaniu zwraca 401', async () => {
      const agent = request.agent(app);
      await agent.post('/api/login').send(SEED_CUSTOMER).expect(200);
      await agent.post('/api/logout').expect(200);
      await agent.get('/api/me').expect(401);
    });
  });

  describe('POST /api/register', () => {
    it('rejestruje nowego klienta (osoba fizyczna)', async () => {
      const email = `test.${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/register')
        .send({
          accountType: 'individual',
          firstName: 'Test',
          lastName: 'User',
          address: 'ul. Testowa 10',
          phone: '600700800',
          email,
          password: 'Test1234!',
          pesel: '85041523619',
        })
        .expect(201);

      expect(res.body.message).toMatch(/sukces/i);

      const loginRes = await request(app)
        .post('/api/login')
        .send({ email, password: 'Test1234!' })
        .expect(200);
      expect(loginRes.body.user.role).toBe('customer');
    });

    it('zwraca 400 przy duplikacie e-maila', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          accountType: 'individual',
          firstName: 'Jan',
          lastName: 'Kowalski',
          address: 'ul. Testowa 12',
          phone: '601111222',
          email: SEED_CUSTOMER.email,
          password: 'Test1234!',
          pesel: '90010112345',
        })
        .expect(400);

      expect(res.body.error).toMatch(/już istnieje/i);
    });
  });
});

describe.skipIf(!runApiTests)('Protected customer API', () => {
  it('GET /api/my-profile bez logowania → 401', async () => {
    await request(app).get('/api/my-profile').expect(401);
  });

  it('GET /api/my-profile po logowaniu → 200', async () => {
    const agent = request.agent(app);
    await agent.post('/api/login').send(SEED_CUSTOMER).expect(200);

    const res = await agent.get('/api/my-profile').expect(200);
    expect(res.body).toMatchObject({
      firstName: 'Piotr',
      loyaltyPoints: expect.any(Number),
    });
  });
});
