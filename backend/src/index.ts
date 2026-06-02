import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/login', loginLimiter);
app.use('/api/staff/login', loginLimiter);

app.use('/api', authRoutes);
app.use('/api', customerRoutes);
app.use('/api', employeeRoutes);
app.use('/api', ownerRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Serwer uruchomiony pod adresem: http://localhost:${PORT}`);
});
