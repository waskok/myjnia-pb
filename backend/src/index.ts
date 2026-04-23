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