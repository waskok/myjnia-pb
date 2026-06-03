import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Ładuje .env.test, potem .env (bez nadpisywania już ustawionych zmiennych). */
export function loadTestEnv(): void {
  dotenv.config({ path: path.join(backendRoot, '.env.test'), quiet: true });
  dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });
}

/** Baza testowa — nazwa z "_test" w URL lub jawna flaga RUN_API_TESTS (np. Neon). */
export function isApiTestDbConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) return false;
  if (process.env.RUN_API_TESTS === 'true') return true;
  // np. myjnia_pb_test, /test_myjnia (Neon), /test?...
  return /_test\b|\/test[\w_-]/i.test(url) || /database=test/i.test(url);
}

export function assertApiTestDatabase(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Brak DATABASE_URL. Skopiuj backend/.env.test.example → backend/.env.test i ustaw bazę testową.',
    );
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('Brak JWT_SECRET w .env.test / .env');
  }
  if (!isApiTestDbConfigured()) {
    throw new Error(
      'DATABASE_URL nie wygląda na bazę testową (oczekiwane np. myjnia_pb_test w URL). ' +
        'Ustaw osobną bazę lub RUN_API_TESTS=true świadomie na dev.',
    );
  }
}
