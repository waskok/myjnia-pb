import { PrismaClient, type Customer, type Employee, type Fuel, type WashService } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const HASH_ROUNDS = 10;

async function main() {
  console.log('Seeding database...');

  // ─── Owner ───────────────────────────────────────────────────────────────────
  const ownerPassword = await bcrypt.hash('Admin1234!', HASH_ROUNDS);
  const owner = await prisma.owner.upsert({
    where: { login: 'owner' },
    update: {},
    create: {
      firstName: 'Kamil',
      lastName: 'Kowalski',
      login: 'owner',
      password: ownerPassword,
    },
  });
  console.log(`Owner: ${owner.firstName} ${owner.lastName} (login: ${owner.login})`);

  // ─── Employees ───────────────────────────────────────────────────────────────
  const employeePassword = await bcrypt.hash('Pracownik1!', HASH_ROUNDS);

  const employeeDefs = [
    { login: 'kasjer01', firstName: 'Anna', lastName: 'Nowak', role: 'Kasjer', phone: '501234567', email: 'anna.nowak@myjniapb.pl' },
    { login: 'myjnia01', firstName: 'Marek', lastName: 'Wiśniewski', role: 'Obsługa Myjni', phone: '502345678', email: 'marek.wisniewski@myjniapb.pl' },
    { login: 'lpg01', firstName: 'Tomasz', lastName: 'Zając', role: 'Obsługa dystrybutora LPG', phone: '503456789', email: 'tomasz.zajac@myjniapb.pl' },
  ];

  const employees: Employee[] = [];
  for (const def of employeeDefs) {
    const employee = await prisma.employee.upsert({
      where: { login: def.login },
      update: {},
      create: {
        ...def,
        password: employeePassword,
        ownerId: owner.id,
        isActive: true,
      },
    });
    employees.push(employee);
    console.log(`Employee: ${employee.firstName} ${employee.lastName} (${employee.role})`);
  }

  // ─── Fuels ───────────────────────────────────────────────────────────────────
  const fuelDefs = [
    { type: 'E95', pricePerLiter: 6.39, tankLevel: 8500, maxLevel: 20000 },
    { type: 'E98', pricePerLiter: 6.89, tankLevel: 6200, maxLevel: 15000 },
    { type: 'ON', pricePerLiter: 6.19, tankLevel: 12800, maxLevel: 25000 },
    { type: 'LPG', pricePerLiter: 2.99, tankLevel: 3400, maxLevel: 10000 },
  ];

  const fuels: Fuel[] = [];
  for (const def of fuelDefs) {
    const existing = await prisma.fuel.findFirst({ where: { type: def.type } });
    const fuel = existing
      ? await prisma.fuel.update({ where: { id: existing.id }, data: def })
      : await prisma.fuel.create({ data: def });
    fuels.push(fuel);
    console.log(`Fuel: ${fuel.type} – ${fuel.pricePerLiter} PLN/L`);
  }

  // ─── Loyalty Program ─────────────────────────────────────────────────────────
  const existingLoyalty = await prisma.loyaltyProgram.findFirst();
  const loyalty = existingLoyalty
    ? await prisma.loyaltyProgram.update({
        where: { id: existingLoyalty.id },
        data: {
          pointsPerE95: 100,
          pointsPerE98: 120,
          pointsPerDiesel: 100,
          pointsPerLpg: 50,
          pointsPerStandardWash: 300,
          pointsPerWaxWash: 400,
          earnPointsPerE95: 2,
          earnPointsPerE98: 3,
          earnPointsPerDiesel: 2,
          earnPointsPerLpg: 1,
          earnPointsPerStandardWash: 5,
          earnPointsPerWaxWash: 10,
        },
      })
    : await prisma.loyaltyProgram.create({
        data: {
          pointsPerE95: 100,
          pointsPerE98: 120,
          pointsPerDiesel: 100,
          pointsPerLpg: 50,
          pointsPerStandardWash: 300,
          pointsPerWaxWash: 400,
          earnPointsPerE95: 2,
          earnPointsPerE98: 3,
          earnPointsPerDiesel: 2,
          earnPointsPerLpg: 1,
          earnPointsPerStandardWash: 5,
          earnPointsPerWaxWash: 10,
        },
      });
  console.log(`Loyalty program configured (ID: ${loyalty.id})`);

  // ─── Car Wash & Services ─────────────────────────────────────────────────────
  let carWash = await prisma.carWash.findFirst();
  if (!carWash) {
    carWash = await prisma.carWash.create({ data: { slots: 2 } });
    console.log('CarWash created');
  }

  const serviceDefs = [
    { type: 'mycie_standard', price: 39.00, loyaltyPoints: 5 },
    { type: 'mycie_wosk', price: 59.00, loyaltyPoints: 10 },
  ];
  const washServices: WashService[] = [];
  for (const def of serviceDefs) {
    const existing = await prisma.washService.findFirst({
      where: { carWashId: carWash.id, type: def.type },
    });
    const ws = existing
      ? await prisma.washService.update({ where: { id: existing.id }, data: def })
      : await prisma.washService.create({ data: { ...def, carWashId: carWash.id } });
    washServices.push(ws);
    console.log(`WashService: ${ws.type} – ${ws.price} PLN`);
  }

  // ─── Customers ───────────────────────────────────────────────────────────────
  const customerPassword = await bcrypt.hash('Klient1234!', HASH_ROUNDS);

  const individualDefs = [
    { firstName: 'Piotr', lastName: 'Kowalczyk', email: 'piotr.kowalczyk@example.pl', phone: '601111222', address: 'ul. Słoneczna 5, 30-001 Kraków', pesel: '85041523619', loyaltyPoints: 450 },
    { firstName: 'Katarzyna', lastName: 'Lewandowska', email: 'kasia.lewandowska@example.pl', phone: '602222333', address: 'ul. Różana 12, 30-002 Kraków', pesel: '92120814523', loyaltyPoints: 1200 },
    { firstName: 'Michał', lastName: 'Dąbrowski', email: 'michal.dabrowski@example.pl', phone: '603333444', address: 'ul. Lipowa 3, 30-003 Kraków', pesel: '78071634721', loyaltyPoints: 80 },
  ];

  const companyDefs = [
    { companyName: 'AutoFlota Sp. z o.o.', email: 'biuro@autoflota.pl', phone: '121234567', address: 'al. Armii Krajowej 15, 30-150 Kraków', nip: '6762345678', regon: '123456789', loyaltyPoints: 3500 },
    { companyName: 'Transport MAX Piotr Malinowski', email: 'kontakt@transportmax.pl', phone: '122345678', address: 'ul. Przemysłowa 8, 32-005 Wieliczka', nip: '6831234567', regon: '987654321', loyaltyPoints: 720 },
  ];

  const allCustomers: Customer[] = [];
  for (const def of individualDefs) {
    const existing = await prisma.customer.findUnique({ where: { email: def.email } });
    if (!existing) {
      const customer = await prisma.customer.create({
        data: {
          firstName: def.firstName,
          lastName: def.lastName,
          email: def.email,
          phone: def.phone,
          address: def.address,
          password: customerPassword,
          registered: true,
          loyaltyPoints: def.loyaltyPoints,
          individualCustomer: { create: { pesel: def.pesel } },
        },
      });
      allCustomers.push(customer);
      console.log(`Customer (individual): ${customer.firstName} ${customer.lastName}`);
    } else {
      allCustomers.push(existing);
    }
  }

  for (const def of companyDefs) {
    const existing = await prisma.customer.findUnique({ where: { email: def.email } });
    if (!existing) {
      const customer = await prisma.customer.create({
        data: {
          firstName: def.companyName,
          lastName: '—',
          email: def.email,
          phone: def.phone,
          address: def.address,
          password: customerPassword,
          registered: true,
          loyaltyPoints: def.loyaltyPoints,
          companyCustomer: {
            create: {
              companyName: def.companyName,
              nip: def.nip,
              regon: def.regon,
            },
          },
        },
      });
      allCustomers.push(customer);
      console.log(`Customer (company): ${def.companyName}`);
    } else {
      allCustomers.push(existing);
    }
  }

  // ─── Reservation History ─────────────────────────────────────────────────────
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const reservationDefs = [
    { daysAgo: 28, status: 'Zakończona', serviceIdx: 0, custIdx: 0 },
    { daysAgo: 25, status: 'Zakończona', serviceIdx: 1, custIdx: 1 },
    { daysAgo: 22, status: 'Zakończona', serviceIdx: 0, custIdx: 2 },
    { daysAgo: 20, status: 'Anulowana', serviceIdx: 1, custIdx: 0 },
    { daysAgo: 18, status: 'Zakończona', serviceIdx: 0, custIdx: 3 },
    { daysAgo: 15, status: 'Zakończona', serviceIdx: 1, custIdx: 1 },
    { daysAgo: 12, status: 'Zakończona', serviceIdx: 0, custIdx: 4 },
    { daysAgo: 10, status: 'Anulowana', serviceIdx: 0, custIdx: 2 },
    { daysAgo: 8, status: 'Zakończona', serviceIdx: 1, custIdx: 0 },
    { daysAgo: 6, status: 'Zakończona', serviceIdx: 0, custIdx: 1 },
    { daysAgo: 4, status: 'Oczekująca', serviceIdx: 1, custIdx: 2 },
    { daysAgo: 2, status: 'Oczekująca', serviceIdx: 0, custIdx: 3 },
    { daysAgo: -1, status: 'Oczekująca', serviceIdx: 1, custIdx: 4 },
    { daysAgo: -3, status: 'Oczekująca', serviceIdx: 0, custIdx: 0 },
  ];

  const existingReservationCount = await prisma.reservation.count();
  if (existingReservationCount === 0) {
    for (const def of reservationDefs) {
      const customer = allCustomers[def.custIdx];
      const service = washServices[def.serviceIdx];
      if (!customer || !service) continue;
      const date = new Date(now.getTime() - def.daysAgo * dayMs);
      date.setHours(10 + (def.custIdx * 2), 0, 0, 0);
      await prisma.reservation.create({
        data: {
          customerId: customer.id,
          washServiceId: service.id,
          date,
          status: def.status,
        },
      });
    }
    console.log(`Created ${reservationDefs.length} reservations`);
  }

  // ─── POS Transactions ─────────────────────────────────────────────────────────
  const kasjer = employees.find((e) => e.role === 'Kasjer');
  const existingTransactionCount = await prisma.transaction.count();

  if (kasjer && existingTransactionCount === 0) {
    const e95 = fuels.find((f) => f.type === 'E95');
    const e98 = fuels.find((f) => f.type === 'E98');
    const on = fuels.find((f) => f.type === 'ON');
    const lpg = fuels.find((f) => f.type === 'LPG');

    const txDefs = [
      { daysAgo: 29, fuel: e95, liters: 40, method: 'Karta', custIdx: 0 as const, earnPoints: 80 },
      { daysAgo: 26, fuel: e98, liters: 55, method: 'Gotówka', custIdx: 1 as const, earnPoints: 165 },
      { daysAgo: 21, fuel: on, liters: 80, method: 'Karta', custIdx: 3 as const, earnPoints: 160 },
      { daysAgo: 17, fuel: lpg, liters: 25, method: 'Gotówka', custIdx: null, earnPoints: 0 },
      { daysAgo: 11, fuel: e95, liters: 30, method: 'Karta', custIdx: 2 as const, earnPoints: 60 },
      { daysAgo: 7, fuel: e98, liters: 60, method: 'Gotówka', custIdx: 4 as const, earnPoints: 180 },
      { daysAgo: 3, fuel: on, liters: 100, method: 'Karta', custIdx: 3 as const, earnPoints: 200 },
    ];

    for (const def of txDefs) {
      if (!def.fuel) continue;
      const customer = def.custIdx !== null ? (allCustomers[def.custIdx] ?? null) : null;
      const total = def.fuel.pricePerLiter * def.liters;
      const txDate = new Date(now.getTime() - def.daysAgo * dayMs);
      txDate.setHours(12, 30, 0, 0);

      if (customer && def.earnPoints > 0) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { loyaltyPoints: { increment: def.earnPoints } },
        });
      }

      await prisma.transaction.create({
        data: {
          employeeId: kasjer.id,
          customerId: customer?.id ?? null,
          date: txDate,
          totalAmount: total,
          paymentMethod: def.method,
          items: {
            create: [
              {
                product: `Paliwo ${def.fuel.type}`,
                quantity: def.liters,
                unitPrice: def.fuel.pricePerLiter,
                value: total,
              },
            ],
          },
        },
      });
    }
    console.log(`Created ${txDefs.length} POS transactions`);
  }

  console.log('Seeding complete!');
  console.log('');
  console.log('Test credentials:');
  console.log(`  Owner:    login=owner,     password=Admin1234!`);
  console.log(`  Kasjer:   login=kasjer01,  password=Pracownik1!`);
  console.log(`  Myjnia:   login=myjnia01,  password=Pracownik1!`);
  console.log(`  LPG:      login=lpg01,     password=Pracownik1!`);
  console.log(`  Customer: email=piotr.kowalczyk@example.pl, password=Klient1234!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
