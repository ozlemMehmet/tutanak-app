// `JWT_EXPIRES_IN` yapilandirma degerini (CLAUDE.md §5.1) saniyeye cevirir.
//
// Erisim tokeninin omru TEK kaynaktan (yapilandirmadan) turer: ayni deger hem
// `JwtModule.signOptions.expiresIn` alanina hem de `LoginResponse.expiresIn` alanina
// kaynaklik eder. Bu sayede imzalanan tokeni omru ogrenmek icin geri decode etmek
// gerekmez (`jwtService.decode()` `null` donebilir — T-016).
//
// Birim ZORUNLUDUR: imzalayici (jsonwebtoken/ms) birimsiz bir metni MILISANIYE sayar
// (`'604800'` -> 10 dakika), bu da yapilandirmayi sessizce yanlis yorumlamak olurdu.
// Bicim bozuksa hata acilista firlar ve uygulama ACILMAZ (CLAUDE.md §5).

const DURATION_PATTERN = /^(\d+)([a-zA-Z]+)$/;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 604_800;
/** `ms` kutuphanesiyle ayni tanim: 365.25 gun. */
const SECONDS_PER_YEAR = 31_557_600;

/** Deger loglanmaz/mesaja yazilmaz; yalnizca anahtar adi ve beklenen bicim bildirilir. */
const FORMAT_ERROR_MESSAGE =
  // ascii-tr-ok: yalnizca `new Error(...)` ile acilista firlatilir; yapilandirma hatasi metnidir
  'JWT_EXPIRES_IN gecersiz: <pozitif sayi><s|m|h|d|w|y> bicimi bekleniyor (ornek: 7d).';

function secondsPerUnit(unit: string): number {
  switch (unit) {
    case 's':
      return 1;
    case 'm':
      return SECONDS_PER_MINUTE;
    case 'h':
      return SECONDS_PER_HOUR;
    case 'd':
      return SECONDS_PER_DAY;
    case 'w':
      return SECONDS_PER_WEEK;
    case 'y':
      return SECONDS_PER_YEAR;
    default:
      throw new Error(FORMAT_ERROR_MESSAGE);
  }
}

/**
 * `'7d'` -> `604800`. Bicimi tanimlanan kumeye uymayan ya da sifir/negatif omur veren
 * her deger icin hata firlatir (acilista fail-fast).
 */
export function parseAccessTokenTtlSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  const amount = match?.[1];
  const unit = match?.[2];
  if (amount === undefined || unit === undefined) {
    throw new Error(FORMAT_ERROR_MESSAGE);
  }

  const seconds = Number(amount) * secondsPerUnit(unit);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(FORMAT_ERROR_MESSAGE);
  }
  return seconds;
}
