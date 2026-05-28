import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

const router = Router();

// ==========================================
// AUTORYZACJA KLIENTA
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const {
      accountType,
      firstName,
      lastName,
      companyName,
      address,
      phone,
      email,
      password,
      pesel,
      nip,
      regon,
    } = req.body as {
      accountType?: string;
      firstName?: string;
      lastName?: string;
      companyName?: string;
      address?: string;
      phone?: string;
      email?: string;
      password?: string;
      pesel?: string;
      nip?: string;
      regon?: string;
    };

    if (!accountType || !address || !phone || !email || !password) {
      return res.status(400).json({ error: 'Wypełnij wszystkie wymagane pola!' });
    }

    if (accountType !== 'individual' && accountType !== 'company') {
      return res.status(400).json({ error: 'Nieprawidłowy typ konta.' });
    }

    if (accountType === 'individual') {
      if (!firstName || !lastName || !pesel) {
        return res.status(400).json({ error: 'Dla osoby fizycznej podaj imię, nazwisko i PESEL.' });
      }
    } else {
      if (!companyName || !nip || !regon) {
        return res.status(400).json({ error: 'Dla firmy podaj nazwę firmy, NIP i REGON.' });
      }
    }

    const existingUser = await prisma.customer.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik o podanym adresie e-mail już istnieje!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const customerFirstName =
      accountType === 'company' ? companyName!.trim() : firstName!.trim();
    const customerLastName =
      accountType === 'company' ? '—' : lastName!.trim();

    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          firstName: customerFirstName,
          lastName: customerLastName,
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password: hashedPassword,
          registered: true,
        },
      });

      if (accountType === 'individual') {
        await tx.individualCustomer.create({
          data: {
            customerId: customer.id,
            pesel: pesel!.trim(),
            nip: nip?.trim() || null,
          },
        });
      } else {
        await tx.companyCustomer.create({
          data: {
            customerId: customer.id,
            companyName: companyName!.trim(),
            nip: nip!.trim(),
            regon: regon!.trim(),
          },
        });
      }
    });

    res.status(201).json({ message: 'Rejestracja zakończona sukcesem!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd serwera podczas rejestracji.' });
  }
});

router.post('/login', async (req, res) => {
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
router.post('/staff/login', async (req, res) => {
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
      if (!employee.isActive) {
        return res.status(403).json({ error: 'To konto pracownika jest archiwalne i nie może się logować.' });
      }
      const isPasswordValid = await bcrypt.compare(password, employee.password);
      if (isPasswordValid) {
        const token = jwt.sign(
          { id: employee.id, login: employee.login, role: 'employee' },
          process.env.JWT_SECRET as string,
          { expiresIn: '8h' }
        );
        return res.status(200).json({ message: 'Zalogowano do panelu Pracownika!', token, user: { firstName: employee.firstName, role: 'employee', jobRole: employee.role } });
      }
    }

    return res.status(401).json({ error: 'Nieprawidłowy login lub hasło!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Błąd logowania służbowego.' });
  }
});

export default router;