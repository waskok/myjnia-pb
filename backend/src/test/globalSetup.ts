import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertApiTestDatabase, isApiTestDbConfigured, loadTestEnv } from './env.js';

export default async function globalSetup(): Promise<void> {
  loadTestEnv();
  process.env.NODE_ENV = 'test';

  if (!isApiTestDbConfigured()) {
    console.warn(
      '[test] Testy API pominięte — ustaw backend/.env.test z bazą *_test* (zob. .env.test.example).',
    );
    return;
  }

  assertApiTestDatabase();

  const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const env = { ...process.env };

  // Projekt bez folderu migrations — schemat wgrywamy przez db push
  execSync('npx prisma db push --skip-generate', { cwd: backendRoot, env, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd: backendRoot, env, stdio: 'inherit' });
}
