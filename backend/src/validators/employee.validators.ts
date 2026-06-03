import { z } from 'zod';

export const FuelTransactionSchema = z.object({
  fuelId: z.coerce.number().int().positive('Nieprawidłowe ID paliwa.'),
  quantity: z.coerce.number().positive('Podaj poprawną ilość litrów.'),
  customerEmail: z.string().trim().optional().or(z.literal('')),
  paymentMethod: z.enum(['Karta', 'Gotówka', 'Punkty'] as const, 'Nieprawidłowa metoda płatności.'),
  issueInvoice: z.boolean().optional().default(false),
});

export const MonitoringReadingsSchema = z.object({
  monitoringId: z.coerce.number().int().positive().optional().default(1),
  readings: z
    .array(
      z.object({
        tank: z.enum(['E95', 'E98', 'ON', 'LPG']),
        type: z.enum(['level', 'pressure', 'temperature', 'safety_valve']),
        value: z.coerce.number(),
        status: z.string().optional().default('OK'),
        timestamp: z.string().optional(),
      }),
    )
    .min(1, 'Brak danych odczytów.'),
});
