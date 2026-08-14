import { validateEnv } from './env.schema';

const DATABASE_URL = 'postgresql://tutanak:tutanak@localhost:5432/tutanak';
const JWT_SECRET = 'yerel-gelistirme-icin-yeterince-uzun-anahtar';

/** Obje depolama anahtarlari yerel MinIO varsayilanlaridir; gercek sir degildir. */
const STORAGE_ENV = {
  R2_ENDPOINT: 'http://localhost:9000',
  R2_BUCKET: 'tutanak-photos',
  R2_ACCESS_KEY_ID: 'minioadmin',
  R2_SECRET_ACCESS_KEY: 'minioadmin',
};

// Zorunlu anahtarlarin en kucuk kumesi (T-012 abonelik + T-006 depolama + T-008 e-posta ile buyudu).
const REQUIRED_ENV = {
  DATABASE_URL,
  JWT_SECRET,
  SUBSCRIPTION_PRICE_AMOUNT: '199.00',
  PUBLIC_APP_URL: 'http://localhost:5173',
  EMAIL_FROM: 'Tutanak <noreply@ornek.test>',
  ...STORAGE_ENV,
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
      PHOTO_MAX_BYTES: 10_485_760,
      PHOTO_MAX_PER_REPORT: 30,
      PRESIGNED_URL_TTL_SECONDS: 900,
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

  it('fotograf sayisal ayarlarini metinden tam sayiya cevirir (T-006)', () => {
    const parsed = validateEnv({
      ...VALID_ENV,
      PHOTO_MAX_BYTES: '2048',
      PHOTO_MAX_PER_REPORT: '5',
    });

    expect(parsed.PHOTO_MAX_BYTES).toBe(2048);
    expect(parsed.PHOTO_MAX_PER_REPORT).toBe(5);
  });

  it('pozitif olmayan fotograf ayarini reddeder (uygulama acilmaz)', () => {
    expect(() => validateEnv({ ...VALID_ENV, PHOTO_MAX_PER_REPORT: '0' })).toThrow(
      /PHOTO_MAX_PER_REPORT/,
    );
    expect(() => validateEnv({ ...VALID_ENV, PHOTO_MAX_BYTES: 'buyuk' })).toThrow(
      /PHOTO_MAX_BYTES/,
    );
  });

  it('obje depolama sirlari eksikse uygulama acilmasin diye hata firlatir (T-006)', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL,
        JWT_SECRET,
        SUBSCRIPTION_PRICE_AMOUNT: '199.00',
        PUBLIC_APP_URL: 'http://localhost:5173',
      }),
    ).toThrow(/R2_ENDPOINT/);
  });

  it('gecersiz bicimli R2_ENDPOINT degerini reddeder', () => {
    expect(() => validateEnv({ ...VALID_ENV, R2_ENDPOINT: 'localhost:9000' })).toThrow(
      /R2_ENDPOINT/,
    );
  });

  // T-006 QA iadesi: on-imzali URL tarayicida acilir; ic ag adresiyle (http://minio:9000)
  // imzalanan URL cozulemez. Tarayiciya donen adres ayri anahtardan gelir.
  describe('R2_PUBLIC_ENDPOINT (tarayiciya donen on-imzali URL adresi)', () => {
    it('anahtar verilmediginde R2_ENDPOINT degerine duser (tek adresli kurulum)', () => {
      expect(validateEnv(REQUIRED_ENV)).toMatchObject({
        R2_PUBLIC_ENDPOINT: STORAGE_ENV.R2_ENDPOINT,
      });
    });

    it('verildiginde R2_ENDPOINT"ten bagimsiz olarak korunur (docker: ic ad vs. host adresi)', () => {
      expect(
        validateEnv({
          ...REQUIRED_ENV,
          R2_ENDPOINT: 'http://minio:9000',
          R2_PUBLIC_ENDPOINT: 'http://localhost:9000',
        }),
      ).toMatchObject({
        R2_ENDPOINT: 'http://minio:9000',
        R2_PUBLIC_ENDPOINT: 'http://localhost:9000',
      });
    });

    it('gecersiz bicimli degeri reddeder (S3 istemcisi mutlak http(s) adresi ister)', () => {
      expect(() => validateEnv({ ...VALID_ENV, R2_PUBLIC_ENDPOINT: 'localhost:9000' })).toThrow(
        /R2_PUBLIC_ENDPOINT/,
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

  describe('T-008 e-posta yapilandirmasi', () => {
    it('EMAIL_FROM eksikse hata firlatir (gonderen adresi koda gomulmez, CLAUDE.md §5.1)', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, EMAIL_FROM: undefined })).toThrow(/EMAIL_FROM/);
    });

    it('EMAIL_FROM duz e-posta bicimini kabul eder', () => {
      expect(() =>
        validateEnv({ ...REQUIRED_ENV, EMAIL_FROM: 'noreply@ornek.test' }),
      ).not.toThrow();
    });

    it('EMAIL_FROM "Ad <adres@alan>" bicimini kabul eder', () => {
      expect(() =>
        validateEnv({ ...REQUIRED_ENV, EMAIL_FROM: 'Tutanak <noreply@ornek.test>' }),
      ).not.toThrow();
    });

    it('EMAIL_FROM iki bicime de uymayan degeri reddeder', () => {
      expect(() => validateEnv({ ...REQUIRED_ENV, EMAIL_FROM: 'gecersiz-adres' })).toThrow(
        /EMAIL_FROM/,
      );
      expect(() => validateEnv({ ...REQUIRED_ENV, EMAIL_FROM: 'Tutanak <adres-yok>' })).toThrow(
        /EMAIL_FROM/,
      );
    });

    it('RESEND_API_KEY yokken dogrulamayi gecer (yerel kosum dis hesapsiz, CLAUDE.md §10)', () => {
      expect(validateEnv(REQUIRED_ENV).RESEND_API_KEY).toBeUndefined();
    });

    it('RESEND_API_KEY bos metinse yok sayilir (.env.example bos deger tasir)', () => {
      expect(validateEnv({ ...REQUIRED_ENV, RESEND_API_KEY: '' }).RESEND_API_KEY).toBeUndefined();
    });

    it('RESEND_API_KEY doluysa aynen korunur', () => {
      expect(validateEnv({ ...REQUIRED_ENV, RESEND_API_KEY: 're_anahtar' }).RESEND_API_KEY).toBe(
        're_anahtar',
      );
    });
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
