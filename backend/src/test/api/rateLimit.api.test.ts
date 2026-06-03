import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../createApp.js';
import { isApiTestDbConfigured } from '../env.js';

const runApiTests = isApiTestDbConfigured();

describe.skipIf(!runApiTests)('Login rate limit', () => {
  it('po wielu nieudanych próbach logowania zwraca 429', async () => {
    const limitedApp = createApp({ rateLimit: true });

    let lastStatus = 0;
    for (let i = 0; i < 32; i++) {
      const res = await request(limitedApp)
        .post('/api/login')
        .send({ email: 'nie@example.com', password: 'zle' });
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  }, 60_000);
});
