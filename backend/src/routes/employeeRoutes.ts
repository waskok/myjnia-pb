import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';
import { formatDateOnly, getMonthRange } from '../scheduleUtils.js';

interface TokenPayload {
  id: number;
  role?: string;
  email?: string;
}

const router = Router();
const SHIFT_RANGE_REGEX = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

interface LoyaltyRates {
  pointsPerE95: number;
  pointsPerE98: number;
  pointsPerDiesel: number;
  pointsPerLpg: number;
}

function resolveFuelPointsRate(fuelType: string, rates: LoyaltyRates): number {
  const type = fuelType.toUpperCase();
  if (type.includes('LPG')) return rates.pointsPerLpg;
  if (type.includes('98')) return rates.pointsPerE98;
  if (type.includes('DIESEL') || type.includes('ON')) return rates.pointsPerDiesel;
  return rates.pointsPerE95;
}

interface InvoicePayload {
  number: string;
  issueDate: string;
  amount: number;
  paymentMethod: string;
  quantity: number;
  fuelType: string;
  unitPrice: number;
  buyer: {
    name: string;
    address: string;
    email: string;
    phone: string;
    type: 'individual' | 'company';
    identifiers: {
      pesel?: string;
      nip?: string;
      regon?: string;
    };
  };
}

function buildInvoiceIdentifiers(params: { pesel?: string | null; nip?: string | null; regon?: string | null }) {
  const identifiers: { pesel?: string; nip?: string; regon?: string } = {};
  if (params.pesel) identifiers.pesel = params.pesel;
  if (params.nip) identifiers.nip = params.nip;
  if (params.regon) identifiers.regon = params.regon;
  return identifiers;
}

function parseShiftRange(shift: string): { startTime: string; endTime: string } {
  if (SHIFT_RANGE_REGEX.test(shift)) {
    const [startTime = shift, endTime = shift] = shift.split('-');
    return { startTime, endTime };
  }
  return { startTime: shift, endTime: shift };
}

type MonitoringPeriod = '1h' | '24h' | '7d' | '30d' | 'custom';
const ALERT_SUFFIX = ' [Wysłano wiadomość SMS i Email]';

function getWindowFromPeriod(period: MonitoringPeriod, fromRaw?: string, toRaw?: string) {
  const now = new Date();
  if (period === 'custom') {
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      return null;
    }
    return { from, to };
  }

  const from = new Date(now);
  if (period === '1h') from.setHours(from.getHours() - 1);
  if (period === '24h') from.setHours(from.getHours() - 24);
  if (period === '7d') from.setDate(from.getDate() - 7);
  if (period === '30d') from.setDate(from.getDate() - 30);
  return { from, to: now };
}

function getFuelTankCode(type: string): 'E95' | 'E98' | 'ON' | 'LPG' {
  const normalized = type.toUpperCase();
  if (normalized.includes('LPG')) return 'LPG';
  if (normalized.includes('98')) return 'E98';
  if (normalized.includes('ON') || normalized.includes('DIESEL')) return 'ON';
  return 'E95';
}

function normalizeFuelDisplayName(type: string): string {
  const normalized = type.toUpperCase();
  if (normalized.includes('ON') || normalized.includes('DIESEL')) {
    return 'Olej napędowy ON';
  }
  return type;
}

function numericOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}

interface MonitoringConfigShape {
  samplingIntervalSec: number;
  fuelLowLevelPercent: number;
  fuelMaxPressureBar: number;
  fuelMaxTempC: number;
  lpgLowLevelPercent: number;
  lpgMaxPressureBar: number;
  lpgMaxTempC: number;
}

let samplingTimer: NodeJS.Timeout | null = null;

const DEFAULT_MONITORING_CONFIG: MonitoringConfigShape = {
  samplingIntervalSec: 300,
  fuelLowLevelPercent: 20,
  fuelMaxPressureBar: 2.5,
  fuelMaxTempC: 35,
  lpgLowLevelPercent: 20,
  lpgMaxPressureBar: 14,
  lpgMaxTempC: 30
};

