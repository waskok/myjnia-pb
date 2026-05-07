import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config(); 

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors()); 
app.use(express.json()); 

// ==========================================
// ENDPOINTY TESTOWE
// ==========================================
app.get('/api/status', (req, res) => {
  res.json({ message: 'Serwer myjni PB działa i jest gotowy na żądania!' });
});

app.get('/api/db-check', async (req, res) => {
  try {
    const ownersCount = await prisma.owner.count();
    res.json({ message: `Połączenie z bazą działa! Liczba właścicieli w bazie: ${ownersCount}` });
  } catch (error) {
    res.status(500).json({ error: 'Błąd połączenia z bazą danych' });
  }
});

// ==========================================
// AUTORYZACJA KLIENTA
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, address, phone, email, password } = req.body;
    if (!firstName || !lastName || !address || !phone || !email || !password) {
      return res.status(400).json({ error: 'Wszystkie pola są wymagane!' });
    }

    const existingUser = await prisma.customer.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik o podanym adresie e-mail już istnieje!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newCustomer = await prisma.customer.create({
      data: { firstName, lastName, address, phone, email, password: hashedPassword, registered: true }
    });

    res.status(201).json({ message: 'Rejestracja zakończona sukcesem!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera podczas rejestracji.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Podaj adres e-mail i hasło!' });

    const user = await prisma.customer.findUnique({ where: { email } });
    if (!user || !user.password) return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło!' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło!' });

    const token = jwt.sign(
      { id: user.id, email: user.email }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: '2h' }
    );

    res.status(200).json({ message: 'Zalogowano pomyślnie!', token, user: { firstName: user.firstName, lastName: user.lastName } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera podczas logowania.' });
  }
});

// ==========================================
// WSPÓLNE LOGOWANIE SŁUŻBOWE (SZEF / PRACOWNIK)
// ==========================================
app.post('/api/staff/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Podaj login i hasło!' });

    const owner = await prisma.owner.findUnique({ where: { login } });
    if (owner) {
      const isPasswordValid = await bcrypt.compare(password, owner.password);
      if (isPasswordValid) {
        const token = jwt.sign(
          { id: owner.id, login: owner.login, role: 'owner' },
          process.env.JWT_SECRET as string,
          { expiresIn: '8h' }
        );
        return res.status(200).json({ message: 'Zalogowano do panelu Właściciela!', token, user: { firstName: owner.firstName, role: 'owner' } });
      }
    }

    const employee = await prisma.employee.findUnique({ where: { login } });
    if (employee) {
      const isPasswordValid = await bcrypt.compare(password, employee.password);
      if (isPasswordValid) {
        const token = jwt.sign(
          { id: employee.id, login: employee.login, role: 'employee' },
          process.env.JWT_SECRET as string,
          { expiresIn: '8h' }
        );
        return res.status(200).json({ message: 'Zalogowano do panelu Pracownika!', token, user: { firstName: employee.firstName, role: 'employee' } });
      }
    }

    return res.status(401).json({ error: 'Nieprawidłowy login lub hasło!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd logowania służbowego.' });
  }
});

// ==========================================
// MODUŁ KLIENTA (USŁUGI I REZERWACJE)
// ==========================================
app.get('/api/services', async (req, res) => {
  try {
    const services = await prisma.washService.findMany();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania usług' });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const { token, washServiceId, date } = req.body;
    if (!token || !washServiceId || !date) return res.status(400).json({ error: 'Brakujące dane rezerwacji!' });

    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
    await prisma.reservation.create({
      data: { customerId: decoded.id, washServiceId: Number(washServiceId), date: new Date(date), status: 'Oczekująca' }
    });

    res.status(201).json({ message: 'Rezerwacja potwierdzona i zapisana w bazie!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas rezerwacji. Zaloguj się ponownie.' });
  }
});

