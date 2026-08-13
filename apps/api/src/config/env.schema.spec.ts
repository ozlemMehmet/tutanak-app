import { validateEnv } from './env.schema';

const DATABASE_URL = 'postgresql://tutanak:tutanak@localhost:5432/tutanak';
const JWT_SECRET = 'yerel-gelistirme-icin-yeterince-uzun-anahtar';

// Zorunlu anahtarlarin en kucuk kumesi (T-012 ile abonelik yapilandirmasi eklendi).
const REQUIRED_ENV = {
  DATABASE_URL,
  JWT_SECRET,
  SUBSCRIPTION_PRICE_AMOUNT: '199.00',
  PUBLIC_APP_URL: 'http://localhost:5173',
};

const VALID_ENV = {
  ...REQUIRED_ENV,
  JWT_EXPIRES_IN: '7d',
  SUBSCRIPTION_CURRENCY: 'TRY',
  PAYMENT_PROVIDER: 'fake',
};

describe('validateEnv', () => {
  it('gecerli ortam degiskenlerini dogrulanmis nesneye cevirir', () => {
    expect(validateEnv(VALID_ENV)).toMatchObject(VALID_ENV);
  });

  it('istege bagli anahtarlar yoksa .env.example ile ayni varsayilanlari uygular', () => {
    expect(validateEnv(REQUIRED_ENV)).toMatchObject({
      JWT_EXPIRES_IN: '7d',
      SUBSCRIPTION_CURRENCY: 'TRY',
      SUBSCRIPTION_PERIOD_DAYS: 30,
      PAYMENT_PROVIDER: 'fake',
    });
  });

  // T-014: hiz siniri degerleri koda gomulmez, env uzerinden gelir (CLAUDE.md §5.1).
  describe('hiz siniri anahtarlari', () => {
    it('anahtarlar yoksa architecture.md §7 tablosundaki varsayilanlari uygular', () => {
      expect(validateEnv({ ...REQUIRED_ENV })).toMatchObject({
        RATE_LIMIT_WINDOW_SECONDS: 60,
        RATE_LIMIT_MAX_REQUESTS: 300,
        AUTH_RATE_LIMIT_MAX_REQUESTS: 5,
      });
    });

    it('ortamdan metin olarak gelen degerleri sayiya cevirir', () => {
      expect(
        validateEnv({
          ...REQUIRED_ENV,
          RATE_LIMIT_WINDOW_SECONDS: '30',
          RATE_LIMIT_MAX_REQUESTS: '100',
          AUTH_RATE_LIMIT_MAX_REQUESTS: '3',
        }),
      ).toMatchObject({
        RATE_LIMIT_WINDOW_SECONDS: 30,
        RATE_LIMIT_MAX_REQUESTS: 100,
        AUTH_RATE_LIMIT_MAX_REQUESTS: 3,
      });
    });

    it('sifir limit degerini reddeder (hiz siniri kapatilamaz)', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, AUTH_RATE_LIMIT_MAX_REQUESTS: '0' })).toThrow(
        /AUTH_RATE_LIMIT_MAX_REQUESTS/,
      );
    });

    it('negatif pencere degerini reddeder', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, RATE_LIMIT_WINDOW_SECONDS: '-1' })).toThrow(
        /RATE_LIMIT_WINDOW_SECONDS/,
      );
    });

    it('sayi olmayan limit degerini reddeder', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, RATE_LIMIT_MAX_REQUESTS: 'cok' })).toThrow(
        /RATE_LIMIT_MAX_REQUESTS/,
      );
    });

    it('ondalikli limit degerini reddeder', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, RATE_LIMIT_MAX_REQUESTS: '2.5' })).toThrow(
        /RATE_LIMIT_MAX_REQUESTS/,
      );
    });
  });

  it('JWT_SECRET eksikse uygulama acilmasin diye hata firlatir', () => {
    expect(() => validateEnv({ ...REQUIRED_ENV, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
  });

  it('DATABASE_URL eksikse hata firlatir', () => {
    expect(() => validateEnv({ ...REQUIRED_ENV, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('kisa JWT_SECRET degerini reddeder', () => {
    expect(() => validateEnv({ ...REQUIRED_ENV, JWT_SECRET: 'kisa' })).toThrow(/JWT_SECRET/);
  });

  it('hata mesajinda gecersiz degerin kendisini yazmaz (sir sizintisi olmasin)', () => {
    let message = '';
    try {
      validateEnv({ ...REQUIRED_ENV, JWT_SECRET: 'sir-degeri' });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain('sir-degeri');
  });

  it('bilinmeyen ortam degiskenlerini yok sayar (process.env tumuyle gelir)', () => {
    expect(() => validateEnv({ ...VALID_ENV, PATH: '/usr/bin', HOME: '/root' })).not.toThrow();
  });

  describe('T-012 abonelik yapilandirmasi', () => {
    it('SUBSCRIPTION_PRICE_AMOUNT eksikse hata firlatir (fiyat koda gomulmez)', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, SUBSCRIPTION_PRICE_AMOUNT: undefined })).toThrow(
        /SUBSCRIPTION_PRICE_AMOUNT/,
      );
    });

    it('SUBSCRIPTION_PRICE_AMOUNT ondalikli metin bicimine uymuyorsa reddeder', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, SUBSCRIPTION_PRICE_AMOUNT: '199' })).toThrow(
        /SUBSCRIPTION_PRICE_AMOUNT/,
      );
    });

    it('SUBSCRIPTION_PRICE_AMOUNT degerini METIN olarak birakir (float parse YOK)', () => {
      const env = validateEnv({ ...REQUIRED_ENV, SUBSCRIPTION_PRICE_AMOUNT: '1249.90' });

      expect(env.SUBSCRIPTION_PRICE_AMOUNT).toBe('1249.90');
    });

    it('SUBSCRIPTION_PERIOD_DAYS degerini pozitif tam sayiya cevirir', () => {
      expect(validateEnv({ ...REQUIRED_ENV, SUBSCRIPTION_PERIOD_DAYS: '45' })).toMatchObject({
        SUBSCRIPTION_PERIOD_DAYS: 45,
      });
    });

    it('SUBSCRIPTION_PERIOD_DAYS pozitif degilse reddeder', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, SUBSCRIPTION_PERIOD_DAYS: '0' })).toThrow(
        /SUBSCRIPTION_PERIOD_DAYS/,
      );
    });

    it('PUBLIC_APP_URL mutlak bir adres degilse reddeder', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, PUBLIC_APP_URL: 'localhost:5173' })).toThrow(
        /PUBLIC_APP_URL/,
      );
    });

    it('PAYMENT_PROVIDER yalnizca iyzico veya fake olabilir', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, PAYMENT_PROVIDER: 'stripe' })).toThrow(
        /PAYMENT_PROVIDER/,
      );
    });

    it('PAYMENT_PROVIDER=fake iken IYZICO_* sirlarini ISTEMEZ (yerel kosum dis hesapsiz)', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, PAYMENT_PROVIDER: 'fake' })).not.toThrow();
    });

    it('PAYMENT_PROVIDER=iyzico iken eksik IYZICO_* sirlarini anahtar adiyla raporlar', () => {
      let message = '';
      try {
        validateEnv({ ...REQUIRED_ENV, PAYMENT_PROVIDER: 'iyzico' });
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : '';
      }

      expect(message).toContain('IYZICO_API_KEY');
      expect(message).toContain('IYZICO_SECRET_KEY');
      expect(message).toContain('IYZICO_WEBHOOK_SECRET');
    });

    it('PAYMENT_PROVIDER=iyzico iken sirlar doluysa dogrulamayi gecer', () => {
      expect(() =>
        validateEnv({
          ...REQUIRED_ENV,
          PAYMENT_PROVIDER: 'iyzico',
          IYZICO_API_KEY: 'api-anahtari',
          IYZICO_SECRET_KEY: 'gizli-anahtar',
          IYZICO_WEBHOOK_SECRET: 'webhook-sirri',
        }),
      ).not.toThrow();
    });
  });
});
