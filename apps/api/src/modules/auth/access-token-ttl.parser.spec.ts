import { parseAccessTokenTtlSeconds } from './access-token-ttl.parser';

describe('parseAccessTokenTtlSeconds', () => {
  it('gun birimli degeri saniyeye cevirir', () => {
    expect(parseAccessTokenTtlSeconds('7d')).toBe(604_800);
  });

  it('saniye, dakika, saat, hafta ve yil birimlerini cevirir', () => {
    expect(parseAccessTokenTtlSeconds('45s')).toBe(45);
    expect(parseAccessTokenTtlSeconds('15m')).toBe(900);
    expect(parseAccessTokenTtlSeconds('2h')).toBe(7_200);
    expect(parseAccessTokenTtlSeconds('1w')).toBe(604_800);
    expect(parseAccessTokenTtlSeconds('1y')).toBe(31_557_600);
  });

  it('birimsiz sayida hata firlatir (imzalayici birimsiz degeri milisaniye sayar)', () => {
    expect(() => parseAccessTokenTtlSeconds('604800')).toThrow(/JWT_EXPIRES_IN/);
  });

  it('taninmayan birimde hata firlatir', () => {
    expect(() => parseAccessTokenTtlSeconds('7x')).toThrow(/JWT_EXPIRES_IN/);
    expect(() => parseAccessTokenTtlSeconds('500ms')).toThrow(/JWT_EXPIRES_IN/);
  });

  it('bicimi bozuk degerde hata firlatir', () => {
    expect(() => parseAccessTokenTtlSeconds('')).toThrow(/JWT_EXPIRES_IN/);
    expect(() => parseAccessTokenTtlSeconds('yedi gun')).toThrow(/JWT_EXPIRES_IN/);
    expect(() => parseAccessTokenTtlSeconds('-1d')).toThrow(/JWT_EXPIRES_IN/);
  });

  it('sifir uzunluklu omurde hata firlatir', () => {
    expect(() => parseAccessTokenTtlSeconds('0d')).toThrow(/JWT_EXPIRES_IN/);
  });

  it('hata mesajinda degerin kendisini tasimaz (CLAUDE.md §5)', () => {
    let message = '';
    try {
      parseAccessTokenTtlSeconds('gizli-deger');
    } catch (caught) {
      message = (caught as Error).message;
    }

    expect(message).toContain('JWT_EXPIRES_IN');
    expect(message).not.toContain('gizli-deger');
  });
});