app.get('/api/my-reservations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ error: 'Brak poprawnego tokena!' });

    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
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

// ==========================================
// MODUŁ KASJERA (POS) I SPRZEDAŻY
// ==========================================
app.get('/api/fuels', async (req, res) => {
  try {
    const fuels = await prisma.fuel.findMany();
    res.json(fuels);
  } catch (error) {
    res.status(500).json({ error: 'Błąd pobierania paliw' });
  }
});

app.get('/api/employee/customer/:identifier', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;

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

app.post('/api/transactions/fuel', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Brak poprawnego tokena!' });
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;

    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień kasjera!' });

    const { fuelId, quantity, customerEmail, paymentMethod, issueInvoice } = req.body;
    if (!fuelId || !quantity || !paymentMethod) return res.status(400).json({ error: 'Brakujące dane transakcji!' });

    const fuel = await prisma.fuel.findUnique({ where: { id: Number(fuelId) } });
    if (!fuel) return res.status(404).json({ error: 'Paliwo nie znalezione!' });
    if (fuel.tankLevel < quantity) return res.status(400).json({ error: 'Brak wystarczającej ilości paliwa w zbiorniku!' });

    let customer = null;
    if (customerEmail) {
      customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
      if (!customer) return res.status(404).json({ error: 'Nie znaleziono klienta o podanym e-mailu!' });
    }

    let totalAmount = fuel.pricePerLiter * quantity;
    let pointsEarned = 0;
    let pointsDeducted = 0;

    if (paymentMethod === 'Punkty') {
        if (!customer) return res.status(400).json({ error: 'Płacenie punktami wymaga podania e-maila zarejestrowanego klienta!' });
        const pointsNeeded = fuel.type === 'LPG' ? Math.floor(quantity) * 50 : Math.floor(quantity) * 100;
        if (customer.loyaltyPoints < pointsNeeded) {
            return res.status(400).json({ error: `Za mało punktów! Potrzeba ${pointsNeeded} pkt, klient ma ${customer.loyaltyPoints} pkt.` });
        }
        pointsDeducted = pointsNeeded;
        totalAmount = 0; 
        await prisma.customer.update({ where: { id: customer.id }, data: { loyaltyPoints: { decrement: pointsDeducted } } });
    } else {
        if (customer) {
          const loyalty = await prisma.loyaltyProgram.findFirst();
          if (loyalty) {
            pointsEarned = fuel.type === 'LPG' ? Math.floor(quantity) * loyalty.pointsPerLpg : Math.floor(quantity) * loyalty.pointsPerE95;
            await prisma.customer.update({ where: { id: customer.id }, data: { loyaltyPoints: { increment: pointsEarned } } });
          }
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
          create: [{ product: `Paliwo ${fuel.type}`, quantity: Number(quantity), unitPrice: fuel.pricePerLiter, value: totalAmount }]
        }
      }
    });

    let documentMsg = ' Drukowanie paragonu...'; 
    if (issueInvoice && customer && totalAmount > 0) {
        await prisma.invoice.create({
            data: { customerId: customer.id, transactionId: transaction.id, number: `FV/${new Date().getFullYear()}/${transaction.id}`, amount: totalAmount }
        });
        documentMsg = ' Wystawiono Fakturę VAT.'; 
    } else if (issueInvoice && !customer) {
        return res.status(400).json({ error: 'Aby wystawić fakturę, podaj e-mail zarejestrowanego klienta!' });
    }

    await prisma.fuel.update({ where: { id: fuel.id }, data: { tankLevel: { decrement: Number(quantity) } } });

    if (paymentMethod === 'Punkty') {
         res.status(201).json({ message: `Opłacono punktami! Pobrano ${pointsDeducted} pkt.${documentMsg}` });
    } else {
         res.status(201).json({ message: `Sprzedano: ${totalAmount.toFixed(2)} zł. ${pointsEarned > 0 ? `Klient zyskał ${pointsEarned} pkt! ` : ''}${documentMsg}` });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd podczas transakcji.' });
  }
});

// ==========================================
// MODUŁ PRACOWNIKA (ZARZĄDZANIE MYJNIĄ)
// ==========================================
app.get('/api/employee/reservations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
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

app.patch('/api/employee/reservations/:id/complete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień!' });

    await prisma.reservation.update({ where: { id: Number(req.params.id) }, data: { status: 'Zakończona' } });
    res.status(200).json({ message: 'Rezerwacja oznaczona jako zakończona!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd aktualizacji statusu.' });
  }
});