const CONFIG_TYPES = [
  'samplingIntervalSec',
  'fuelLowLevelPercent',
  'fuelMaxPressureBar',
  'fuelMaxTempC',
  'lpgLowLevelPercent',
  'lpgMaxPressureBar',
  'lpgMaxTempC'
] as const;

async function ensureMonitoringConfig(): Promise<MonitoringConfigShape> {
  const latestConfigRows = await prisma.sensor.findMany({
    where: {
      tank: 'CONFIG',
      type: { in: [...CONFIG_TYPES] }
    },
    orderBy: { createdAt: 'desc' }
  });
  const configMap = new Map<string, number>();
  for (const row of latestConfigRows) {
    if (!configMap.has(row.type)) {
      configMap.set(row.type, row.value);
    }
  }
  return {
    samplingIntervalSec: Number(configMap.get('samplingIntervalSec') ?? DEFAULT_MONITORING_CONFIG.samplingIntervalSec),
    fuelLowLevelPercent: Number(configMap.get('fuelLowLevelPercent') ?? DEFAULT_MONITORING_CONFIG.fuelLowLevelPercent),
    fuelMaxPressureBar: Number(configMap.get('fuelMaxPressureBar') ?? DEFAULT_MONITORING_CONFIG.fuelMaxPressureBar),
    fuelMaxTempC: Number(configMap.get('fuelMaxTempC') ?? DEFAULT_MONITORING_CONFIG.fuelMaxTempC),
    lpgLowLevelPercent: Number(configMap.get('lpgLowLevelPercent') ?? DEFAULT_MONITORING_CONFIG.lpgLowLevelPercent),
    lpgMaxPressureBar: Number(configMap.get('lpgMaxPressureBar') ?? DEFAULT_MONITORING_CONFIG.lpgMaxPressureBar),
    lpgMaxTempC: Number(configMap.get('lpgMaxTempC') ?? DEFAULT_MONITORING_CONFIG.lpgMaxTempC)
  };
}

async function saveAutomaticMonitoringSnapshot() {
  const fuels = await prisma.fuel.findMany({ orderBy: { id: 'asc' } });
  if (fuels.length === 0) return;

  const now = new Date();
  const rows: Array<{
    monitoringId: number;
    tank: 'E95' | 'E98' | 'ON' | 'LPG';
    type: 'level' | 'pressure' | 'temperature' | 'safety_valve';
    value: number;
    status: string;
    createdAt: Date;
  }> = [];

  for (const fuel of fuels) {
    const tankCode = getFuelTankCode(fuel.type);
    const sensorFailure = Math.random() < 0.01;

    rows.push({
      monitoringId: 1,
      tank: tankCode,
      type: 'level',
      value: Number(fuel.tankLevel),
      status: sensorFailure ? 'AWARIA' : 'OK',
      createdAt: now
    });

    if (tankCode === 'LPG') {
      const pressure = Math.random() < 0.06 ? 14.2 + Math.random() * 1.4 : 9 + Math.random() * 4.7;
      const temperature = Math.random() < 0.06 ? 31 + Math.random() * 8 : 4 + Math.random() * 20;
      const safetyValveTriggered = pressure > 14.4 ? 1 : 0;

      rows.push(
        { monitoringId: 1, tank: 'LPG', type: 'pressure', value: Number(pressure.toFixed(2)), status: sensorFailure ? 'AWARIA' : 'OK', createdAt: now },
        { monitoringId: 1, tank: 'LPG', type: 'temperature', value: Number(temperature.toFixed(2)), status: sensorFailure ? 'AWARIA' : 'OK', createdAt: now },
        { monitoringId: 1, tank: 'LPG', type: 'safety_valve', value: safetyValveTriggered, status: safetyValveTriggered ? 'VALVE_TRIGGERED' : 'OK', createdAt: now }
      );

      await prisma.lpgStation.upsert({
        where: { id: 1 },
        update: { lpgLevel: fuel.tankLevel, pressure, temperature },
        create: { id: 1, lpgLevel: fuel.tankLevel, pressure, temperature }
      });
    } else {
      const pressure = Math.random() < 0.04 ? 2.6 + Math.random() * 1.2 : 0.2 + Math.random() * 2.1;
      const temperature = Math.random() < 0.04 ? 36 + Math.random() * 10 : 8 + Math.random() * 20;
      const safetyValveTriggered = pressure > 2.8 ? 1 : 0;

      rows.push(
        { monitoringId: 1, tank: tankCode, type: 'pressure', value: Number(pressure.toFixed(2)), status: sensorFailure ? 'AWARIA' : 'OK', createdAt: now },
        { monitoringId: 1, tank: tankCode, type: 'temperature', value: Number(temperature.toFixed(2)), status: sensorFailure ? 'AWARIA' : 'OK', createdAt: now },
        { monitoringId: 1, tank: tankCode, type: 'safety_valve', value: safetyValveTriggered, status: safetyValveTriggered ? 'VALVE_TRIGGERED' : 'OK', createdAt: now }
      );
    }
  }

  await prisma.monitoring.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });
  await prisma.sensor.createMany({ data: rows });
}

