import { validateEnv } from './env.schema';

const DATABASE_URL = 'postgresql://tutanak:tutanak@localhost:5432/tutanak';
const JWT_SECRET = 'yerel-gelistirme-icin-yeterince-uzun-anahtar';

const VALID_ENV = {
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN: '7d',
  SUBSCRIPTION_CURRENCY: 'TRY',
};

describe('validateEnv', () => {
  it('gecerli ortam degiskenlerini dogrulanmis nesneye cevirir', () => {
    expect(validateEnv(VALID_ENV)).toMatchObject(VALID_ENV);
  });

  it('istege bagli anahtarlar yoksa .env.example ile ayni varsayilanlari uygular', () => {
    expect(validateEnv({ DATABASE_URL, JWT_SECRET })).toMatchObject({
      JWT_EXPIRES_IN: '7d',
      SUBSCRIPTION_CURRENCY: 'TRY',
    });
  });

  // T-014: hiz siniri degerleri koda gomulmez, env uzerinden gelir (CLAUDE.md §5.1).
  describe('hiz siniri anahtarlari', () => {
    it('anahtarlar yoksa architecture.md §7 tablosundaki varsayilanlari uygular', () => {
      expect(validateEnv({ DATABASE_URL, JWT_SECRET })).toMatchObject({
        RATE_LIMIT_WINDOW_SECONDS: 60,
        RATE_LIMIT_MAX_REQUESTS: 300,
        AUTH_RATE_LIMIT_MAX_REQUESTS: 5,
      });
    });

    it('ortamdan metin olarak gelen degerleri sayiya cevirir', () => {
      expect(
        validateEnv({
          DATABASE_URL,
          JWT_SECRET,
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
      expect(() =>
        validateEnv({ DATABASE_URL, JWT_SECRET, AUTH_RATE_LIMIT_MAX_REQUESTS: '0' }),
      ).toThrow(/AUTH_RATE_LIMIT_MAX_REQUESTS/);
    });

    it('negatif pencere degerini reddeder', () => {
      expect(() =>
        validateEnv({ DATABASE_URL, JWT_SECRET, RATE_LIMIT_WINDOW_SECONDS: '-1' }),
      ).toThrow(/RATE_LIMIT_WINDOW_SECONDS/);
    });

    it('sayi olmayan limit degerini reddeder', () => {
      expect(() =>
        validateEnv({ DATABASE_URL, JWT_SECRET, RATE_LIMIT_MAX_REQUESTS: 'cok' }),
      ).toThrow(/RATE_LIMIT_MAX_REQUESTS/);
    });

    it('ondalikli limit degerini reddeder', () => {
      expect(() =>
        validateEnv({ DATABASE_URL, JWT_SECRET, RATE_LIMIT_MAX_REQUESTS: '2.5' }),
      ).toThrow(/RATE_LIMIT_MAX_REQUESTS/);
    });
  });

  it('JWT_SECRET eksikse uygulama acilmasin diye hata firlatir', () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(/JWT_SECRET/);
  });

  it('DATABASE_URL eksikse hata firlatir', () => {
    expect(() => validateEnv({ JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('kisa JWT_SECRET degerini reddeder', () => {
    expect(() => validateEnv({ DATABASE_URL, JWT_SECRET: 'kisa' })).toThrow(/JWT_SECRET/);
  });

  it('hata mesajinda gecersiz degerin kendisini yazmaz (sir sizintisi olmasin)', () => {
    let message = '';
    try {
      validateEnv({ DATABASE_URL, JWT_SECRET: 'sir-degeri' });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain('sir-degeri');
  });

  it('bilinmeyen ortam degiskenlerini yok sayar (process.env tumuyle gelir)', () => {
    expect(() => validateEnv({ ...VALID_ENV, PATH: '/usr/bin', HOME: '/root' })).not.toThrow();
  });
});
