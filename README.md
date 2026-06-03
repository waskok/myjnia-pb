# Myjnia-PB — system obsługi stacji paliw z myjnią

Aplikacja webowa full-stack do obsługi sprzedaży paliw, rezerwacji myjni, programu lojalnościowego, monitoringu zbiorników oraz panelu właściciela. Dostęp oparty na rolach: **klient**, **pracownik** (różne stanowiska), **właściciel**.

## Stos technologiczny

| Warstwa | Technologie |
|---------|-------------|
| Frontend | React 19, TypeScript, Vite, CSS |
| Backend | Node.js, Express 5, TypeScript |
| Baza danych | PostgreSQL, Prisma ORM |
| Bezpieczeństwo | JWT w **HttpOnly** cookies, bcrypt, Zod, express-rate-limit |

## Architektura

```
myjnia-pb/
├── backend/
│   ├── prisma/           # schema.prisma, seed.ts
│   └── src/
│       ├── middleware/   # authenticate, errorHandler
│       ├── validators/   # schematy Zod (auth, owner, employee)
│       └── routes/       # auth, customer, employee, owner
└── frontend/
    └── src/
        ├── components/   # panele UI, cennik publiczny
        ├── hooks/        # useAuth, useCustomer, useReservations, …
        └── utils/        # apiClient, pdfGenerator
```

Hook `useAppLogic` jest kompozytorem — łączy wyspecjalizowane hooki i udostępnia jeden interfejs dla `App.tsx` oraz paneli.

### Backend — skrót API

- `POST /api/register`, `/api/login`, `/api/staff/login`, `/api/logout`, `GET /api/me`
- Klient: usługi, rezerwacje, profil, transakcje, program lojalnościowy (publiczny podgląd)
- Pracownik: POS, rezerwacje myjni, monitoring, grafik
- Właściciel: pracownicy, klienci, cennik, dostawy, raporty, grafik, konfiguracja lojalności i monitoringu

### Bezpieczeństwo

- Token JWT w ciasteczku `HttpOnly` (nie w `localStorage`)
- CORS z `credentials: true` i `FRONTEND_URL`
- Walidacja wejścia przez **Zod** (m.in. hasło min. **8** znaków przy rejestracji)
- Limit logowania: **30** nieudanych prób na 15 minut (`/api/login`, `/api/staff/login`)
- Middleware `authenticate` + `requireRole` na chronionych endpointach
- Globalny `errorHandler` dla błędów 500

## Funkcjonalności

### Klient
- Rezerwacja myjni (gotówka lub punkty), historia rezerwacji i zakupów
- Publiczny cennik i opis programu lojalnościowego bez logowania

### Pracownik (role: Kasjer, Obsługa Myjni, Monitoring, Obsługa dystrybutora LPG)
- Kasa POS: paliwa, punkty, faktury PDF
- Zarządzanie rezerwacjami myjni
- Monitoring zbiorników i LPG
- Podgląd grafiku

### Właściciel
- Cennik paliw i usług myjni, program lojalnościowy
- Pracownicy (CRUD, archiwizacja), klienci, dostawy paliw
- Raporty sprzedaży, myjni i monitoringu
- Grafik pracowników

## Wymagania

- Node.js (LTS)
- PostgreSQL

## Uruchomienie lokalne

### 1. Zależności

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Zmienne środowiskowe

**`backend/.env`** (wzór: `backend/.env.example`):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/myjnia_pb?schema=public"
JWT_SECRET="twoj-losowy-sekret-jwt"
PORT=5000
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
```

**`frontend/.env`** (wzór: `frontend/.env.example`):

```env
VITE_API_URL=http://localhost:5000
```

### 3. Baza danych

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

Seed tworzy m.in. właściciela, 3 pracowników, 5 klientów, cennik paliw, usługi myjni, przykładowe rezerwacje i transakcje POS.

### 4. Start aplikacji

```bash
# terminal 1 — backend
cd backend
npm run dev