async function restartMonitoringSampler() {
  const config = await ensureMonitoringConfig();
  const intervalMs = Math.max(15, Math.floor(config.samplingIntervalSec)) * 1000;
  if (samplingTimer) clearInterval(samplingTimer);
  await saveAutomaticMonitoringSnapshot();
  samplingTimer = setInterval(() => {
    saveAutomaticMonitoringSnapshot().catch((error) => {
      console.error('Automatic monitoring snapshot failed:', error);
    });
  }, intervalMs);
}

// ==========================================
// MODUŁ KASJERA (POS) I SPRZEDAŻY
// ==========================================
router.get('/fuels', async (req, res) => {
  try {
    const fuels = await prisma.fuel.findMany({
      orderBy: { id: 'asc' }
    });
    res.json(
      fuels.map((fuel) => ({
        ...fuel,
        type: normalizeFuelDisplayName(fuel.type)
      }))
    );
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania paliw' });
  }
});

router.get('/employee/customer/:identifier', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;

    if (decoded.role !== 'employee' && decoded.role !== 'owner') {
      return res.status(403).json({ error: 'Brak uprawnień!' });
    }

    const { identifier } = req.params;
    
    const customer = await prisma.customer.findFirst({
      where: { OR: [ { email: identifier }, { phone: identifier } ] },
      select: { id: true, firstName: true, lastName: true, email: true, loyaltyPoints: true }
    });

    if (!customer) return res.status(404).json({ error: 'Nie znaleziono klienta w bazie.' });
    
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd pobierania danych klienta.' });
  }
});

