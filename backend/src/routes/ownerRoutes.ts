import { Router, type Request } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../prismaClient.js';
import { formatDateOnly, getMonthRange } from '../scheduleUtils.js';

interface TokenPayload {
  id: number;
  role?: string;
  email?: string;
}

interface PointsCalculationItem {
  product: string;
  quantity: number;
}

const router = Router();

function calculatePointsUsed(items: PointsCalculationItem[]): number {
  return items.reduce((sum, item) => {
    const qty = Math.floor(Number(item.quantity) || 0);
    if (qty <= 0) return sum;
    const isLpg = item.product.toUpperCase().includes('LPG');
    return sum + qty * (isLpg ? 50 : 100);
  }, 0);
}

// ==========================================
// MODUŁ WŁAŚCICIELA 
// ==========================================
router.get('/owner/employees', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'owner') return res.status(403).json({ error: 'Brak uprawnień!' });

    const employees = await prisma.employee.findMany({
      where: { ownerId: decoded.id },
      select: { id: true, firstName: true, lastName: true, role: true, login: true, email: true, phone: true }
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania pracowników.' });
  }
});

router.post('/owner/employees', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'owner') return res.status(403).json({ error: 'Brak uprawnień!' });

    const { firstName, lastName, role, login, password, email, phone } = req.body;
    const existing = await prisma.employee.findUnique({ where: { login } });
    if (existing) return res.status(400).json({ error: 'Login jest już zajęty!' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.employee.create({
      data: { firstName, lastName, role, login, email, phone, password: hashedPassword, ownerId: decoded.id }
    });
    res.status(201).json({ message: 'Pracownik dodany pomyślnie!' });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas dodawania pracownika.' });
  }
});

router.delete('/owner/employees/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'owner') return res.status(403).json({ error: 'Brak uprawnień!' });

    const employeeId = Number(req.params.id);
    if (!employeeId || Number.isNaN(employeeId)) {
      return res.status(400).json({ error: 'Nieprawidłowe ID pracownika.' });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, ownerId: decoded.id },
      select: { id: true }
    });
    if (!employee) {
      return res.status(404).json({ error: 'Nie znaleziono pracownika przypisanego do tego właściciela.' });
    }

    await prisma.employee.delete({ where: { id: employeeId } });
    res.json({ message: 'Pracownik został usunięty.' });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2003') {
      return res.status(409).json({
        error: 'Nie można usunąć pracownika, ponieważ ma powiązane transakcje. Oznacz konto jako nieaktywne lub przenieś historię.'
      });
    }
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas usuwania pracownika.' });
  }
});

router.get('/owner/customers', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const customers = await prisma.customer.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, loyaltyPoints: true, registered: true },
      orderBy: { lastName: 'asc' }
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania bazy klientów.' });
  }
});

// ==========================================
// MODUŁ RAPORTÓW WŁAŚCICIELA
// ==========================================
router.get('/owner/reports', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;

    if (decoded.role !== 'owner') return res.status(403).json({ error: 'Brak uprawnień!' });

    const { period, date } = req.query;
    
    let dateFilter: { date?: { gte: Date; lte: Date } } = {};

    if (period && period !== 'all' && date) {
      const targetDate = new Date(date as string);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const day = targetDate.getDate();

      let startDate: Date;
      let endDate: Date;

      if (period === 'daily') {
        startDate = new Date(year, month, day, 0, 0, 0);
        endDate = new Date(year, month, day, 23, 59, 59, 999);
      } else if (period === 'weekly') {
        const dayOfWeek = targetDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(year, month, day + mondayOffset, 0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        startDate = monday;
        endDate = sunday;
      } else if (period === 'monthly') {
        startDate = new Date(year, month, 1, 0, 0, 0);
        endDate = new Date(year, month + 1, 0, 23, 59, 59, 999); 
      } else { 
        startDate = new Date(year, 0, 1, 0, 0, 0);
        endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      }

      dateFilter = {
        date: {
          gte: startDate,
          lte: endDate
        }
      };
    }

    const revenueStats = await prisma.transaction.aggregate({
      _sum: { totalAmount: true },
      where: dateFilter
    });

    const transactionCount = await prisma.transaction.count({
      where: dateFilter
    });

    const recentTransactions = await prisma.transaction.findMany({
      take: period === 'all' ? 15 : 100,
      where: dateFilter,
      orderBy: { date: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        employee: { select: { firstName: true, lastName: true } },
        items: { select: { product: true, quantity: true } }
      }
    });

    res.json({
      totalRevenue: revenueStats._sum.totalAmount || 0,
      totalCount: transactionCount,
      transactions: recentTransactions.map((transaction) => {
        const pointsUsed =
          transaction.paymentMethod === 'Punkty'
            ? calculatePointsUsed(transaction.items)
            : 0;

        return {
          ...transaction,
          pointsUsed
        };
      })
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd generowania raportów.' });
  }
});

router.get('/owner/deliveries', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const deliveries = await prisma.fuelDelivery.findMany({
      include: { fuel: true, owner: { select: { firstName: true, lastName: true } } },
      orderBy: { deliveryDate: 'desc' }
    });
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania dostaw.' });
  }
});

