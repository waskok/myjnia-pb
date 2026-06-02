import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prismaClient.js';
import { formatDateOnly, getMonthRange } from '../scheduleUtils.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import {
  AddEmployeeSchema,
  UpdateEmployeeLoginSchema,
  UpdateEmployeePasswordSchema,
  DeliverySchema,
  FuelPriceSchema,
  ServicePriceSchema,
  ServiceLoyaltyPointsSchema,
  LoyaltyConfigSchema,
  ScheduleCreateSchema,
} from '../validators/owner.validators.js';

const router = Router();
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface PointsCalculationItem {
  product: string;
  quantity: number;
}

interface LoyaltyRates {
  pointsPerE95: number;
  pointsPerE98: number;
  pointsPerDiesel: number;
  pointsPerLpg: number;
  pointsPerStandardWash: number;
  pointsPerWaxWash: number;
  earnPointsPerE95: number;
  earnPointsPerE98: number;
  earnPointsPerDiesel: number;
  earnPointsPerLpg: number;
  earnPointsPerStandardWash: number;
  earnPointsPerWaxWash: number;
}

function getPointsRateForProduct(product: string, rates: LoyaltyRates): number {
  const normalized = product.toUpperCase();
  if (normalized.includes('LPG')) return rates.pointsPerLpg;
  if (normalized.includes('98')) return rates.pointsPerE98;
  if (normalized.includes('DIESEL') || normalized.includes('ON')) return rates.pointsPerDiesel;
  return rates.pointsPerE95;
}

function calculatePointsUsed(items: PointsCalculationItem[], rates: LoyaltyRates): number {
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    return qty <= 0 ? sum : sum + Math.floor(qty * getPointsRateForProduct(item.product, rates));
  }, 0);
}

function buildReportDateFilter(period?: unknown, date?: unknown): { date?: { gte: Date; lte: Date } } {
  if (!period || period === 'all' || !date) return {};
  const targetDate = new Date(String(date));
  if (Number.isNaN(targetDate.getTime())) return {};

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const day = targetDate.getDate();
  let startDate: Date;
  let endDate: Date;

  if (period === 'daily') {
    startDate = new Date(year, month, day, 0, 0, 0, 0);
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
    startDate = new Date(year, month, 1, 0, 0, 0, 0);
    endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  } else {
    startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  }

  return { date: { gte: startDate, lte: endDate } };
}

function buildOwnerDateWhere(
  period?: unknown,
  date?: unknown,
  field: 'date' | 'createdAt' = 'date',
): Record<string, { gte: Date; lte: Date }> {
  const base = buildReportDateFilter(period, date);
  return base.date ? { [field]: base.date } : {};
}

function parseDateOnly(dateStr: string): Date | null {
  if (!DATE_REGEX.test(dateStr)) return null;
  const parts = dateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function parseShiftRange(shift: string): { startTime: string; endTime: string } {
  const SHIFT_RANGE_REGEX = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;
  if (SHIFT_RANGE_REGEX.test(shift)) {
    const [startTime = shift, endTime = shift] = shift.split('-');
    return { startTime, endTime };
  }
  return { startTime: shift, endTime: shift };
}

const ownerAuth = [authenticate, requireRole('owner')] as const;

router.get('/owner/employees', ...ownerAuth, async (req, res) => {
  const employees = await prisma.employee.findMany({
    where: { ownerId: req.user!.id },
    select: { id: true, firstName: true, lastName: true, role: true, isActive: true, login: true, email: true, phone: true },
  });
  res.json(employees);
});

router.post('/owner/employees', ...ownerAuth, async (req, res) => {
  const parsed = AddEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }

  const { firstName, lastName, role, login, password, email, phone } = parsed.data;
  const existing = await prisma.employee.findUnique({ where: { login } });
  if (existing) return res.status(400).json({ error: 'Login jest już zajęty!' });

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.employee.create({
    data: {
      firstName,
      lastName,
      role,
      login,
      email: email || null,
      phone: phone || null,
      password: hashedPassword,
      ownerId: req.user!.id,
    },
  });
  res.status(201).json({ message: 'Pracownik dodany pomyślnie!' });
});

