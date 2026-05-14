import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

interface TokenPayload {
  id: number;
  role?: string;
  email?: string;
}

const router = Router();

// ==========================================
// MODUŁ KLIENTA (USŁUGI I REZERWACJE)
// ==========================================
router.get('/services', async (req, res) => {
  try {
    const services = await prisma.washService.findMany();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania usług' });
  }
});

router.post('/reservations', async (req, res) => {
  try {
    const { token, washServiceId, date } = req.body;
    if (!token || !washServiceId || !date) return res.status(400).json({ error: 'Brakujące dane rezerwacji!' });

    const reservationDate = new Date(date);
    if (reservationDate < new Date()) {
      return res.status(400).json({ error: 'Nie można rezerwować terminów w przeszłości!' });
    }

    const oneHourBefore = new Date(reservationDate.getTime() - 60 * 60 * 1000);
    const oneHourAfter = new Date(reservationDate.getTime() + 60 * 60 * 1000);

    const conflict = await prisma.reservation.findFirst({
      where: {
        status: { not: 'Anulowana' },
        date: {
          gt: oneHourBefore,
          lt: oneHourAfter
        }
      }
    });

    if (conflict) {
      return res.status(400).json({ error: 'Termin zajęty! Pomiędzy rezerwacjami musi być minimum godzina odstępu.' });
    }

    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    await prisma.reservation.create({
      data: { customerId: decoded.id, washServiceId: Number(washServiceId), date: reservationDate, status: 'Oczekująca' }
    });

    res.status(201).json({ message: 'Rezerwacja potwierdzona i zapisana w bazie!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas rezerwacji. Zaloguj się ponownie.' });
  }
});

router.get('/my-reservations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ error: 'Brak poprawnego tokena!' });

    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
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

router.get('/my-profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;

    const customer = await prisma.customer.findUnique({
      where: { id: decoded.id },
      select: { loyaltyPoints: true, firstName: true }
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania profilu.' });
  }
});

router.get('/my-transactions', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;

    const transactions = await prisma.transaction.findMany({
      where: { customerId: decoded.id },
      include: { items: true },
      orderBy: { date: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania historii zakupów.' });
  }
});

export default router;