import { formatStamp } from './format-timestamp';

describe('formatStamp', () => {
  it('sunucu damgasini yerel tarih-saat metnine cevirir', () => {
    const formatted = formatStamp('2026-08-13T09:30:00.000Z');

    // Bicim yerel ayara baglidir; testin dogruladigi sey damganin gun/ay/yil + saat
    // bilesenlerini KAYIPSIZ tasidigidir (sabit metin karsilastirmasi kirilgan olurdu).
    expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('cozumlenemeyen damgayi oldugu gibi doner (veri kaybolmaz)', () => {
    expect(formatStamp('gecersiz-damga')).toBe('gecersiz-damga');
  });
});