# terminal 2 — frontend
cd frontend
npm run dev
```

Frontend: [http://localhost:5173](http://localhost:5173)  
Backend: [http://localhost:5000](http://localhost:5000)

### Skrypty pomocnicze

| Katalog | Polecenie | Opis |
|---------|-----------|------|
| backend | `npm run dev` | Serwer z hot-reload (tsx) |
| backend | `npm run build` | Kompilacja TypeScript |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | Build produkcyjny |
| frontend | `npm run lint` | ESLint |
| frontend | `npm test` | Testy UI (Vitest + Testing Library, bez przeglądarki) |
| frontend | `npm run test:watch` | Testy frontend w trybie watch |
| backend | `npm test` | Testy automatyczne (Vitest) |
| backend | `npm run test:watch` | Testy w trybie watch |

## Testy automatyczne

### Faza 1 — walidatory (bez bazy)

```bash
cd backend
npm test
```

Sprawdza schematy Zod (rejestracja, logowanie, cennik, grafik itd.).

### Faza 2 — API (wymaga bazy testowej)

1. Utwórz osobną bazę PostgreSQL, np. `myjnia_pb_test`.
2. Skopiuj `backend/.env.test.example` → `backend/.env.test` i uzupełnij `DATABASE_URL` (nazwa bazy musi zawierać `_test`, np. `myjnia_pb_test`).
3. Uruchom testy — przed testami API wykonywane są `prisma migrate deploy` i `seed`:

```bash
cd backend
npm test
```

Testy API (na bazie `test_myjnia` / Neon) obejmują m.in.:

- **Publiczne:** `/api/services`, `/api/loyalty-program`, `/api/fuels`
- **Klient:** rezerwacja (gotówka / punkty), za mało punktów, `my-reservations`
- **Pracownik:** POS (karta, faktura, za mało punktów), myjnia (lista, anulowanie), monitoring, grafik
- **Właściciel:** pracownicy, klienci, cena paliwa, dostawy, raporty, lojalność, grafik, monitoring
- **Uprawnienia:** `403` (kasjer ≠ owner, klient ≠ employee, config monitoringu tylko owner)
- **Edge:** archiwalny pracownik nie loguje się (`403`), limit logowania (`429`)

Łącznie ok. **74 testy** (`npm test`).

Bez `.env.test` testy API są **pomijane**; walidatory i tak się uruchamiają.

### Frontend (Vitest + React Testing Library)

```bash
cd frontend
npm test
```

Ok. **34 testy**: hooki (`useAuth`, `useCustomer`, `useReservations`), komponenty (`Toast`, `AuthScreen`, `CustomerPanel`, `PublicPricing`), `apiClient`, `pdfGenerator`. **Bez Playwright** — mock API, bez backendu (szybkie, ~8 s).

## Konta testowe (po seedzie)

| Rola | Login / e-mail | Hasło |
|------|----------------|-------|
| Właściciel | `owner` | `Admin1234!` |
| Kasjer | `kasjer01` | `Pracownik1!` |
| Obsługa myjni | `myjnia01` | `Pracownik1!` |
| Obsługa LPG | `lpg01` | `Pracownik1!` |
| Klient | `piotr.kowalczyk@example.pl` | `Klient1234!` |

Dodatkowi klienci z seeda: `kasia.lewandowska@example.pl`, `michal.dabrowski@example.pl`, `biuro@autoflota.pl`, `kontakt@transportmax.pl` — hasło: `Klient1234!`

## Baza danych (Prisma)

- Klienci: osoba fizyczna (`IndividualCustomer`) lub firma (`CompanyCustomer`)
- Transakcje z pozycjami (`TransactionItem`) i opcjonalnymi fakturami (`Invoice`)
- Monitoring: odczyty sensorów, konfiguracja progów, symulator próbkowania
- Grafik: `WorkSchedule` powiązany z właścicielem i pracownikiem

Szczegóły modeli: `backend/prisma/schema.prisma`.
