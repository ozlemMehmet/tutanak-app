// Giris sonrasi hedef rota secimi (T-018 kriter 2 + T-017 `redirectTo` sozlesmesi).
import { DEFAULT_SIGNED_IN_ROUTE, safeRedirectTarget } from './redirect-target';

describe('safeRedirectTarget', () => {
  it('redirectTo yoksa varsayilan olarak /reports doner', () => {
    expect(safeRedirectTarget(null)).toBe(DEFAULT_SIGNED_IN_ROUTE);
    expect(DEFAULT_SIGNED_IN_ROUTE).toBe('/reports');
  });

  it('bos redirectTo degerinde varsayilana duser', () => {
    expect(safeRedirectTarget('')).toBe('/reports');
  });

  it('uygulama ici mutlak yolu sorgu ve fragment ile birlikte korur', () => {
    expect(safeRedirectTarget('/reports/abc-123?sayfa=2#foto')).toBe(
      '/reports/abc-123?sayfa=2#foto',
    );
  });

  it('baska bir siteye giden mutlak URL yerine varsayilani doner (acik yonlendirme onlenir)', () => {
    expect(safeRedirectTarget('https://kotu.example/oltalama')).toBe('/reports');
  });

  it('protokolsuz (//) dis adresi reddeder', () => {
    expect(safeRedirectTarget('//kotu.example/oltalama')).toBe('/reports');
  });

  it('ters bolu ile yazilmis (/\\) dis adresi reddeder', () => {
    expect(safeRedirectTarget('/\\kotu.example')).toBe('/reports');
  });

  it('mutlak olmayan (goreli) yolu reddeder', () => {
    expect(safeRedirectTarget('reports')).toBe('/reports');
  });
});
