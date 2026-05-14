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
// MODUŁ KASJERA (POS) I SPRZEDAŻY
// ==========================================
router.get('/fuels', async (req, res) => {
  try {
    const fuels = await prisma.fuel.findMany();
    res.json(fuels);
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

    const alerts: string[] = [];
    
    const fuels = await prisma.fuel.findMany();
    const fuelStatus = fuels.map(f => {
      const percentage = (f.tankLevel / f.maxLevel) * 100;
      if (percentage < 20) {
        alerts.push(`Krytycznie niski poziom paliwa ${f.type} (${percentage.toFixed(1)}%). Zleć dostawę!\n[Wysłano powiadomienie SMS i E-mail]`);
      }
      return { ...f, percentage: percentage.toFixed(1) };
    });

    const lpgPressure = (Math.random() * (15 - 9) + 9).toFixed(2);
    const lpgTemp = (Math.random() * (20 - 5) + 5).toFixed(1);
    if (Number(lpgPressure) > 14) {
      alerts.push(`Zbyt wysokie ciśnienie zbiornika LPG: ${lpgPressure} bar!\n[Wysłano powiadomienie SMS i E-mail]`);
    }

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

export default router;