// ==========================================
// MODUŁ MONITORINGU (Czujniki i Alerty)
// ==========================================
app.get('/api/monitoring', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;

    if (decoded.role !== 'employee' && decoded.role !== 'owner') {
      return res.status(403).json({ error: 'Brak uprawnień!' });
    }

    const alerts: string[] = [];
    
    // 1. Paliwa i obliczanie procentów
    const fuels = await prisma.fuel.findMany();
    const fuelStatus = fuels.map(f => {
      const percentage = (f.tankLevel / f.maxLevel) * 100;
      if (percentage < 20) { // Alarm gdy poniżej 20%
        alerts.push(`Krytycznie niski poziom paliwa ${f.type} (${percentage.toFixed(1)}%). Zleć dostawę!\n[Wysłano powiadomienie SMS i E-mail]`);
      }
      return { ...f, percentage: percentage.toFixed(1) };
    });

    // 2. Symulacja stacji LPG (generujemy wartości w locie)
    const lpgPressure = (Math.random() * (15 - 9) + 9).toFixed(2); // Od 9 do 15 bar
    const lpgTemp = (Math.random() * (20 - 5) + 5).toFixed(1); // Od 5 do 20 stopni
    if (Number(lpgPressure) > 14) {
      alerts.push(`Zbyt wysokie ciśnienie zbiornika LPG: ${lpgPressure} bar!\n[Wysłano powiadomienie SMS i E-mail]`);
    }

    // 3. Symulacja kamer myjni (2 stanowiska)
    const carWashStatus = [
      { bay: 1, occupied: Math.random() > 0.5, camera: Math.random() > 0.1 ? 'Działa' : 'Błąd sygnału' },
      { bay: 2, occupied: Math.random() > 0.5, camera: Math.random() > 0.1 ? 'Działa' : 'Błąd sygnału' }
    ];
    
    carWashStatus.forEach(bay => {
        if (bay.camera !== 'Działa') {
            alerts.push(` Przerwa w transmisji wideo! Sprawdź kamerę na stanowisku nr ${bay.bay}.\n[Wysłano powiadomienie SMS i E-mail]`);
        }
    });

    res.json({ fuels: fuelStatus, lpg: { pressure: lpgPressure, temp: lpgTemp }, carWash: carWashStatus, alerts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd pobierania danych monitoringu.' });
  }
});

// ==========================================
// MODUŁ WŁAŚCICIELA 
// ==========================================
app.get('/api/owner/employees', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
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

app.post('/api/owner/employees', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
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

app.delete('/api/owner/employees/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
    if (decoded.role !== 'owner') return res.status(403).json({ error: 'Brak uprawnień!' });

    await prisma.employee.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Pracownik został usunięty.' });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas usuwania pracownika.' });
  }
});

app.get('/api/owner/customers', async (req, res) => {
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

// --- GENEROWANIE RAPORTÓW ---
// ==========================================
// MODUŁ RAPORTÓW WŁAŚCICIELA
// ==========================================
app.get('/api/owner/reports', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;

    if (decoded.role !== 'owner') return res.status(403).json({ error: 'Brak uprawnień!' });

    // 1. Obliczanie całkowitego utargu ze wszystkich transakcji
    const revenueStats = await prisma.transaction.aggregate({
      _sum: { totalAmount: true }
    });

    // 2. Liczba wszystkich transakcji
    const transactionCount = await prisma.transaction.count();

    // 3. Pobranie 15 ostatnich transakcji z imionami klienta i pracownika
    const recentTransactions = await prisma.transaction.findMany({
      take: 15,
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

app.get('/api/owner/deliveries', async (req, res) => {
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

app.post('/api/owner/deliveries', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
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

app.patch('/api/owner/deliveries/:id/complete', async (req, res) => {
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

app.patch('/api/owner/fuels/:id/price', async (req, res) => {
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

// START SERWERA
app.listen(PORT, () => {
  console.log(`🚀 Serwer uruchomiony pod adresem: http://localhost:${PORT}`);
});