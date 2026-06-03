import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../createApp.js';
import { isApiTestDbConfigured } from '../env.js';

const app = createApp({ rateLimit: false });
const runApiTests = isApiTestDbConfigured();

describe.skipIf(!runApiTests)('Public API', () => {
  it('GET /api/services — lista usług myjni bez logowania', async () => {
    const res = await request(app).get('/api/services').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('price');
  });

  it('GET /api/loyalty-program — program lojalnościowy publiczny', async () => {
    const res = await request(app).get('/api/loyalty-program').expect(200);
    expect(res.body).toHaveProperty('pointsPerE95');
    expect(res.body).toHaveProperty('earnPointsPerStandardWash');
  });

  it('GET /api/fuels — cennik paliw publiczny', async () => {
    const res = await request(app).get('/api/fuels').expect(200);
    expect(res.body.some((f: { type: string }) => /E95|95/i.test(f.type))).toBe(true);
  });
});
