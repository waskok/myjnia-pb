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

    // 1. Sprawdzamy, czy to Właściciel
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

    // 2. Jeśli to nie Właściciel, sprawdzamy Pracownika
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

    // 3. Brak konta / złe hasło
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

app.post('/api/transactions/fuel', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Brak autoryzacji!' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Brak poprawnego tokena!' });
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;

    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień kasjera!' });

    const { fuelId, quantity, customerEmail, paymentMethod } = req.body;
    if (!fuelId || !quantity || !paymentMethod) return res.status(400).json({ error: 'Brakujące dane transakcji!' });

    const fuel = await prisma.fuel.findUnique({ where: { id: Number(fuelId) } });
    if (!fuel) return res.status(404).json({ error: 'Paliwo nie znalezione!' });
    if (fuel.tankLevel < quantity) return res.status(400).json({ error: 'Brak wystarczającej ilości paliwa w zbiorniku!' });

    const totalAmount = fuel.pricePerLiter * quantity;
    let customer = null;
    let pointsEarned = 0;

    if (customerEmail) {
      customer = await prisma.customer.findUnique({ where: { email: customerEmail } });
      if (customer) {
        const loyalty = await prisma.loyaltyProgram.findFirst();
        if (loyalty) {
          if (fuel.type === 'LPG') pointsEarned = Math.floor(quantity) * loyalty.pointsPerLpg;
          else pointsEarned = Math.floor(quantity) * loyalty.pointsPerE95;

          await prisma.customer.update({
            where: { id: customer.id },
            data: { loyaltyPoints: { increment: pointsEarned } }
          });
        }
      }
    }

    await prisma.transaction.create({
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

    await prisma.fuel.update({
      where: { id: fuel.id },
      data: { tankLevel: { decrement: Number(quantity) } }
    });

    res.status(201).json({ message: `Sprzedano: ${totalAmount.toFixed(2)} zł. ${pointsEarned > 0 ? `Klient zyskał ${pointsEarned} pkt!` : ''}` });
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
    if (!token) return res.status(401).json({ error: 'Brak poprawnego tokena!' });

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
    if (!token) return res.status(401).json({ error: 'Brak poprawnego tokena!' });

    const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
    if (decoded.role !== 'employee') return res.status(403).json({ error: 'Brak uprawnień!' });

    await prisma.reservation.update({
      where: { id: Number(req.params.id) },
      data: { status: 'Zakończona' }
    });

    res.status(200).json({ message: 'Rezerwacja oznaczona jako zakończona!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd aktualizacji statusu.' });
  }
});

// ==========================================
// MODUŁ WŁAŚCICIELA (SZEFA)
// ==========================================
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
      data: {
        fuelId: Number(fuelId),
        ownerId: decoded.id,
        quantity: Number(quantity),
        supplier: supplier,
        deliveryDate: new Date(deliveryDate),
        status: 'Zlecona'
      }
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

    await prisma.fuel.update({
      where: { id: delivery.fuelId },
      data: { tankLevel: { increment: delivery.quantity } }
    });

    await prisma.fuelDelivery.update({
      where: { id },
      data: { status: 'Dostarczona' }
    });

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
    await prisma.fuel.update({
      where: { id: Number(req.params.id) },
      data: { pricePerLiter: Number(price) }
    });
    res.status(200).json({ message: 'Cena paliwa została zaktualizowana!' });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas aktualizacji ceny.' });
  }
});

// START SERWERA
app.listen(PORT, () => {
  console.log(`🚀 Serwer uruchomiony pod adresem: http://localhost:${PORT}`);
});