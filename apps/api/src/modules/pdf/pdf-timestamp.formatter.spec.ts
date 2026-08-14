import { REPORT_STAMP_TIME_ZONE, formatReportStamp } from './pdf-timestamp.formatter';

const CAPTURED_AT = new Date('2026-08-14T10:45:12.000Z');

describe('formatReportStamp', () => {
  it('damgayi tarih-saat olarak Turkce bicimde yazar', () => {
    expect(formatReportStamp(CAPTURED_AT, 'Europe/Istanbul')).toBe('14.08.2026 13:45:12');
  });

  it('varsayilan saat dilimi urunun pazarina (Europe/Istanbul) sabittir', () => {
    expect(REPORT_STAMP_TIME_ZONE).toBe('Europe/Istanbul');
    expect(formatReportStamp(CAPTURED_AT)).toBe('14.08.2026 13:45:12');
  });

  it('verilen saat dilimine gore ayni ani farkli yerel saatle yazar', () => {
    expect(formatReportStamp(CAPTURED_AT, 'UTC')).toBe('14.08.2026 10:45:12');
  });

  it('gun donumunu asan damgada tarih de kayar (saat dilimi gercekten uygulanir)', () => {
    const geceYarisiOncesi = new Date('2026-08-14T22:30:00.000Z');

    expect(formatReportStamp(geceYarisiOncesi, 'Europe/Istanbul')).toBe('15.08.2026 01:30:00');
  });
});
