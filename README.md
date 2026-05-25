# System Obsługi i Monitoringu Stacji Paliw z Myjnią (myjnia-pb)

Kompleksowa aplikacja webowa typu full-stack, zaprojektowana w architekturze klient-serwer, przeznaczona do automatyzacji procesów biznesowych, obsługi sprzedaży oraz monitorowania infrastruktury technicznej stacji paliw i myjni samochodowej. System wdraża kontrolę dostępu opartą na rolach (RBAC) i oferuje trzy dedykowane moduły: panel klienta, panel pracownika oraz panel właściciela.

## Stos Technologiczny

*   **Frontend:** React, TypeScript, Vite, CSS (zmienne CSS, autorski system powiadomień Toast).
*   **Backend:** Node.js, Express.js, TypeScript.
*   **Baza danych i ORM:** PostgreSQL, Prisma ORM.
*   **Autoryzacja i bezpieczeństwo:** JSON Web Tokens (JWT), hashowanie haseł przy użyciu algorytmu bcrypt.

## Kluczowe Funkcjonalności Systemu

### 1. Panel Klienta (Strefa Konsumenta)
*   **Zarządzanie rezerwacjami:** Możliwość rezerwacji terminów myjni z walidacją uniemożliwiającą wybór dat wstecznych oraz algorytmem wymuszającym zachowanie minimum godzinnego odstępu między operacjami w celu uniknięcia konfliktów.
*   **Program lojalnościowy:** Moduł naliczania punktów lojalnościowych za zakup paliw oraz usług myjni z bieżącym podglądem stanu konta.
*   **Ewidencja transakcji:** Wgląd w pełną historię zakupów powiązanych z kontem klienta.

### 2. Panel Pracownika (Kasa POS & Monitoring)
*   **Obsługa stanowiska POS:** Rejestracja sprzedaży paliw (E95, E98, Diesel, LPG) z funkcją wyszukiwania klientów w bazie (e-mail/telefon) oraz automatycznym pomniejszaniem stanów magazynowych w zbiornikach.
*   **Rozliczanie punktowe:** Możliwość finalizacji transakcji poprzez wymianę punktów lojalnościowych klienta na towary/usługi.
*   **Dokumentowanie sprzedaży:** Automatyczne generowanie faktur VAT dla zarejestrowanych podmiotów gospodarczych.
*   **Centrum Monitoringu technicznego:** Wyświetlanie rzeczywistych odczytów z sensorów stacji (ciśnienie i temperatura instalacji LPG, poziomy paliw) wraz z systemem powiadomień o stanach krytycznych i awariach kamer CCTV.
*   **Grafik pracy:** Podgląd indywidualnego harmonogramu zmian przypisanych przez administratora.

### 3. Panel Właściciela (Zarządzanie Biznesem)
*   **Moduł analityczno-raportowy:** Agregacja danych sprzedażowych (całkowity utarg, liczba transakcji, średnia wartość koszyka) z filtrowaniem w ujęciu dziennym, miesięcznym oraz rocznym.
*   **Zarządzanie zasobami ludzkimi:** Pełna obsługa procesów CRUD w odniesieniu do kont pracowników (definiowanie ról i uprawnień).
*   **Planowanie czasu pracy:** Interaktywny kalendarz umożliwiający masowe przypisywanie zmian i godzin startu personelowi.
*   **Logistyka i zaopatrzenie:** System zlecania i odbioru dostaw paliw, zintegrowany z automatyczną aktualizacją pojemności zbiorników stacji.

## Struktura Bazy Danych (Prisma Schema)

Architektura relacyjna bazy danych PostgreSQL uwzględnia optymalizację spójności danych:
*   Zastosowanie polimorfizmu dla struktury klientów z podziałem na `IndividualCustomer` (weryfikacja PESEL) oraz `CompanyCustomer` (weryfikacja NIP i REGON).
*   Wdrożenie więzów integralności z mechanizmem kaskadowego usuwania (`onDelete: Cascade`) dla harmonogramów pracy powiązanych z personelem.
*   Ścisłe powiązanie obiektów transakcji (`Transaction`) z tabelami pozycji szczegółowych (`TransactionItem`) oraz fakturami (`Invoice`).

## Instrukcja Wdrożenia Lokalnego

### Wymagania wstępne
*   Środowisko uruchomieniowe Node.js (wersja LTS).
*   Dostęp do instancji bazy danych PostgreSQL.

### Instalacja i konfiguracja
1. Sklonuj repozytorium projektu.
2. Zainstaluj zależności w katalogach `/backend` oraz `/frontend`:
   npm install
3. W katalogu /backend utwórz plik konfiguracji środowiskowej .env na podstawie poniższego szablonu:
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
   JWT_SECRET="your_JWT"
   PORT="port"
4. Wykonaj migracje struktur bazodanowych:
   npx prisma migrate dev

### Poświadczenia kont testowych (Seed)
Do celów weryfikacji i prezentacji systemu wygenerowano następujące konta dostępowe:
*   **Konto Właściciela:** Login: `szef` | Hasło: `zaq1@WSX`
*   **Konto Pracownika:** Login: `pracownik1` | Hasło: `zaq1@WSX`
