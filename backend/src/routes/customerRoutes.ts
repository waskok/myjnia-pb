import { Router } from 'express';
import prisma from '../prismaClient.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  ACTIVE_RESERVATION_STATUS,
  buildAvailabilitySlots,
  getDayBounds,
  hasReservationConflict,
  isAllowedSlotTime,
  isValidReservationDate,
} from '../utils/reservationSlots.js';

const router = Router();

interface LoyaltyRates {
  pointsPerE95: number;
  pointsPerE98: number;
  pointsPerDiesel: number;
  pointsPerLpg: number;
}

function getPointsRateForProduct(product: string, rates: LoyaltyRates): number | null {
  const normalized = product.toUpperCase();
  if (normalized.includes('LPG')) return rates.pointsPerLpg;
  if (normalized.includes('98')) return rates.pointsPerE98;
  if (normalized.includes('DIESEL') || normalized.includes('ON')) return rates.pointsPerDiesel;
  if (normalized.includes('95')) return rates.pointsPerE95;
  return null;
}

function calculatePointsForItems(
  items: Array<{ product: string; quantity: number }>,
  rates: LoyaltyRates,
): number {
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return sum;
    const rate = getPointsRateForProduct(item.product, rates);
    return rate !== null ? sum + Math.floor(qty * rate) : sum;
  }, 0);
}

router.get('/services', async (_req, res) => {
  const loyalty = await prisma.loyaltyProgram.findFirst();
  const standardEarnPoints = loyalty?.earnPointsPerStandardWash ?? 5;
  const waxEarnPoints = loyalty?.earnPointsPerWaxWash ?? 10;

  const services = await prisma.washService.findMany({
    where: {
      OR: [
        { type: { contains: 'standard', mode: 'insensitive' } },
        { type: { contains: 'wosk', mode: 'insensitive' } },
      ],
      NOT: { type: { contains: 'premium', mode: 'insensitive' } },
    },
    orderBy: { id: 'asc' },
  });

  const normalizedServices = services
    .map((service) => {
      const isStandard = service.type.toUpperCase().includes('STANDARD');
      return {
        ...service,
        type: isStandard ? 'Mycie standardowe' : 'Mycie z woskowaniem',
        loyaltyPoints: isStandard ? standardEarnPoints : waxEarnPoints,
      };
    })
    .sort((a, b) => {
      if (a.type === b.type) return a.id - b.id;
      return a.type === 'Mycie standardowe' ? -1 : 1;
    });

  res.json(normalizedServices);
});

router.get('/loyalty-program', async (_req, res) => {
  const loyalty =
    (await prisma.loyaltyProgram.findFirst()) ??
    (await prisma.loyaltyProgram.create({
      data: {
        pointsPerE95: 100,
        pointsPerE98: 100,
        pointsPerDiesel: 100,
        pointsPerLpg: 50,
        pointsPerStandardWash: 300,
        pointsPerWaxWash: 400,
        earnPointsPerE95: 2,
        earnPointsPerE98: 2,
        earnPointsPerDiesel: 2,
        earnPointsPerLpg: 1,
        earnPointsPerStandardWash: 5,
        earnPointsPerWaxWash: 10,
      },
    }));

  res.json({
    pointsPerE95: loyalty.pointsPerE95,
    pointsPerE98: loyalty.pointsPerE98,
    pointsPerDiesel: loyalty.pointsPerDiesel,
    pointsPerLpg: loyalty.pointsPerLpg,
    pointsPerStandardWash: loyalty.pointsPerStandardWash,
    pointsPerWaxWash: loyalty.pointsPerWaxWash,
    earnPointsPerE95: loyalty.earnPointsPerE95,
    earnPointsPerE98: loyalty.earnPointsPerE98,
    earnPointsPerDiesel: loyalty.earnPointsPerDiesel,
    earnPointsPerLpg: loyalty.earnPointsPerLpg,
    earnPointsPerStandardWash: loyalty.earnPointsPerStandardWash,
    earnPointsPerWaxWash: loyalty.earnPointsPerWaxWash,
  });
});

router.get('/reservations/availability', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!isValidReservationDate(date)) {
    return res.status(400).json({ error: 'Nieprawidłowa data. Użyj formatu RRRR-MM-DD.' });
  }

  const { start, end } = getDayBounds(date);
  const reservations = await prisma.reservation.findMany({
    where: {
      status: ACTIVE_RESERVATION_STATUS,
      date: { gte: start, lte: end },
    },
    select: { date: true },
  });

  const slots = buildAvailabilitySlots(
    date,
    reservations.map((reservation) => reservation.date),
  );

  res.json({ slots });
});

