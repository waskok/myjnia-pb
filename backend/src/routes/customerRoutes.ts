import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

interface TokenPayload {
  id: number;
  role?: string;
  email?: string;
}

const router = Router();

interface LoyaltyRates {
  pointsPerE95: number;
  pointsPerE98: number;
  pointsPerDiesel: number;
  pointsPerLpg: number;
}

type PublicLoyaltyProgram = LoyaltyRates & {
  pointsPerStandardWash: number;
  pointsPerWaxWash: number;
};

function getPointsRateForProduct(product: string, rates: LoyaltyRates): number | null {
  const normalized = product.toUpperCase();
  if (normalized.includes('LPG')) return rates.pointsPerLpg;
  if (normalized.includes('98')) return rates.pointsPerE98;
  if (normalized.includes('DIESEL') || normalized.includes('ON')) return rates.pointsPerDiesel;
  if (normalized.includes('95') || normalized.includes('E95') || normalized.includes('PB95')) return rates.pointsPerE95;
  return null;
}

function calculatePointsForItems(items: Array<{ product: string; quantity: number }>, rates: LoyaltyRates): number {
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return sum;
    const rate = getPointsRateForProduct(item.product, rates);
    if (rate === null) return sum;
    return sum + Math.floor(qty * rate);
  }, 0);
}

// ==========================================
// MODUŁ KLIENTA (USŁUGI I REZERWACJE)
// ==========================================
router.get('/services', async (req, res) => {
  try {
    const services = await prisma.washService.findMany({
      where: {
        OR: [
          { type: { contains: 'standard', mode: 'insensitive' } },
          { type: { contains: 'wosk', mode: 'insensitive' } }
        ],
        NOT: {
          type: { contains: 'premium', mode: 'insensitive' }
        }
      },
      orderBy: { id: 'asc' }
    });

    const normalizedServices = services.map((service) => {
      const normalizedType = service.type.toUpperCase();
      const isStandard = normalizedType.includes('STANDARD');
      return {
        ...service,
        type: isStandard ? 'Mycie standardowe' : 'Mycie z woskowaniem',
      };
    }).sort((a, b) => {
      if (a.type === b.type) return a.id - b.id;
      if (a.type === 'Mycie standardowe') return -1;
      return 1;
    });

    res.json(normalizedServices);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania usług' });
  }
});

// Publiczny podgląd programu lojalnościowego (bez logowania).
router.get('/loyalty-program', async (req, res) => {
  try {
    let loyalty = await prisma.loyaltyProgram.findFirst();
    if (!loyalty) {
      loyalty = await prisma.loyaltyProgram.create({
        data: {
          pointsPerE95: 100,
          pointsPerE98: 100,
          pointsPerDiesel: 100,
          pointsPerLpg: 50,
          pointsPerStandardWash: 300,
          pointsPerWaxWash: 400,
        },
      });
    }

    const payload: PublicLoyaltyProgram = {
      pointsPerE95: loyalty.pointsPerE95,
      pointsPerE98: loyalty.pointsPerE98,
      pointsPerDiesel: loyalty.pointsPerDiesel,
      pointsPerLpg: loyalty.pointsPerLpg,
      pointsPerStandardWash: loyalty.pointsPerStandardWash,
      pointsPerWaxWash: loyalty.pointsPerWaxWash,
    };

    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd pobierania programu lojalnościowego.' });
  }
});

router.post('/reservations', async (req, res) => {
  try {
    const { token, washServiceId, date, paymentMode, pointsCost } = req.body as {
      token?: string;
      washServiceId?: number | string;
      date?: string;
      paymentMode?: 'cash' | 'points';
      pointsCost?: number;
    };
    if (!token || !washServiceId || !date) return res.status(400).json({ error: 'Brakujące dane rezerwacji!' });

    const reservationDate = new Date(date);
    if (Number.isNaN(reservationDate.getTime())) {
      return res.status(400).json({ error: 'Nieprawidłowa data rezerwacji!' });
    }
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

    if (paymentMode === 'points') {
      const service = await prisma.washService.findUnique({
        where: { id: Number(washServiceId) },
        select: { id: true, type: true }
      });
      if (!service) {
        return res.status(404).json({ error: 'Nie znaleziono wybranej usługi myjni.' });
      }

      const loyalty = await prisma.loyaltyProgram.findFirst();
      const defaultStandard = 300;
      const defaultWax = 400;
      const normalizedType = service.type.toLowerCase();
      const expectedPoints =
        normalizedType.includes('wosk')
          ? loyalty?.pointsPerWaxWash ?? defaultWax
          : loyalty?.pointsPerStandardWash ?? defaultStandard;

      const pointsToDeduct = Number(pointsCost ?? expectedPoints);
      if (!Number.isFinite(pointsToDeduct) || pointsToDeduct <= 0) {
        return res.status(400).json({ error: 'Nieprawidłowa liczba punktów dla rezerwacji.' });
      }
      if (pointsToDeduct !== expectedPoints) {
        return res.status(400).json({ error: 'Nieprawidłowy koszt punktowy dla wybranej usługi.' });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: decoded.id },
        select: { id: true, loyaltyPoints: true }
      });
      if (!customer) {
        return res.status(404).json({ error: 'Nie znaleziono klienta.' });
      }
      if (customer.loyaltyPoints < pointsToDeduct) {
        return res.status(400).json({ error: `Za mało punktów. Wymagane: ${pointsToDeduct} pkt.` });
      }

      await prisma.$transaction([
        prisma.customer.update({
          where: { id: decoded.id },
          data: { loyaltyPoints: { decrement: pointsToDeduct } }
        }),
        prisma.reservation.create({
          data: { customerId: decoded.id, washServiceId: Number(washServiceId), date: reservationDate, status: 'Oczekująca' }
        })
      ]);
    } else {
      await prisma.reservation.create({
        data: { customerId: decoded.id, washServiceId: Number(washServiceId), date: reservationDate, status: 'Oczekująca' }
      });
    }

    res.status(201).json({ message: 'Złożono rezerwację.' });
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
    const loyalty = await prisma.loyaltyProgram.findFirst();
    const loyaltyRates: LoyaltyRates = {
      pointsPerE95: loyalty?.pointsPerE95 ?? 100,
      pointsPerE98: loyalty?.pointsPerE98 ?? 100,
      pointsPerDiesel: loyalty?.pointsPerDiesel ?? 100,
      pointsPerLpg: loyalty?.pointsPerLpg ?? 50
    };

    res.json(
      transactions.map((transaction) => {
        const points = calculatePointsForItems(transaction.items, loyaltyRates);
        const pointsDelta = transaction.paymentMethod === 'Punkty' ? -points : points;
        return { ...transaction, pointsDelta };
      })
    );
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania historii zakupów.' });
  }
});

export default router;