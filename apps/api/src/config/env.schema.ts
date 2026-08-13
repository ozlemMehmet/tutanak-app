// Ortam degiskenleri SADECE burada okunur ve dogrulanir (CLAUDE.md §5).
// Eksik/gecersiz deger varsa uygulama acilmaz; hata mesajina degerin kendisi YAZILMAZ.
// Anahtarlar `.env.example` ile birebir aynidir; listede olmayan anahtar kodda okunamaz.

import { z } from 'zod';

const MIN_JWT_SECRET_LENGTH = 16;
const CURRENCY_CODE_LENGTH = 3;

// Hiz siniri varsayilanlari architecture.md §7 tablosundan gelir; `.env.example` ile aynidir.
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 300;
const DEFAULT_AUTH_RATE_LIMIT_MAX_REQUESTS = 5;

/** Ortam degiskenleri metin olarak gelir; pozitif tam sayiya cevrilir (deger loglanmaz). */
const positiveIntFromEnv = (defaultValue: number): z.ZodDefault<z.ZodNumber> =>
  z.coerce.number().int().positive().default(defaultValue);

export const envSchema = z.object({
  /** Postgres baglanti adresi (CLAUDE.md §5 sir listesi). */
  DATABASE_URL: z.string().min(1),
  /** JWT imzalama anahtari (CLAUDE.md §5 sir listesi). */
  JWT_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),
  /** Erisim tokeni omru (CLAUDE.md §5.1, varsayilan 7d). */
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  /** GET /me varsayilan abonelik yanitinin para birimi (CLAUDE.md §3.11, §5.1). */
  SUBSCRIPTION_CURRENCY: z.string().length(CURRENCY_CODE_LENGTH).default('TRY'),
  /** Hiz siniri sayacinin sifirlandigi pencere, saniye (T-014, architecture.md §7). */
  RATE_LIMIT_WINDOW_SECONDS: positiveIntFromEnv(DEFAULT_RATE_LIMIT_WINDOW_SECONDS),
  /** Pencere basina genel istek ust siniri (endpoint + IP basina). */
  RATE_LIMIT_MAX_REQUESTS: positiveIntFromEnv(DEFAULT_RATE_LIMIT_MAX_REQUESTS),
  /** Kimlik uclari (`/auth/register`, `/auth/login`) icin sikilastirilmis ust sinir. */
  AUTH_RATE_LIMIT_MAX_REQUESTS: positiveIntFromEnv(DEFAULT_AUTH_RATE_LIMIT_MAX_REQUESTS),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * process.env'i dogrular. Semada olmayan anahtarlar yok sayilir (process.env'de
 * isletim sistemi degiskenleri de bulunur), tanimli anahtarlar tip guvenli doner.
 */
export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    // Yalnizca anahtar adi + kural ihlali raporlanir; deger loglanmaz (CLAUDE.md §4.3, §5).
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.')} (${issue.message})`)
      .join(', ');
    throw new Error(`Ortam degiskenleri gecersiz: ${problems}`);
  }
  return parsed.data;
}