router.post('/owner/deliveries', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'owner') return res.status(403).json({ error: 'Tylko właściciel może zlecać dostawy!' });

    const { fuelId, quantity, supplier, deliveryDate } = req.body;
    if (!fuelId || !quantity || !supplier || !deliveryDate) return res.status(400).json({ error: 'Brakujące dane dostawy!' });

    await prisma.fuelDelivery.create({
      data: { fuelId: Number(fuelId), ownerId: decoded.id, quantity: Number(quantity), supplier: supplier, deliveryDate: new Date(deliveryDate), status: 'Zlecona' }
    });
    res.status(201).json({ message: 'Pomyślnie zlecono dostawę paliwa!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas zlecania dostawy.' });
  }
});

router.patch('/owner/deliveries/:id/complete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });

    const id = Number(req.params.id);
    const delivery = await prisma.fuelDelivery.findUnique({ where: { id } });
    if (!delivery || delivery.status === 'Dostarczona') return res.status(400).json({ error: 'Dostawa nie istnieje lub już odebrana!' });

    await prisma.fuel.update({ where: { id: delivery.fuelId }, data: { tankLevel: { increment: delivery.quantity } } });
    await prisma.fuelDelivery.update({ where: { id }, data: { status: 'Dostarczona' } });

    res.status(200).json({ message: 'Dostawa odebrana. Paliwo znajduje się w zbiornikach!' });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas odbioru dostawy.' });
  }
});

router.patch('/owner/fuels/:id/price', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const { price } = req.body;
    await prisma.fuel.update({ where: { id: Number(req.params.id) }, data: { pricePerLiter: Number(price) } });
    res.status(200).json({ message: 'Cena paliwa została zaktualizowana!' });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas aktualizacji ceny.' });
  }
});

// ==========================================
// MODUŁ GRAFIKU PRACOWNIKÓW (WŁAŚCICIEL)
// ==========================================

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SHIFT_RANGE_REGEX = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function parseShiftRange(shift: string): { startTime: string; endTime: string } {
  if (SHIFT_RANGE_REGEX.test(shift)) {
    const [startTime = shift, endTime = shift] = shift.split('-');
    return { startTime, endTime };
  }
  return { startTime: shift, endTime: shift };
}

