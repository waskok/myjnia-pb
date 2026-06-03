import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export type CreateAppOptions = {
  /** Wyłącz limiter logowania (testy API). Domyślnie wyłączony gdy NODE_ENV=test. */
  rateLimit?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const enableRateLimit = options.rateLimit ?? process.env.NODE_ENV !== 'test';

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  if (enableRateLimit) {
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      message: { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/login', loginLimiter);
    app.use('/api/staff/login', loginLimiter);
  }

  app.use('/api', authRoutes);
  app.use('/api', customerRoutes);
  app.use('/api', employeeRoutes);
  app.use('/api', ownerRoutes);

  app.use(errorHandler);

  return app;
}
