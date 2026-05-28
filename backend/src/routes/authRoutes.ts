import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS_REGEX = /^\d+$/;
const NAME_REGEX = /^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\s-]+$/;

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

    const normalizedAccountType = (accountType || '').trim();
    const normalizedFirstName = (firstName || '').trim();
    const normalizedLastName = (lastName || '').trim();
    const normalizedCompanyName = (companyName || '').trim();
    const normalizedAddress = (address || '').trim();
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    const normalizedEmail = (email || '').trim();
    const normalizedPassword = (password || '').trim();
    const normalizedPesel = (pesel || '').trim();
    const normalizedNip = (nip || '').trim();
    const normalizedRegon = (regon || '').trim();

    if (!normalizedAccountType || !normalizedAddress || !normalizedPhone || !normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ error: 'Wypełnij wszystkie wymagane pola!' });
    }

    if (normalizedAccountType !== 'individual' && normalizedAccountType !== 'company') {
      return res.status(400).json({ error: 'Nieprawidłowy typ konta.' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Podaj poprawny adres e-mail (musi zawierać znak @).' });
    }
    if (!DIGITS_REGEX.test(normalizedPhone) || normalizedPhone.length !== 9) {
      return res.status(400).json({ error: 'Numer telefonu musi mieć dokładnie 9 cyfr.' });
    }
    if (normalizedAddress.length < 6) {
      return res.status(400).json({ error: 'Adres jest zbyt krótki (minimum 6 znaków).' });
    }
    if (normalizedPassword.length < 6) {
      return res.status(400).json({ error: 'Hasło musi mieć minimum 6 znaków.' });
    }

    if (normalizedAccountType === 'individual') {
      if (!normalizedFirstName || !normalizedLastName || !normalizedPesel) {
        return res.status(400).json({ error: 'Dla osoby fizycznej podaj imię, nazwisko i PESEL.' });
      }
      if (!NAME_REGEX.test(normalizedFirstName) || !NAME_REGEX.test(normalizedLastName)) {
        return res.status(400).json({ error: 'Imię i nazwisko mogą zawierać wyłącznie litery.' });
      }
      if (!DIGITS_REGEX.test(normalizedPesel) || normalizedPesel.length !== 11) {
        return res.status(400).json({ error: 'PESEL musi mieć dokładnie 11 cyfr.' });
      }
      if (normalizedNip && (!DIGITS_REGEX.test(normalizedNip) || normalizedNip.length !== 10)) {
        return res.status(400).json({ error: 'NIP musi mieć dokładnie 10 cyfr.' });
      }
    } else {
      if (!normalizedCompanyName || !normalizedNip || !normalizedRegon) {
        return res.status(400).json({ error: 'Dla firmy podaj nazwę firmy, NIP i REGON.' });
      }
      if (normalizedCompanyName.length < 3) {
        return res.status(400).json({ error: 'Nazwa firmy musi mieć minimum 3 znaki.' });
      }
      if (!DIGITS_REGEX.test(normalizedNip) || normalizedNip.length !== 10) {
        return res.status(400).json({ error: 'NIP musi mieć dokładnie 10 cyfr.' });
      }
      if (!DIGITS_REGEX.test(normalizedRegon) || (normalizedRegon.length !== 9 && normalizedRegon.length !== 14)) {
        return res.status(400).json({ error: 'REGON musi mieć 9 albo 14 cyfr.' });
      }
    }

    const existingUser = await prisma.customer.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik o podanym adresie e-mail już istnieje!' });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    const customerFirstName =
      normalizedAccountType === 'company' ? normalizedCompanyName : normalizedFirstName;
    const customerLastName =
      normalizedAccountType === 'company' ? '—' : normalizedLastName;

    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          firstName: customerFirstName,
          lastName: customerLastName,
          address: normalizedAddress,
          phone: normalizedPhone,
          email: normalizedEmail,
          password: hashedPassword,
          registered: true,
        },
      });

      if (normalizedAccountType === 'individual') {
        await tx.individualCustomer.create({
          data: {
            customerId: customer.id,
            pesel: normalizedPesel,
            nip: normalizedNip || null,
          },
        });
      } else {
        await tx.companyCustomer.create({
          data: {
            customerId: customer.id,
            companyName: normalizedCompanyName,
            nip: normalizedNip,
            regon: normalizedRegon,
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