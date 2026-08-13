// Ortam degiskenleri SADECE burada okunur ve dogrulanir (CLAUDE.md §5).
// Eksik/gecersiz deger varsa uygulama acilmaz; hata mesajina degerin kendisi YAZILMAZ.
// Anahtarlar `.env.example` ile birebir aynidir; listede olmayan anahtar kodda okunamaz.

import { z } from 'zod';

const MIN_JWT_SECRET_LENGTH = 16;
const CURRENCY_CODE_LENGTH = 3;
const DEFAULT_SUBSCRIPTION_PERIOD_DAYS = 30;
/** Para degeri ondalikli METIN olarak tasinir; float'a cevrilmez (CLAUDE.md §5.1). */
const MONEY_AMOUNT_PATTERN = /^\d+\.\d{2}$/;

// Hiz siniri varsayilanlari architecture.md §7 tablosundan gelir; `.env.example` ile aynidir.
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 300;
const DEFAULT_AUTH_RATE_LIMIT_MAX_REQUESTS = 5;

/** Ortam degiskenleri metin olarak gelir; pozitif tam sayiya cevrilir (deger loglanmaz). */
const positiveIntFromEnv = (defaultValue: number): z.ZodDefault<z.ZodNumber> =>
  z.coerce.number().int().positive().default(defaultValue);

const ALLOWED_APP_URL_PROTOCOLS = new Set(['http:', 'https:']);

/** PAYMENT_PROVIDER=iyzico secildiginde zorunlu hale gelen sirlar (CLAUDE.md §5). */
const IYZICO_SECRET_KEYS = [
  'IYZICO_API_KEY',
  'IYZICO_SECRET_KEY',
  'IYZICO_WEBHOOK_SECRET',
] as const;

const envObjectSchema = z.object({
  /** Postgres baglanti adresi (CLAUDE.md §5 sir listesi). */
  DATABASE_URL: z.string().min(1),
  /** JWT imzalama anahtari (CLAUDE.md §5 sir listesi). */
  JWT_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),
  /** Erisim tokeni omru (CLAUDE.md §5.1, varsayilan 7d). */
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  /** Abonelik tutari — numeric(12,2) sutunlarina birebir yazilan METIN (CLAUDE.md §5.1). */
  SUBSCRIPTION_PRICE_AMOUNT: z.string().regex(MONEY_AMOUNT_PATTERN),
  /** GET /me varsayilan abonelik yanitinin para birimi (CLAUDE.md §3.11, §5.1). */
  SUBSCRIPTION_CURRENCY: z.string().length(CURRENCY_CODE_LENGTH).default('TRY'),
  /** Hiz siniri sayacinin sifirlandigi pencere, saniye (T-014, architecture.md §7). */
  RATE_LIMIT_WINDOW_SECONDS: positiveIntFromEnv(DEFAULT_RATE_LIMIT_WINDOW_SECONDS),
  /** Pencere basina genel istek ust siniri (endpoint + IP basina). */
  RATE_LIMIT_MAX_REQUESTS: positiveIntFromEnv(DEFAULT_RATE_LIMIT_MAX_REQUESTS),
  /** Kimlik uclari (`/auth/register`, `/auth/login`) icin sikilastirilmis ust sinir. */
  AUTH_RATE_LIMIT_MAX_REQUESTS: positiveIntFromEnv(DEFAULT_AUTH_RATE_LIMIT_MAX_REQUESTS),
  /** Abonelik donem uzunlugu; current_period_end SUNUCUDA bundan hesaplanir (CLAUDE.md §5.1). */
  SUBSCRIPTION_PERIOD_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_SUBSCRIPTION_PERIOD_DAYS),
  /** Hangi PaymentPort adapter'inin baglanacagi (CLAUDE.md §5.1). */
  PAYMENT_PROVIDER: z.enum(['iyzico', 'fake']).default('fake'),
  /**
   * Uygulamanin genel adresi; odeme sonrasi donus adresinin tabani (CLAUDE.md §5.1).
   * `z.url()` sema disi protokolleri (`localhost:5173`) de gecirdigi icin http/https sarti
   * ayrica aranir — donus adresi buradan tureyecegi icin bicim hatasi acilista yakalanmalidir.
   */
  PUBLIC_APP_URL: z
    .string()
    .url()
    .refine((value) => ALLOWED_APP_URL_PROTOCOLS.has(new URL(value).protocol), {
      message: 'http veya https ile baslayan mutlak bir adres olmalidir',
    }),
  /** iyzico sirlari — yalnizca PAYMENT_PROVIDER=iyzico iken zorunludur (CLAUDE.md §5). */
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_WEBHOOK_SECRET: z.string().optional(),
});

export const envSchema = envObjectSchema.superRefine((env, ctx) => {
  if (env.PAYMENT_PROVIDER !== 'iyzico') {
    // Yerel/test kosumu dis hesap gerektirmez (CLAUDE.md §10).
    return;
  }
  for (const key of IYZICO_SECRET_KEYS) {
    if (env[key] === undefined || env[key] === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'PAYMENT_PROVIDER=iyzico iken zorunludur',
      });
    }
  }
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