function parseOwnerFromRequest(req: Request): TokenPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'owner') return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Kalendarzowa data YYYY-MM-DD bez przesunięcia strefy czasowej (UTC). */
function parseDateOnly(dateStr: string): Date | null {
  if (!DATE_REGEX.test(dateStr)) return null;
  const parts = dateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

router.get('/owner/schedule', async (req, res) => {
  try {
    const owner = parseOwnerFromRequest(req);
    if (!owner) return res.status(403).json({ error: 'Brak uprawnień!' });

    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const range = getMonthRange(year, month);
    if (!range) {
      return res.status(400).json({ error: 'Podaj poprawne parametry year i month (1–12).' });
    }

    const schedules = await prisma.workSchedule.findMany({
      where: {
        ownerId: owner.id,
        date: { gte: range.start, lte: range.end }
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: [{ date: 'asc' }, { shift: 'asc' }]
    });

    res.json({
      year,
      month,
      schedules: schedules.map((entry) => ({
        ...parseShiftRange(entry.shift),
        id: entry.id,
        date: formatDateOnly(entry.date),
        employeeId: entry.employeeId,
        employee: entry.employee
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd pobierania grafiku.' });
  }
});

router.post('/owner/schedule', async (req, res) => {
  try {
    const owner = parseOwnerFromRequest(req);
    if (!owner) return res.status(403).json({ error: 'Brak uprawnień!' });

    const { employeeId, startTime, endTime, dates } = req.body as {
      employeeId?: number;
      startTime?: string;
      endTime?: string;
      dates?: string[];
    };

    if (!employeeId || !startTime || !endTime || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'Wymagane pola: employeeId, startTime, endTime, dates (tablica dat).' });
    }

    if (!TIME_REGEX.test(startTime)) {
      return res.status(400).json({ error: 'Godzina rozpoczęcia musi być w formacie HH:mm (np. 08:00).' });
    }
    if (!TIME_REGEX.test(endTime)) {
      return res.status(400).json({ error: 'Godzina zakończenia musi być w formacie HH:mm (np. 16:00).' });
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return res.status(400).json({ error: 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.' });
    }

    const shiftRange = `${startTime}-${endTime}`;

    const employee = await prisma.employee.findFirst({
      where: { id: Number(employeeId), ownerId: owner.id }
    });
    if (!employee) {
      return res.status(404).json({ error: 'Nie znaleziono pracownika przypisanego do tego właściciela.' });
    }

    const parsedDates: Date[] = [];
    for (const dateStr of dates) {
      if (typeof dateStr !== 'string') {
        return res.status(400).json({ error: 'Każda data musi być tekstem YYYY-MM-DD.' });
      }
      const parsed = parseDateOnly(dateStr);
      if (!parsed) {
        return res.status(400).json({ error: `Nieprawidłowa data: ${dateStr}` });
      }
      parsedDates.push(parsed);
    }

    const uniqueDates = [...new Map(parsedDates.map((d) => [formatDateOnly(d), d])).values()];

    const results = await prisma.$transaction(async (tx) => {
      const saved = [];
      for (const date of uniqueDates) {
        const existing = await tx.workSchedule.findFirst({
          where: { employeeId: employee.id, date }
        });
        if (existing) {
          saved.push(
            await tx.workSchedule.update({
              where: { id: existing.id },
              data: { shift: shiftRange, ownerId: owner.id }
            })
          );
        } else {
          saved.push(
            await tx.workSchedule.create({
              data: {
                employeeId: employee.id,
                ownerId: owner.id,
                date,
                shift: shiftRange
              }
            })
          );
        }
      }
      return saved;
    });

    res.status(201).json({
      message: `Zapisano grafik dla ${results.length} dni.`,
      schedules: results.map((entry) => ({
        ...parseShiftRange(entry.shift),
        id: entry.id,
        date: formatDateOnly(entry.date),
        employeeId: entry.employeeId
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd zapisywania grafiku.' });
  }
});

router.delete('/owner/schedule/:id', async (req, res) => {
  try {
    const owner = parseOwnerFromRequest(req);
    if (!owner) return res.status(403).json({ error: 'Brak uprawnień!' });

    const id = Number(req.params.id);
    const entry = await prisma.workSchedule.findFirst({
      where: { id, ownerId: owner.id }
    });
    if (!entry) {
      return res.status(404).json({ error: 'Nie znaleziono wpisu grafiku.' });
    }

    await prisma.workSchedule.delete({ where: { id } });
    res.json({ message: 'Wpis grafiku został usunięty.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd usuwania wpisu grafiku.' });
  }
});

export default router;