router.post('/transactions/fuel', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Brak poprawnego tokena!' });
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;

    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień kasjera!' });

    const { fuelId, quantity, customerEmail, paymentMethod, issueInvoice } = req.body;
    if (!fuelId || !quantity || !paymentMethod) return res.status(400).json({ error: 'Brakujące dane transakcji!' });
    const liters = Number(quantity);
    if (!Number.isFinite(liters) || liters <= 0) {
      return res.status(400).json({ error: 'Podaj poprawną ilość litrów.' });
    }

    const fuel = await prisma.fuel.findUnique({ where: { id: Number(fuelId) } });
    if (!fuel) return res.status(404).json({ error: 'Paliwo nie znalezione!' });
    if (fuel.tankLevel < liters) return res.status(400).json({ error: 'Brak wystarczającej ilości paliwa w zbiorniku!' });

    let customer = null;
    if (customerEmail) {
      customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
      if (!customer) return res.status(404).json({ error: 'Nie znaleziono klienta o podanym e-mailu!' });
    }

    let totalAmount = fuel.pricePerLiter * liters;
    let pointsEarned = 0;
    let pointsDeducted = 0;
    const loyalty = await prisma.loyaltyProgram.findFirst();
    const loyaltyRates: LoyaltyRates = {
      pointsPerE95: loyalty?.pointsPerE95 ?? 100,
      pointsPerE98: loyalty?.pointsPerE98 ?? 100,
      pointsPerDiesel: loyalty?.pointsPerDiesel ?? 100,
      pointsPerLpg: loyalty?.pointsPerLpg ?? 50
    };
    const pointsRate = resolveFuelPointsRate(fuel.type, loyaltyRates);

    if (paymentMethod === 'Punkty') {
        if (!customer) return res.status(400).json({ error: 'Płacenie punktami wymaga podania e-maila zarejestrowanego klienta!' });
        const pointsNeeded = Math.floor(liters * pointsRate);
        if (customer.loyaltyPoints < pointsNeeded) {
            return res.status(400).json({ error: `Za mało punktów! Potrzeba ${pointsNeeded} pkt, klient ma ${customer.loyaltyPoints} pkt.` });
        }
        pointsDeducted = pointsNeeded;
        totalAmount = 0; 
        await prisma.customer.update({ where: { id: customer.id }, data: { loyaltyPoints: { decrement: pointsDeducted } } });
    } else {
        if (customer) {
          pointsEarned = Math.floor(liters * pointsRate);
          await prisma.customer.update({ where: { id: customer.id }, data: { loyaltyPoints: { increment: pointsEarned } } });
        }
    }

    const transaction = await prisma.transaction.create({
      data: {
        employeeId: decoded.id,
        customerId: customer ? customer.id : null,
        date: new Date(),
        totalAmount: totalAmount,
        paymentMethod: paymentMethod,
        items: {
          create: [{ product: `Paliwo ${fuel.type}`, quantity: liters, unitPrice: fuel.pricePerLiter, value: totalAmount }]
        }
      }
    });

    let documentMsg = ' Drukowanie paragonu...';
    let invoicePayload: InvoicePayload | null = null;
    if (issueInvoice && !customer) {
      return res.status(400).json({ error: 'Aby wystawić fakturę, podaj e-mail zarejestrowanego klienta!' });
    }
    if (issueInvoice && customer && !customer.registered) {
      return res.status(400).json({ error: 'Fakturę można wystawić tylko zarejestrowanemu klientowi.' });
    }
    if (issueInvoice && customer && totalAmount > 0) {
      const invoiceNumber = `FV/${new Date().getFullYear()}/${transaction.id}`;
      const invoice = await prisma.invoice.create({
        data: { customerId: customer.id, transactionId: transaction.id, number: invoiceNumber, amount: totalAmount }
      });

      const [individualData, companyData] = await Promise.all([
        prisma.individualCustomer.findUnique({ where: { customerId: customer.id } }),
        prisma.companyCustomer.findUnique({ where: { customerId: customer.id } })
      ]);

      const identifiersInput: { pesel?: string | null; nip?: string | null; regon?: string | null } = {};
      if (individualData?.pesel) identifiersInput.pesel = individualData.pesel;
      if (companyData?.nip || individualData?.nip) identifiersInput.nip = companyData?.nip || individualData?.nip || null;
      if (companyData?.regon) identifiersInput.regon = companyData.regon;

      invoicePayload = {
        number: invoice.number,
        issueDate: invoice.date.toISOString(),
        amount: totalAmount,
        paymentMethod,
        quantity: liters,
        fuelType: fuel.type,
        unitPrice: fuel.pricePerLiter,
        buyer: {
          name: companyData?.companyName || `${customer.firstName} ${customer.lastName}`,
          address: customer.address,
          email: customer.email,
          phone: customer.phone,
          type: companyData ? 'company' : 'individual',
          identifiers: buildInvoiceIdentifiers(identifiersInput)
        }
      };

      documentMsg = ' Wystawiono Fakturę VAT.';
    }

    await prisma.fuel.update({ where: { id: fuel.id }, data: { tankLevel: { decrement: liters } } });

    if (paymentMethod === 'Punkty') {
         res.status(201).json({ message: `Opłacono punktami! Pobrano ${pointsDeducted} pkt.${documentMsg}`, invoice: invoicePayload });
    } else {
         res.status(201).json({ message: `Sprzedano: ${totalAmount.toFixed(2)} zł. ${pointsEarned > 0 ? `Klient zyskał ${pointsEarned} pkt! ` : ''}${documentMsg}`, invoice: invoicePayload });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas transakcji.' });
  }
});

