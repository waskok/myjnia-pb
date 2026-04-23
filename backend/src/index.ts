import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// 1. Wczytujemy ukryty plik .env z naszym linkiem do Neona
dotenv.config(); 

const app = express();

// TUTAJ JEST ZMIANA: Czyste i proste wywołanie PrismaClient
const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Pozwala na łączenie się frontendu z backendem
app.use(express.json()); // Pozwala odczytywać dane z formularzy w formacie JSON

// Prosty endpoint testowy
app.get('/api/status', (req, res) => {
  res.json({ message: 'Serwer myjni PB działa i jest gotowy na żądania!' });
});

// Endpoint testujący połączenie z bazą danych
app.get('/api/db-check', async (req, res) => {
  try {
    const ownersCount = await prisma.owner.count();
    res.json({ message: `Połączenie z bazą działa! Liczba właścicieli w bazie: ${ownersCount}` });
  } catch (error) {
    res.status(500).json({ error: 'Błąd połączenia z bazą danych' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serwer uruchomiony pod adresem: http://localhost:${PORT}`);
});

// Endpoint do rejestracji użytkownika
app.post('/api/register', async (req, res) => {
  try {
    // 1. Pobieramy dane wysłane z formularza na frontendzie
    const { firstName, lastName, address, phone, email, password } = req.body;

    // 2. Sprawdzamy, czy wszystkie wymagane pola zostały wypełnione
    if (!firstName || !lastName || !address || !phone || !email || !password) {
      return res.status(400).json({ error: 'Wszystkie pola są wymagane!' });
    }

    // 3. Sprawdzamy, czy użytkownik z takim emailem już istnieje w bazie
    const existingUser = await prisma.customer.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik o podanym adresie e-mail już istnieje!' });
    }

    // 4. Szyfrujemy hasło paczką bcrypt (10 to poziom skomplikowania szyfrowania)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Zapisujemy nowego klienta w bazie Neona
    const newCustomer = await prisma.customer.create({
      data: {
        firstName,
        lastName,
        address,
        phone,
        email,
        password: hashedPassword,
        registered: true // Oznaczamy, że to klient zarejestrowany
      }
    });

    res.status(201).json({ message: 'Rejestracja zakończona sukcesem!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera podczas rejestracji.' });
  }
});

// Endpoint do logowania użytkownika
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Sprawdzamy, czy użytkownik w ogóle coś wpisał
    if (!email || !password) {
      return res.status(400).json({ error: 'Podaj adres e-mail i hasło!' });
    }

    // 2. Szukamy klienta w bazie po emailu
    const user = await prisma.customer.findUnique({
      where: { email }
    });

    // Jeśli nie ma takiego użytkownika lub nie ma ustawionego hasła
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło!' });
    }

    // 3. Porównujemy wpisane hasło z tym zaszyfrowanym w bazie
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło!' });
    }

    // 4. Jeśli wszystko gra, generujemy token JWT
    // Token działa jak wirtualna opaska na rękę w klubie
    const token = jwt.sign(
      { id: user.id, email: user.email }, // Informacje wewnątrz tokena
      process.env.JWT_SECRET as string,   // Tajny klucz szyfrujący z pliku .env
      { expiresIn: '2h' }                 // Czas "życia" tokena (2 godziny)
    );

    // 5. Wysyłamy sukces i token do przeglądarki
    res.status(200).json({ 
      message: 'Zalogowano pomyślnie!', 
      token: token,
      user: { firstName: user.firstName, lastName: user.lastName } // Odsyłamy też imię do powitania
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera podczas logowania.' });
  }
});
// Endpoint do pobierania cennika usług myjni
app.get('/api/services', async (req, res) => {
  try {
    const services = await prisma.washService.findMany();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania usług' });
  }
});

// Endpoint do tworzenia rezerwacji
app.post('/api/reservations', async (req, res) => {
  try {
    const { token, washServiceId, date } = req.body;

    if (!token || !washServiceId || !date) {
      return res.status(400).json({ error: 'Brakujące dane rezerwacji!' });
    }

    // Dodane "as string", żeby upewnić TS, że token to tekst
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;

    const reservation = await prisma.reservation.create({
      data: {
        customerId: decoded.id,
        washServiceId: Number(washServiceId),
        date: new Date(date),
        status: 'Oczekująca'
      }
    });

    res.status(201).json({ message: 'Rezerwacja potwierdzona i zapisana w bazie!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas rezerwacji. Zaloguj się ponownie.' });
  }
});

// Endpoint do pobierania historii rezerwacji zalogowanego klienta
app.get('/api/my-reservations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Brak autoryzacji!' });
    }

    const token = authHeader.split(' ')[1]; 
    
    // ZABEZPIECZENIE: Sprawdzamy czy token na pewno istnieje po podziale stringa
    if (!token) {
      return res.status(401).json({ error: 'Brak poprawnego tokena!' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    const userReservations = await prisma.reservation.findMany({
      where: { customerId: decoded.id },
      include: { washService: true }, 
      orderBy: { date: 'desc' }       
    });

    res.status(200).json(userReservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas pobierania rezerwacji.' });
  }
});