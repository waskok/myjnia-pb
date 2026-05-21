import { Router, type Request } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../prismaClient.js';

interface TokenPayload {
  id: number;
  role?: string;
  email?: string;
}

const router = Router();

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

    await prisma.employee.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Pracownik został usunięty.' });
  } catch (error) {
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
        employee: { select: { firstName: true, lastName: true } }
      }
    });

    res.json({
      totalRevenue: revenueStats._sum.totalAmount || 0,
      totalCount: transactionCount,
      transactions: recentTransactions
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

function parseDateOnly(dateStr: string): Date | null {
  if (!DATE_REGEX.test(dateStr)) return null;
  const parts = dateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthRange(year: number, month: number): { start: Date; end: Date } | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
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
        id: entry.id,
        date: formatDateOnly(entry.date),
        startTime: entry.shift,
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

    const { employeeId, startTime, dates } = req.body as {
      employeeId?: number;
      startTime?: string;
      dates?: string[];
    };

    if (!employeeId || !startTime || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'Wymagane pola: employeeId, startTime, dates (tablica dat).' });
    }

    if (!TIME_REGEX.test(startTime)) {
      return res.status(400).json({ error: 'Godzina rozpoczęcia musi być w formacie HH:mm (np. 08:00).' });
    }

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
              data: { shift: startTime, ownerId: owner.id }
            })
          );
        } else {
          saved.push(
            await tx.workSchedule.create({
              data: {
                employeeId: employee.id,
                ownerId: owner.id,
                date,
                shift: startTime
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
        id: entry.id,
        date: formatDateOnly(entry.date),
        startTime: entry.shift,
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