// ==========================================
// MODUŁ GRAFIKU PRACOWNIKÓW (ODCZYT)
// ==========================================
router.get('/employee/schedule', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień!' });

    const employee = await prisma.employee.findUnique({
      where: { id: decoded.id },
      select: { ownerId: true }
    });
    if (!employee) return res.status(404).json({ error: 'Nie znaleziono pracownika.' });

    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const range = getMonthRange(year, month);
    if (!range) {
      return res.status(400).json({ error: 'Podaj poprawne parametry year i month (1–12).' });
    }

    const schedules = await prisma.workSchedule.findMany({
      where: {
        ownerId: employee.ownerId,
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

// ==========================================
// MODUŁ PRACOWNIKA (ZARZĄDZANIE MYJNIĄ)
// ==========================================
router.get('/employee/reservations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień.' });

    const allReservations = await prisma.reservation.findMany({
      include: { washService: true, customer: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { date: 'asc' }
    });
    res.status(200).json(allReservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd pobierania rezerwacji.' });
  }
});

router.patch('/employee/reservations/:id/complete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień!' });

    await prisma.reservation.update({ where: { id: Number(req.params.id) }, data: { status: 'Zakończona' } });
    res.status(200).json({ message: 'Rezerwacja oznaczona jako zakończona!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd aktualizacji statusu.' });
  }
});

router.patch('/employee/reservations/:id/cancel', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień!' });

    await prisma.reservation.update({ where: { id: Number(req.params.id) }, data: { status: 'Anulowana' } });
    res.status(200).json({ message: 'Rezerwacja została anulowana!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas anulowania rezerwacji.' });
  }
});

