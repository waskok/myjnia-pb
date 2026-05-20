# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
This is a PERN stack gas station & car wash management system ("myjnia-pb") with two independent Node.js projects:
- **Backend** (`/workspace/backend`): Express.js + Prisma + PostgreSQL on port 5000
- **Frontend** (`/workspace/frontend`): React + Vite on port 5173

### Prerequisites
- **PostgreSQL 16** must be running before starting the backend. Start it with `sudo pg_ctlcluster 16 main start`.
- The backend expects a `.env` file at `/workspace/backend/.env` with `DATABASE_URL`, `JWT_SECRET`, and optionally `PORT`.

### Running services
- **Backend**: `npm run dev` in `/workspace/backend` (uses `tsx watch` for hot reload)
- **Frontend**: `npm run dev` in `/workspace/frontend` (Vite dev server)
- The frontend hardcodes API calls to `http://localhost:5000`.

### Database setup
- After fresh install, run `npx prisma generate && npx prisma db push` in `/workspace/backend` to create the schema.
- Seed scripts: `npx tsx prisma/seed.ts`, `npx tsx prisma/seedEmployee.ts`, `npx tsx prisma/seedSales.ts` (all idempotent).
- Seed scripts are idempotent (they check for existing data before inserting).

### Test accounts (from seed data)
- **Owner**: login `szef`, password `zaq1@WSX` (via staff login at `/api/staff/login`)
- **Employee**: login `pracownik1`, password `zaq1@WSX` (via staff login at `/api/staff/login`)
- Customer accounts are created via `/api/register` with email-based login at `/api/login`.

### Lint / Build
- **Frontend lint**: `npm run lint` in `/workspace/frontend` (ESLint)
- **Frontend build**: `npm run build` in `/workspace/frontend` (note: pre-existing TS error in `App.tsx` — unused React import)
- **Backend type check**: `npx tsc --noEmit` in `/workspace/backend` (note: pre-existing error in `prisma.config.ts`)

### Gotchas
- The backend uses ES modules (`"type": "module"`) with `.js` extensions in imports (even for `.ts` files) — this is intentional for NodeNext module resolution.
- No automated test suite exists in this codebase; testing is manual only.
- Both `package-lock.json` files use npm (not pnpm/yarn).
