import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

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