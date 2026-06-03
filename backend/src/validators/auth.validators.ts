import { z } from 'zod';

const EMAIL = z
  .string()
  .trim()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Podaj poprawny adres e-mail (musi zawierać znak @).');

const PHONE = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 9, 'Numer telefonu musi mieć dokładnie 9 cyfr.');

const PASSWORD = z.string().min(8, 'Hasło musi mieć minimum 8 znaków.');

const ADDRESS = z.string().trim().min(6, 'Adres jest zbyt krótki (minimum 6 znaków).');

const NAME_PART = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\s-]+$/,
    'Imię i nazwisko mogą zawierać wyłącznie litery.',
  );

const OPTIONAL_NIP = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || undefined : v),
  z
    .string()
    .regex(/^\d{10}$/, 'NIP musi mieć dokładnie 10 cyfr.')
    .optional(),
);

const IndividualSchema = z.object({
  accountType: z.literal('individual'),
  firstName: NAME_PART,
  lastName: NAME_PART,
  address: ADDRESS,
  phone: PHONE,
  email: EMAIL,
  password: PASSWORD,
  pesel: z.string().regex(/^\d{11}$/, 'PESEL musi mieć dokładnie 11 cyfr.'),
  nip: OPTIONAL_NIP,
  regon: z.string().optional(),
  companyName: z.string().optional(),
});

const CompanySchema = z.object({
  accountType: z.literal('company'),
  companyName: z.string().trim().min(3, 'Nazwa firmy musi mieć minimum 3 znaki.'),
  address: ADDRESS,
  phone: PHONE,
  email: EMAIL,
  password: PASSWORD,
  nip: z.string().regex(/^\d{10}$/, 'NIP musi mieć dokładnie 10 cyfr.'),
  regon: z.string().regex(/^\d{9}$|^\d{14}$/, 'REGON musi mieć 9 albo 14 cyfr.'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  pesel: z.string().optional(),
});

export const RegisterSchema = z.discriminatedUnion('accountType', [
  IndividualSchema,
  CompanySchema,
]);

export const LoginSchema = z.object({
  email: z.string().min(1, 'Podaj adres e-mail i hasło!'),
  password: z.string().min(1, 'Podaj adres e-mail i hasło!'),
});

export const StaffLoginSchema = z.object({
  login: z.string().min(1, 'Podaj login i hasło!'),
  password: z.string().min(1, 'Podaj login i hasło!'),
});
