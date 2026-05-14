import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './prismaClient.js'; // <-- tutaj dodane .js

import authRoutes from './routes/authRoutes.js'; // <-- tutaj dodane .js
import customerRoutes from './routes/customerRoutes.js'; // <-- tutaj dodane .js
import employeeRoutes from './routes/employeeRoutes.js'; // <-- tutaj dodane .js
import ownerRoutes from './routes/ownerRoutes.js'; // <-- tutaj dodane .js

dotenv.config(); 

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); 
app.use(express.json()); 

// ==========================================
// ENDPOINTY TESTOWE
// ==========================================
app.get('/api/status', (req, res) => {
  res.json({ message: 'Serwer myjni PB działa i jest gotowy na żądania!' });
});

app.get('/api/db-check', async (req, res) => {
  try {
    const ownersCount = await prisma.owner.count();
    res.json({ message: `Połączenie z bazą działa! Liczba właścicieli w bazie: ${ownersCount}` });
  } catch (error) {
    res.status(500).json({ error: 'Błąd połączenia z bazą danych' });
  }
});

// ==========================================
// REJESTRACJA MODUŁÓW (ROUTING)
// ==========================================
app.use('/api', authRoutes);
app.use('/api', customerRoutes);
app.use('/api', employeeRoutes);
app.use('/api', ownerRoutes);

// START SERWERA
app.listen(PORT, () => {
  console.log(`🚀 Serwer uruchomiony pod adresem: http://localhost:${PORT}`);
});