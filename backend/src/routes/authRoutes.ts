import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { RegisterSchema, LoginSchema, StaffLoginSchema } from '../validators/auth.validators.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }

  const data = parsed.data;

  const existingUser = await prisma.customer.findUnique({ where: { email: data.email } });
  if (existingUser) {
    return res.status(400).json({ error: 'Użytkownik o podanym adresie e-mail już istnieje!' });
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  await prisma.$transaction(async (tx) => {
    if (data.accountType === 'individual') {
      const customer = await tx.customer.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          address: data.address,
          phone: data.phone,
          email: data.email,
          password: hashedPassword,
          registered: true,
        },
      });
      await tx.individualCustomer.create({
        data: { customerId: customer.id, pesel: data.pesel, nip: data.nip ?? null },
      });
    } else {
      const customer = await tx.customer.create({
        data: {
          firstName: data.companyName,
          lastName: '—',
          address: data.address,
          phone: data.phone,
          email: data.email,
          password: hashedPassword,
          registered: true,
        },
      });
      await tx.companyCustomer.create({
        data: {
          customerId: customer.id,
          companyName: data.companyName,
          nip: data.nip,
          regon: data.regon,
        },
      });
    }
  });

  res.status(201).json({ message: 'Rejestracja zakończona sukcesem!' });
});

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }

  const { email, password } = parsed.data;
  const user = await prisma.customer.findUnique({ where: { email } });
  if (!user?.password) return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło!' });

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło!' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'customer' },
    process.env.JWT_SECRET as string,
    { expiresIn: '2h' },
  );

  res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: 2 * 60 * 60 * 1000 });
  res.status(200).json({
    message: 'Zalogowano pomyślnie!',
    user: { firstName: user.firstName, lastName: user.lastName, role: 'customer' },
  });
});

router.post('/staff/login', async (req, res) => {
  const parsed = StaffLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Błędne dane.' });
  }

  const { login, password } = parsed.data;

  const owner = await prisma.owner.findUnique({ where: { login } });
  if (owner) {
    const isPasswordValid = await bcrypt.compare(password, owner.password);
    if (isPasswordValid) {
      const token = jwt.sign(
        { id: owner.id, login: owner.login, role: 'owner' },
        process.env.JWT_SECRET as string,
        { expiresIn: '8h' },
      );
      res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: 8 * 60 * 60 * 1000 });
      return res.status(200).json({
        message: 'Zalogowano do panelu Właściciela!',
        user: { firstName: owner.firstName, lastName: owner.lastName, role: 'owner' },
      });
    }
  }

  const employee = await prisma.employee.findUnique({ where: { login } });
  if (employee) {
    if (!employee.isActive) {
      return res
        .status(403)
        .json({ error: 'To konto pracownika jest archiwalne i nie może się logować.' });
    }
    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (isPasswordValid) {
      const token = jwt.sign(
        { id: employee.id, login: employee.login, role: 'employee' },
        process.env.JWT_SECRET as string,
        { expiresIn: '8h' },
      );
      res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: 8 * 60 * 60 * 1000 });
      return res.status(200).json({
        message: 'Zalogowano do panelu Pracownika!',
        user: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          role: 'employee',
          jobRole: employee.role,
        },
      });
    }
  }

  return res.status(401).json({ error: 'Nieprawidłowy login lub hasło!' });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Wylogowano pomyślnie.' });
});

router.get('/me', authenticate, async (req, res) => {
  const { id, role } = req.user!;

  if (role === 'owner') {
    const owner = await prisma.owner.findUnique({
      where: { id },
      select: { firstName: true, lastName: true },
    });
    if (!owner) return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
    return res.json({ ...owner, role: 'owner' });
  }

  if (role === 'employee') {
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, role: true, isActive: true },
    });
    if (!employee?.isActive) return res.status(404).json({ error: 'Nie znaleziono pracownika.' });
    return res.json({
      firstName: employee.firstName,
      lastName: employee.lastName,
      role: 'employee',
      jobRole: employee.role,
    });
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, loyaltyPoints: true },
  });
  if (!customer) return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
  return res.json({ ...customer, role: 'customer' });
});

export default router;
