import type { ZodType } from 'zod';

/** Pierwszy komunikat błędu walidacji Zod (do asercji w testach). */
export function firstZodError(schema: ZodType, data: unknown): string | undefined {
  const result = schema.safeParse(data);
  if (result.success) return undefined;
  return result.error.issues[0]?.message;
}

export function parseOk<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}