// ==========================================
// MODUŁ MONITORINGU (Czujniki i Alerty)
// ==========================================
router.get('/monitoring', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;

    if (decoded.role !== 'employee' && decoded.role !== 'owner') {
      return res.status(403).json({ error: 'Brak uprawnień!' });
    }

    const requestedPeriod = (req.query.period as MonitoringPeriod | undefined) ?? '24h';
    const period: MonitoringPeriod = ['1h', '24h', '7d', '30d', 'custom'].includes(requestedPeriod) ? requestedPeriod : '24h';
    const window = getWindowFromPeriod(period, req.query.from as string | undefined, req.query.to as string | undefined);
    if (!window) {
      return res.status(400).json({ error: 'Nieprawidłowy zakres czasu.' });
    }

    const config = await ensureMonitoringConfig();
    const alerts: string[] = [];
    const fuels = await prisma.fuel.findMany({ orderBy: { id: 'asc' } });
    const relevantTankCodes = ['E95', 'E98', 'ON', 'LPG'] as const;

    const latestSensors = await prisma.sensor.findMany({
      where: {
        tank: { in: [...relevantTankCodes] },
        type: { in: ['pressure', 'temperature'] }
      },
      orderBy: { createdAt: 'desc' }
    });
    const latestByKey = new Map<string, { value: number; createdAt: Date }>();
    for (const sensor of latestSensors) {
      const key = `${sensor.tank}:${sensor.type}`;
      if (!latestByKey.has(key)) {
        latestByKey.set(key, { value: sensor.value, createdAt: sensor.createdAt });
      }
    }

    const fuelStatus = fuels.map((fuel) => {
      const tankCode = getFuelTankCode(fuel.type);
      const percentageNum = fuel.maxLevel > 0 ? (fuel.tankLevel / fuel.maxLevel) * 100 : 0;
      const displayType = normalizeFuelDisplayName(fuel.type);
      if (tankCode !== 'LPG' && percentageNum < config.fuelLowLevelPercent) {
        alerts.push(`Krytycznie niski poziom paliwa ${displayType} (${percentageNum.toFixed(1)}%).${ALERT_SUFFIX}`);
      }
      const pressure = numericOrNull(latestByKey.get(`${tankCode}:pressure`)?.value);
      const temperature = numericOrNull(latestByKey.get(`${tankCode}:temperature`)?.value);
      if (tankCode !== 'LPG' && pressure !== null && pressure > config.fuelMaxPressureBar) {
        alerts.push(`Przekroczona dopuszczalna wartość ciśnienia w zbiorniku ${displayType}: ${pressure.toFixed(2)} bar.${ALERT_SUFFIX}`);
      }
      if (tankCode !== 'LPG' && temperature !== null && temperature > config.fuelMaxTempC) {
        alerts.push(`Przekroczona dopuszczalna temperatura w zbiorniku ${displayType}: ${temperature.toFixed(2)} °C.${ALERT_SUFFIX}`);
      }
      return {
        ...fuel,
        type: displayType,
        percentage: percentageNum.toFixed(1),
        tankCode,
        pressure,
        temperature,
      };
    });

    const lpgFuel = fuelStatus.find((fuel) => fuel.tankCode === 'LPG') ?? null;
    const lpgPressureVal = lpgFuel?.pressure;
    const lpgPercentageNum = lpgFuel && lpgFuel.maxLevel > 0 ? (lpgFuel.tankLevel / lpgFuel.maxLevel) * 100 : null;
    if (lpgPercentageNum !== null && lpgPercentageNum < config.lpgLowLevelPercent) {
      alerts.push(`Niski poziom LPG (${lpgPercentageNum.toFixed(1)}%).${ALERT_SUFFIX}`);
    }
    if (typeof lpgPressureVal === 'number' && lpgPressureVal > config.lpgMaxPressureBar) {
      alerts.push(`Zbyt wysokie ciśnienie zbiornika LPG: ${lpgPressureVal.toFixed(2)} bar.${ALERT_SUFFIX}`);
    }
    const lpgTempVal = lpgFuel?.temperature;
    if (typeof lpgTempVal === 'number' && lpgTempVal > config.lpgMaxTempC) {
      alerts.push(`Przekroczona dopuszczalna temperatura w zbiorniku LPG: ${lpgTempVal.toFixed(2)} °C.${ALERT_SUFFIX}`);
    }

    const historySensors = await prisma.sensor.findMany({
      where: {
        tank: { in: [...relevantTankCodes] },
        type: { in: ['pressure', 'temperature', 'level', 'safety_valve'] },
        createdAt: { gte: window.from, lte: window.to }
      },
      orderBy: { createdAt: 'asc' }
    });

    const groupedHistory = new Map<string, Array<{ timestamp: string; value: number }>>();
    for (const reading of historySensors) {
      const key = `${reading.tank}:${reading.type}`;
      const list = groupedHistory.get(key) ?? [];
      list.push({ timestamp: reading.createdAt.toISOString(), value: reading.value });
      groupedHistory.set(key, list);
    }

    const latestSystemSensors = await prisma.sensor.findMany({
      where: {
        tank: { in: [...relevantTankCodes] }
      },
      orderBy: { createdAt: 'desc' }
    });
    const latestSensorByTank = new Map<string, { status: string; type: string; value: number }>();
    for (const sensor of latestSystemSensors) {
      if (!latestSensorByTank.has(sensor.tank)) {
        latestSensorByTank.set(sensor.tank, { status: sensor.status, type: sensor.type, value: sensor.value });
      }
    }
    latestSensorByTank.forEach((sensor, tank) => {
      const status = (sensor.status || '').toUpperCase();
      if (status.includes('FAIL') || status.includes('ERROR') || status.includes('AWARIA')) {
        alerts.push(`Awaria czujnika w zbiorniku ${tank}.${ALERT_SUFFIX}`);
      }
      if (
        sensor.type === 'safety_valve' ||
        status.includes('VALVE') ||
        status.includes('ZAWOR')
      ) {
        if (sensor.value > 0) {
          alerts.push(`Uruchomienie zaworu bezpieczeństwa w zbiorniku ${tank}.${ALERT_SUFFIX}`);
        }
      }
    });

    const tankTelemetry = ['E95', 'E98', 'ON'].map((code) => {
      const fuel = fuelStatus.find((item) => item.tankCode === code) ?? null;
      return {
        tank: code,
        label: code === 'ON' ? 'Zbiornik 3 (ON)' : code === 'E98' ? 'Zbiornik 2 (E98)' : 'Zbiornik 1 (E95)',
        level: fuel ? fuel.tankLevel : null,
        maxLevel: fuel ? fuel.maxLevel : null,
        percentage: fuel ? fuel.percentage : null,
        pressure: fuel?.pressure ?? null,
        temperature: fuel?.temperature ?? null,
        history: {
          level: groupedHistory.get(`${code}:level`) ?? [],
          pressure: groupedHistory.get(`${code}:pressure`) ?? [],
          temperature: groupedHistory.get(`${code}:temperature`) ?? []
        }
      };
    });

    const lpgTelemetry = {
      level: lpgFuel ? lpgFuel.tankLevel : null,
      maxLevel: lpgFuel ? lpgFuel.maxLevel : null,
      percentage: lpgFuel ? lpgFuel.percentage : null,
      pressure: lpgFuel?.pressure ?? null,
      temp: lpgFuel?.temperature ?? null,
      history: {
        level: groupedHistory.get('LPG:level') ?? [],
        pressure: groupedHistory.get('LPG:pressure') ?? [],
        temperature: groupedHistory.get('LPG:temperature') ?? []
      }
    };

    const carWashStatus = [
      { bay: 1, occupied: Math.random() > 0.5, camera: Math.random() > 0.1 ? 'Działa' : 'Błąd sygnału' },
      { bay: 2, occupied: Math.random() > 0.5, camera: Math.random() > 0.1 ? 'Działa' : 'Błąd sygnału' }
    ];

    res.json({
      fuels: fuelStatus,
      tankTelemetry,
      lpg: lpgTelemetry,
      historyWindow: {
        period,
        from: window.from.toISOString(),
        to: window.to.toISOString()
      },
      config: {
        samplingIntervalSec: config.samplingIntervalSec,
        fuelLowLevelPercent: config.fuelLowLevelPercent,
        fuelMaxPressureBar: config.fuelMaxPressureBar,
        fuelMaxTempC: config.fuelMaxTempC,
        lpgLowLevelPercent: config.lpgLowLevelPercent,
        lpgMaxPressureBar: config.lpgMaxPressureBar,
        lpgMaxTempC: config.lpgMaxTempC
      },
      carWash: carWashStatus,
      alerts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd pobierania danych monitoringu.' });
  }
});