router.delete('/owner/employees/:id', ...ownerAuth, async (req, res, next) => {
  const employeeId = Number(req.params['id']);
  if (!employeeId || Number.isNaN(employeeId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID pracownika.' });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ownerId: req.user!.id },
    select: { id: true },
  });
  if (!employee) {
    return res.status(404).json({ error: 'Nie znaleziono pracownika przypisanego do tego właściciela.' });
  }

  try {
    await prisma.employee.delete({ where: { id: employeeId } });
    res.json({ message: 'Pracownik został usunięty.' });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2003') {
      return res.status(409).json({
        error: 'Nie można usunąć pracownika, ponieważ ma powiązane transakcje. Użyj akcji "Archiwizuj".',
      });
    }
    next(error);
  }
});

router.patch('/owner/employees/:id/archive', ...ownerAuth, async (req, res) => {
  const employeeId = Number(req.params['id']);
  if (!employeeId || Number.isNaN(employeeId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID pracownika.' });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ownerId: req.user!.id },
    select: { id: true, isActive: true },
  });
  if (!employee) return res.status(404).json({ error: 'Nie znaleziono pracownika przypisanego do tego właściciela.' });
  if (!employee.isActive) return res.status(400).json({ error: 'Pracownik jest już archiwalny.' });

  await prisma.employee.update({ where: { id: employeeId }, data: { isActive: false } });
  res.json({ message: 'Pracownik został przeniesiony do archiwum.' });
});

router.patch('/owner/employees/:id/restore', ...ownerAuth, async (req, res) => {
  const employeeId = Number(req.params['id']);
  if (!employeeId || Number.isNaN(employeeId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID pracownika.' });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ownerId: req.user!.id },
    select: { id: true, isActive: true },
  });
  if (!employee) return res.status(404).json({ error: 'Nie znaleziono pracownika przypisanego do tego właściciela.' });
  if (employee.isActive) return res.status(400).json({ error: 'Pracownik jest już aktywny.' });

  await prisma.employee.update({ where: { id: employeeId }, data: { isActive: true } });
  res.json({ message: 'Pracownik został przywrócony do aktywnych.' });
});

router.patch('/owner/employees/:id/login', ...ownerAuth, async (req, res) => {
  const employeeId = Number(req.params['id']);
  if (!employeeId || Number.isNaN(employeeId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID pracownika.' });
  }

  const parsed = UpdateEmployeeLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ownerId: req.user!.id },
    select: { id: true },
  });
  if (!employee) return res.status(404).json({ error: 'Nie znaleziono pracownika przypisanego do tego właściciela.' });

  const existing = await prisma.employee.findUnique({ where: { login: parsed.data.login } });
  if (existing && existing.id !== employeeId) {
    return res.status(409).json({ error: 'Ten login jest już zajęty.' });
  }

  await prisma.employee.update({ where: { id: employeeId }, data: { login: parsed.data.login } });
  res.json({ message: 'Login pracownika został zaktualizowany.' });
});

router.patch('/owner/employees/:id/password', ...ownerAuth, async (req, res) => {
  const employeeId = Number(req.params['id']);
  if (!employeeId || Number.isNaN(employeeId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID pracownika.' });
  }

  const parsed = UpdateEmployeePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ownerId: req.user!.id },
    select: { id: true },
  });
  if (!employee) return res.status(404).json({ error: 'Nie znaleziono pracownika przypisanego do tego właściciela.' });

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  await prisma.employee.update({ where: { id: employeeId }, data: { password: hashedPassword } });
  res.json({ message: 'Hasło pracownika zostało zaktualizowane.' });
});

router.get('/owner/customers', ...ownerAuth, async (_req, res) => {
  const customers = await prisma.customer.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, loyaltyPoints: true, registered: true },
    orderBy: { lastName: 'asc' },
  });
  res.json(customers);
});