router.post('/reservations', authenticate, async (req, res) => {
  const { washServiceId, date, paymentMode, pointsCost } = req.body as {
    washServiceId?: number | string;
    date?: string;
    paymentMode?: 'cash' | 'points';
    pointsCost?: number;
  };

  if (!washServiceId || !date) {
    return res.status(400).json({ error: 'Brakujące dane rezerwacji!' });
  }

  const reservationDate = new Date(date);
  if (Number.isNaN(reservationDate.getTime())) {
    return res.status(400).json({ error: 'Nieprawidłowa data rezerwacji!' });
  }
  if (reservationDate < new Date()) {
    return res.status(400).json({ error: 'Nie można rezerwować terminów w przeszłości!' });
  }

  const timePart = `${String(reservationDate.getHours()).padStart(2, '0')}:${String(reservationDate.getMinutes()).padStart(2, '0')}`;
  if (!isAllowedSlotTime(timePart)) {
    return res.status(400).json({
      error: 'Nieprawidłowa godzina rezerwacji. Wybierz dostępny termin co 15 minut (8:00–22:00).',
    });
  }

  const dayPart = date.split('T')[0] ?? '';
  const { start, end } = getDayBounds(dayPart);
  const sameDayReservations = await prisma.reservation.findMany({
    where: {
      status: ACTIVE_RESERVATION_STATUS,
      date: { gte: start, lte: end },
    },
    select: { date: true },
  });

  if (
    hasReservationConflict(
      reservationDate,
      sameDayReservations.map((reservation) => reservation.date),
    )
  ) {
    return res.status(400).json({ error: 'Termin zajęty! Wybierz inną godzinę.' });
  }

  const customerId = req.user!.id;

  if (paymentMode === 'points') {
    const service = await prisma.washService.findUnique({
      where: { id: Number(washServiceId) },
      select: { id: true, type: true },
    });
    if (!service) return res.status(404).json({ error: 'Nie znaleziono wybranej usługi myjni.' });

    const loyalty = await prisma.loyaltyProgram.findFirst();
    const normalizedType = service.type.toLowerCase();
    const expectedPoints = normalizedType.includes('wosk')
      ? (loyalty?.pointsPerWaxWash ?? 400)
      : (loyalty?.pointsPerStandardWash ?? 300);

    const pointsToDeduct = Number(pointsCost ?? expectedPoints);
    if (!Number.isFinite(pointsToDeduct) || pointsToDeduct <= 0) {
      return res.status(400).json({ error: 'Nieprawidłowa liczba punktów dla rezerwacji.' });
    }
    if (pointsToDeduct !== expectedPoints) {
      return res.status(400).json({ error: 'Nieprawidłowy koszt punktowy dla wybranej usługi.' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, loyaltyPoints: true },
    });
    if (!customer) return res.status(404).json({ error: 'Nie znaleziono klienta.' });
    if (customer.loyaltyPoints < pointsToDeduct) {
      return res
        .status(400)
        .json({ error: `Za mało punktów. Wymagane: ${pointsToDeduct} pkt.` });
    }

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { decrement: pointsToDeduct } },
      }),
      prisma.reservation.create({
        data: {
          customerId,
          washServiceId: Number(washServiceId),
          date: reservationDate,
          status: 'Oczekująca',
        },
      }),
    ]);
  } else {
    await prisma.reservation.create({
      data: {
        customerId,
        washServiceId: Number(washServiceId),
        date: reservationDate,
        status: 'Oczekująca',
      },
    });
  }

  res.status(201).json({ message: 'Złożono rezerwację.' });
});

router.get('/my-reservations', authenticate, async (req, res) => {
  const userReservations = await prisma.reservation.findMany({
    where: { customerId: req.user!.id },
    include: { washService: true },
    orderBy: { date: 'desc' },
  });
  res.status(200).json(userReservations);
});

router.get('/my-profile', authenticate, async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.user!.id },
    select: { loyaltyPoints: true, firstName: true },
  });
  res.json(customer);
});

router.get('/my-transactions', authenticate, async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { customerId: req.user!.id },
    include: { items: true },
    orderBy: { date: 'desc' },
  });

  const loyalty = await prisma.loyaltyProgram.findFirst();
  const costRates: LoyaltyRates = {
    pointsPerE95: loyalty?.pointsPerE95 ?? 100,
    pointsPerE98: loyalty?.pointsPerE98 ?? 100,
    pointsPerDiesel: loyalty?.pointsPerDiesel ?? 100,
    pointsPerLpg: loyalty?.pointsPerLpg ?? 50,
  };
  const earnRates: LoyaltyRates = {
    pointsPerE95: loyalty?.earnPointsPerE95 ?? 2,
    pointsPerE98: loyalty?.earnPointsPerE98 ?? 2,
    pointsPerDiesel: loyalty?.earnPointsPerDiesel ?? 2,
    pointsPerLpg: loyalty?.earnPointsPerLpg ?? 1,
  };

  res.json(
    transactions.map((transaction) => {
      const pointsUsed = calculatePointsForItems(transaction.items, costRates);
      const pointsEarned = calculatePointsForItems(transaction.items, earnRates);
      const pointsDelta =
        transaction.paymentMethod === 'Punkty' ? -pointsUsed : pointsEarned;
      return { ...transaction, pointsDelta };
    }),
  );
});

export default router;