router.post('/monitoring/readings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'employee' && decoded.role !== 'owner') {
      return res.status(403).json({ error: 'Brak uprawnień!' });
    }

    const payload = req.body as {
      monitoringId?: number;
      readings?: Array<{
        tank: 'E95' | 'E98' | 'ON' | 'LPG';
        type: 'level' | 'pressure' | 'temperature' | 'safety_valve';
        value: number;
        status?: string;
        timestamp?: string;
      }>;
    };
    const readings = payload.readings ?? [];
    if (readings.length === 0) {
      return res.status(400).json({ error: 'Brak danych odczytów.' });
    }

    const monitoringId = Number(payload.monitoringId ?? 1);
    await prisma.monitoring.upsert({
      where: { id: monitoringId },
      update: {},
      create: { id: monitoringId }
    });

    await prisma.sensor.createMany({
      data: readings.map((reading) => ({
        monitoringId,
        tank: reading.tank,
        type: reading.type,
        value: Number(reading.value),
        status: reading.status ?? 'OK',
        createdAt: reading.timestamp ? new Date(reading.timestamp) : new Date()
      }))
    });

    const lpgLevelReading = readings.find((reading) => reading.tank === 'LPG' && reading.type === 'level');
    if (lpgLevelReading) {
      await prisma.lpgStation.upsert({
        where: { id: 1 },
        update: {
          lpgLevel: Number(lpgLevelReading.value),
          pressure: Number(readings.find((r) => r.tank === 'LPG' && r.type === 'pressure')?.value ?? 0),
          temperature: Number(readings.find((r) => r.tank === 'LPG' && r.type === 'temperature')?.value ?? 0)
        },
        create: {
          id: 1,
          lpgLevel: Number(lpgLevelReading.value),
          pressure: Number(readings.find((r) => r.tank === 'LPG' && r.type === 'pressure')?.value ?? 0),
          temperature: Number(readings.find((r) => r.tank === 'LPG' && r.type === 'temperature')?.value ?? 0)
        }
      });
    }

    res.status(201).json({ message: 'Odczyty monitoringu zostały zapisane.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd zapisu odczytów monitoringu.' });
  }
});