router.get('/owner/loyalty-config', ...ownerAuth, async (_req, res) => {
  const loyalty =
    (await prisma.loyaltyProgram.findFirst()) ??
    (await prisma.loyaltyProgram.create({
      data: {
        pointsPerE95: 100, pointsPerE98: 100, pointsPerDiesel: 100, pointsPerLpg: 50,
        pointsPerStandardWash: 300, pointsPerWaxWash: 400,
        earnPointsPerE95: 2, earnPointsPerE98: 2, earnPointsPerDiesel: 2, earnPointsPerLpg: 1,
        earnPointsPerStandardWash: 5, earnPointsPerWaxWash: 10,
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

router.patch('/owner/loyalty-config', ...ownerAuth, async (req, res) => {
  const parsed = LoyaltyConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Stawki punktów muszą być nieujemnymi liczbami całkowitymi.' });
  }

  const existing = await prisma.loyaltyProgram.findFirst();
  const loyalty = existing
    ? await prisma.loyaltyProgram.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.loyaltyProgram.create({ data: parsed.data });

  res.json({
    message: 'Zaktualizowano stawki punktów.',
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

router.get('/owner/reports', ...ownerAuth, async (req, res) => {
  const { period, date } = req.query;
  const dateFilter = buildReportDateFilter(period, date);

  const [revenueStats, transactionCount, recentTransactions, loyalty] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { totalAmount: true }, where: dateFilter }),
    prisma.transaction.count({ where: dateFilter }),
    prisma.transaction.findMany({
      take: period === 'all' ? 15 : 100,
      where: dateFilter,
      orderBy: { date: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        employee: { select: { firstName: true, lastName: true } },
        items: { select: { product: true, quantity: true } },
      },
    }),
    prisma.loyaltyProgram.findFirst(),
  ]);

  const loyaltyRates: LoyaltyRates = {
    pointsPerE95: loyalty?.pointsPerE95 ?? 100,
    pointsPerE98: loyalty?.pointsPerE98 ?? 100,
    pointsPerDiesel: loyalty?.pointsPerDiesel ?? 100,
    pointsPerLpg: loyalty?.pointsPerLpg ?? 50,
    pointsPerStandardWash: loyalty?.pointsPerStandardWash ?? 300,
    pointsPerWaxWash: loyalty?.pointsPerWaxWash ?? 400,
    earnPointsPerE95: loyalty?.earnPointsPerE95 ?? 2,
    earnPointsPerE98: loyalty?.earnPointsPerE98 ?? 2,
    earnPointsPerDiesel: loyalty?.earnPointsPerDiesel ?? 2,
    earnPointsPerLpg: loyalty?.earnPointsPerLpg ?? 1,
    earnPointsPerStandardWash: loyalty?.earnPointsPerStandardWash ?? 5,
    earnPointsPerWaxWash: loyalty?.earnPointsPerWaxWash ?? 10,
  };

  res.json({
    totalRevenue: revenueStats._sum.totalAmount || 0,
    totalCount: transactionCount,
    transactions: recentTransactions.map((transaction) => ({
      ...transaction,
      pointsUsed:
        transaction.paymentMethod === 'Punkty'
          ? calculatePointsUsed(transaction.items, loyaltyRates)
          : 0,
    })),
  });
});

router.get('/owner/reports/wash', ...ownerAuth, async (req, res) => {
  const { period, date } = req.query;
  const dateWhere = buildOwnerDateWhere(period, date, 'date');

  const completedReservations = await prisma.reservation.findMany({
    where: { status: 'Zakończona', ...dateWhere },
    orderBy: { date: 'desc' },
    take: period === 'all' ? 50 : 200,
    include: {
      customer: { select: { firstName: true, lastName: true } },
      washService: { select: { type: true, price: true } },
    },
  });

  const totalRevenue = completedReservations.reduce(
    (acc, item) => acc + (item.washService?.price ?? 0),
    0,
  );

  res.json({
    totalRevenue,
    totalCount: completedReservations.length,
    washes: completedReservations.map((entry) => ({
      id: entry.id,
      date: entry.date,
      status: entry.status,
      serviceType: entry.washService?.type ?? 'Nieznana usługa',
      servicePrice: entry.washService?.price ?? 0,
      customer: entry.customer
        ? { firstName: entry.customer.firstName, lastName: entry.customer.lastName }
        : null,
    })),
  });
});

router.get('/owner/reports/monitoring', ...ownerAuth, async (req, res) => {
  const { period, date } = req.query;
  const createdAtWhere = buildOwnerDateWhere(period, date, 'createdAt');

  const readings = await prisma.sensor.findMany({
    where: { tank: { not: 'CONFIG' }, ...createdAtWhere },
    orderBy: { createdAt: 'desc' },
    take: period === 'all' ? 300 : 800,
  });

  const tankLabelMap: Record<string, string> = {
    E95: 'Zbiornik 1 (E95)',
    E98: 'Zbiornik 2 (E98)',
    ON: 'Zbiornik 3 (ON)',
    LPG: 'Zbiornik LPG',
  };

  type Snapshot = {
    id: number;
    tank: string;
    tankLabel: string;
    createdAt: Date;
    level: number | null;
    pressure: number | null;
    temperature: number | null;
    alertSent: boolean;
  };

  const grouped = new Map<string, Snapshot>();
  readings.forEach((item) => {
    const bucket = new Date(item.createdAt);
    bucket.setSeconds(0, 0);
    const key = `${item.tank}|${bucket.toISOString()}`;
    const existing = grouped.get(key) ?? {
      id: item.id,
      tank: item.tank,
      tankLabel: tankLabelMap[item.tank] ?? `Zbiornik ${item.tank}`,
      createdAt: item.createdAt,
      level: null,
      pressure: null,
      temperature: null,
      alertSent: false,
    };
    if (item.type === 'level') existing.level = item.value;
    if (item.type === 'pressure') existing.pressure = item.value;
    if (item.type === 'temperature') existing.temperature = item.value;
    if (item.status === 'AWARIA' || item.status === 'ERROR' || (item.type === 'safety_valve' && item.value >= 1)) {
      existing.alertSent = true;
    }
    grouped.set(key, existing);
  });

  const snapshots = Array.from(grouped.values())
    .sort((a, b) => {
      const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return byDate !== 0 ? byDate : a.tankLabel.localeCompare(b.tankLabel, 'pl');
    })
    .slice(0, period === 'all' ? 120 : 260);

  res.json({
    totalReadings: snapshots.length,
    alertEvents: snapshots.filter((item) => item.alertSent).length,
    readings: snapshots.map((item) => ({
      id: item.id,
      tank: item.tank,
      tankLabel: item.tankLabel,
      level: item.level,
      pressure: item.pressure,
      temperature: item.temperature,
      alertStatus: item.alertSent ? 'Alert wysłany' : 'Brak alertu',
      createdAt: item.createdAt,
    })),
  });
});

router.get('/owner/deliveries', ...ownerAuth, async (_req, res) => {
  const deliveries = await prisma.fuelDelivery.findMany({
    include: { fuel: true, owner: { select: { firstName: true, lastName: true } } },
    orderBy: { deliveryDate: 'desc' },
  });
  res.json(deliveries);
});

router.post('/owner/deliveries', ...ownerAuth, async (req, res) => {
  const parsed = DeliverySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Brakujące dane dostawy!' });
  }

  const { fuelId, quantity, supplier, deliveryDate } = parsed.data;
  const parsedDeliveryDate = new Date(deliveryDate);
  if (parsedDeliveryDate.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Nie można zlecić dostawy na datę z przeszłości.' });
  }

  await prisma.fuelDelivery.create({
    data: { fuelId, ownerId: req.user!.id, quantity, supplier, deliveryDate: parsedDeliveryDate, status: 'Zlecona' },
  });
  res.status(201).json({ message: 'Pomyślnie zlecono dostawę paliwa!' });
});

router.patch('/owner/deliveries/:id/complete', ...ownerAuth, async (req, res) => {
  const id = Number(req.params['id']);
  const delivery = await prisma.fuelDelivery.findUnique({ where: { id } });
  if (!delivery || delivery.status === 'Dostarczona') {
    return res.status(400).json({ error: 'Dostawa nie istnieje lub już odebrana!' });
  }

  await prisma.fuel.update({
    where: { id: delivery.fuelId },
    data: { tankLevel: { increment: delivery.quantity } },
  });
  await prisma.fuelDelivery.update({ where: { id }, data: { status: 'Dostarczona' } });
  res.status(200).json({ message: 'Dostawa odebrana. Paliwo znajduje się w zbiornikach!' });
});

router.patch('/owner/fuels/:id/price', ...ownerAuth, async (req, res) => {
  const parsed = FuelPriceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Nieprawidłowa cena.' });
  }
  await prisma.fuel.update({
    where: { id: Number(req.params['id']) },
    data: { pricePerLiter: parsed.data.price },
  });
  res.status(200).json({ message: 'Cena paliwa została zaktualizowana!' });
});

router.patch('/owner/services/:id/price', ...ownerAuth, async (req, res) => {
  const parsed = ServicePriceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }
  await prisma.washService.update({
    where: { id: Number(req.params['id']) },
    data: { price: parsed.data.price },
  });
  res.status(200).json({ message: 'Cena usługi myjni została zaktualizowana!' });
});

router.patch('/owner/services/:id/loyalty-points', ...ownerAuth, async (req, res) => {
  const parsed = ServiceLoyaltyPointsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }
  await prisma.washService.update({
    where: { id: Number(req.params['id']) },
    data: { loyaltyPoints: parsed.data.loyaltyPoints },
  });
  res.status(200).json({ message: 'Liczba punktów za usługę została zaktualizowana!' });
});

router.get('/owner/schedule', ...ownerAuth, async (req, res) => {
  const year = Number(req.query['year']);
  const month = Number(req.query['month']);
  const range = getMonthRange(year, month);
  if (!range) {
    return res.status(400).json({ error: 'Podaj poprawne parametry year i month (1–12).' });
  }

  const schedules = await prisma.workSchedule.findMany({
    where: { ownerId: req.user!.id, date: { gte: range.start, lte: range.end } },
    include: { employee: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: [{ date: 'asc' }, { shift: 'asc' }],
  });

  res.json({
    year,
    month,
    schedules: schedules.map((entry) => ({
      ...parseShiftRange(entry.shift),
      id: entry.id,
      date: formatDateOnly(entry.date),
      employeeId: entry.employeeId,
      employee: entry.employee,
    })),
  });
});

router.post('/owner/schedule', ...ownerAuth, async (req, res) => {
  const parsed = ScheduleCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }

  const { employeeId, startTime, endTime, dates } = parsed.data;
  const shiftRange = `${startTime}-${endTime}`;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ownerId: req.user!.id },
  });
  if (!employee) {
    return res.status(404).json({ error: 'Nie znaleziono pracownika przypisanego do tego właściciela.' });
  }

  const parsedDates: Date[] = [];
  for (const dateStr of dates) {
    const parsed = parseDateOnly(dateStr);
    if (!parsed) return res.status(400).json({ error: `Nieprawidłowa data: ${dateStr}` });
    parsedDates.push(parsed);
  }

  const uniqueDates = [...new Map(parsedDates.map((d) => [formatDateOnly(d), d])).values()];

  const results = await prisma.$transaction(async (tx) => {
    const saved = [];
    for (const date of uniqueDates) {
      const existing = await tx.workSchedule.findFirst({ where: { employeeId: employee.id, date } });
      if (existing) {
        saved.push(
          await tx.workSchedule.update({
            where: { id: existing.id },
            data: { shift: shiftRange, ownerId: req.user!.id },
          }),
        );
      } else {
        saved.push(
          await tx.workSchedule.create({
            data: { employeeId: employee.id, ownerId: req.user!.id, date, shift: shiftRange },
          }),
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
      employeeId: entry.employeeId,
    })),
  });
});

router.delete('/owner/schedule/:id', ...ownerAuth, async (req, res) => {
  const id = Number(req.params['id']);
  const entry = await prisma.workSchedule.findFirst({ where: { id, ownerId: req.user!.id } });
  if (!entry) return res.status(404).json({ error: 'Nie znaleziono wpisu grafiku.' });

  await prisma.workSchedule.delete({ where: { id } });
  res.json({ message: 'Wpis grafiku został usunięty.' });
});

export default router;
