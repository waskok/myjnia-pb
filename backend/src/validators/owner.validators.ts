import { z } from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const AddEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, 'Podaj imię pracownika.'),
  lastName: z.string().trim().min(1, 'Podaj nazwisko pracownika.'),
  role: z.string().trim().min(1, 'Podaj rolę pracownika.'),
  login: z.string().trim().min(1, 'Podaj login pracownika.'),
  password: z.string().min(8, 'Hasło musi mieć minimum 8 znaków.'),
  email: z.string().trim().email('Podaj poprawny adres e-mail.').optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
});

export const UpdateEmployeeLoginSchema = z.object({
  login: z.string().trim().min(1, 'Login nie może być pusty.'),
});

export const UpdateEmployeePasswordSchema = z.object({
  password: z.string().min(8, 'Hasło musi mieć minimum 8 znaków.'),
});

export const DeliverySchema = z.object({
  fuelId: z.coerce.number().int().positive('Nieprawidłowe ID paliwa.'),
  quantity: z.coerce.number().positive('Ilość musi być dodatnia.'),
  supplier: z.string().trim().min(1, 'Podaj dostawcę.'),
  deliveryDate: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Nieprawidłowa data dostawy.'),
});

export const FuelPriceSchema = z.object({
  price: z.coerce.number().positive('Cena musi być dodatnią liczbą.'),
});

export const ServicePriceSchema = z.object({
  price: z.coerce.number().positive('Podaj poprawną cenę usługi.'),
});

export const ServiceLoyaltyPointsSchema = z.object({
  loyaltyPoints: z.coerce.number().int().min(0, 'Podaj poprawną, nieujemną liczbę punktów.'),
});

export const LoyaltyConfigSchema = z.object({
  pointsPerE95: z.coerce.number().int().min(0),
  pointsPerE98: z.coerce.number().int().min(0),
  pointsPerDiesel: z.coerce.number().int().min(0),
  pointsPerLpg: z.coerce.number().int().min(0),
  pointsPerStandardWash: z.coerce.number().int().min(0),
  pointsPerWaxWash: z.coerce.number().int().min(0),
  earnPointsPerE95: z.coerce.number().int().min(0),
  earnPointsPerE98: z.coerce.number().int().min(0),
  earnPointsPerDiesel: z.coerce.number().int().min(0),
  earnPointsPerLpg: z.coerce.number().int().min(0),
  earnPointsPerStandardWash: z.coerce.number().int().min(0),
  earnPointsPerWaxWash: z.coerce.number().int().min(0),
}).refine(
  (data) => Object.values(data).every((v) => Number.isFinite(v)),
  'Stawki punktów muszą być nieujemnymi liczbami całkowitymi.',
);

export const ScheduleCreateSchema = z.object({
  employeeId: z.coerce.number().int().positive('Nieprawidłowe ID pracownika.'),
  startTime: z
    .string()
    .regex(TIME_REGEX, 'Godzina rozpoczęcia musi być w formacie HH:mm (np. 08:00).'),
  endTime: z
    .string()
    .regex(TIME_REGEX, 'Godzina zakończenia musi być w formacie HH:mm (np. 16:00).'),
  dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Każda data musi być w formacie YYYY-MM-DD.'))
    .min(1, 'Wymagana co najmniej jedna data.'),
}).refine(
  (data) => {
    const [sh, sm] = data.startTime.split(':').map(Number);
    const [eh, em] = data.endTime.split(':').map(Number);
    return (eh ?? 0) * 60 + (em ?? 0) > (sh ?? 0) * 60 + (sm ?? 0);
  },
  'Godzina zakończenia musi być późniejsza niż rozpoczęcia.',
);