router.get('/monitoring/config', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'employee' && decoded.role !== 'owner') {
      return res.status(403).json({ error: 'Brak uprawnień!' });
    }
    const config = await ensureMonitoringConfig();
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd pobierania konfiguracji monitoringu.' });
  }
});

router.patch('/monitoring/config', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as TokenPayload;
    if (decoded.role !== 'owner') {
      return res.status(403).json({ error: 'Konfigurację może zmieniać tylko właściciel.' });
    }

    const currentConfig = await ensureMonitoringConfig();
    const payload = req.body as Partial<MonitoringConfigShape>;
    const next: MonitoringConfigShape = {
      samplingIntervalSec: Math.max(15, Math.floor(Number(payload.samplingIntervalSec ?? currentConfig.samplingIntervalSec))),
      fuelLowLevelPercent: Number(payload.fuelLowLevelPercent ?? currentConfig.fuelLowLevelPercent),
      fuelMaxPressureBar: Number(payload.fuelMaxPressureBar ?? currentConfig.fuelMaxPressureBar),
      fuelMaxTempC: Number(payload.fuelMaxTempC ?? currentConfig.fuelMaxTempC),
      lpgLowLevelPercent: Number(payload.lpgLowLevelPercent ?? currentConfig.lpgLowLevelPercent),
      lpgMaxPressureBar: Number(payload.lpgMaxPressureBar ?? currentConfig.lpgMaxPressureBar),
      lpgMaxTempC: Number(payload.lpgMaxTempC ?? currentConfig.lpgMaxTempC)
    };
    await prisma.monitoring.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 }
    });
    await prisma.sensor.createMany({
      data: [
        { monitoringId: 1, tank: 'CONFIG', type: 'samplingIntervalSec', value: next.samplingIntervalSec, status: 'OK' },
        { monitoringId: 1, tank: 'CONFIG', type: 'fuelLowLevelPercent', value: next.fuelLowLevelPercent, status: 'OK' },
        { monitoringId: 1, tank: 'CONFIG', type: 'fuelMaxPressureBar', value: next.fuelMaxPressureBar, status: 'OK' },
        { monitoringId: 1, tank: 'CONFIG', type: 'fuelMaxTempC', value: next.fuelMaxTempC, status: 'OK' },
        { monitoringId: 1, tank: 'CONFIG', type: 'lpgLowLevelPercent', value: next.lpgLowLevelPercent, status: 'OK' },
        { monitoringId: 1, tank: 'CONFIG', type: 'lpgMaxPressureBar', value: next.lpgMaxPressureBar, status: 'OK' },
        { monitoringId: 1, tank: 'CONFIG', type: 'lpgMaxTempC', value: next.lpgMaxTempC, status: 'OK' }
      ]
    });
    await restartMonitoringSampler();
    res.json({ message: 'Zaktualizowano konfigurację monitoringu.', config: next });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd aktualizacji konfiguracji monitoringu.' });
  }
});

void restartMonitoringSampler();

export default router;