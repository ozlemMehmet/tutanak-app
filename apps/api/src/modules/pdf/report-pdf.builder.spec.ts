import sharp from 'sharp';
import { countPdfImages, extractPdfText } from '../../../test/pdf-text';
import { ReportPdfBuilder } from './report-pdf.builder';

const CAPTURED_AT = new Date('2026-08-14T10:45:12.000Z');
/** Europe/Istanbul karsiligi (pdf-timestamp.formatter). */
const CAPTURED_AT_STAMP = '14.08.2026 13:45:12';

function photoBytes(): Promise<Buffer> {
  return sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

describe('ReportPdfBuilder', () => {
  it('baslik, sablon adi ve notu belgeye yazar', async () => {
    const pdf = await new ReportPdfBuilder()
      .addTitle('Kiraci teslim tutanagi 12A')
      .addTemplateName('Giris/Cikis Teslim Tutanagi')
      .addNote('Salon duvarinda cizik var.')
      .build();

    const text = extractPdfText(pdf);
    expect(text).toContain('Kiraci teslim tutanagi 12A');
    expect(text).toContain('Giris/Cikis Teslim Tutanagi');
    expect(text).toContain('Salon duvarinda cizik var.');
  });

  it('uretilen cikti gecerli bir PDF dosyasidir (imza + sonlandirici)', async () => {
    const pdf = await new ReportPdfBuilder().addTitle('Tutanak').build();

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('%%EOF');
  });

  it('fotografi belgeye gomer ve altina tarih-saat damgasini yazar', async () => {
    const pdf = await new ReportPdfBuilder()
      .addTitle('Tutanak')
      .addPhoto({ image: await photoBytes(), capturedAt: CAPTURED_AT })
      .build();

    expect(countPdfImages(pdf)).toBe(1);
    expect(extractPdfText(pdf)).toContain(CAPTURED_AT_STAMP);
  });

  it('her fotografi kendi damgasiyla ve verilen sirada ekler', async () => {
    const image = await photoBytes();
    const ikinciDamga = new Date('2026-08-14T11:00:00.000Z');

    const pdf = await new ReportPdfBuilder()
      .addTitle('Tutanak')
      .addPhoto({ image, capturedAt: CAPTURED_AT })
      .addPhoto({ image, capturedAt: ikinciDamga })
      .build();

    expect(countPdfImages(pdf)).toBe(2);
    const text = extractPdfText(pdf);
    expect(text.indexOf(CAPTURED_AT_STAMP)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(CAPTURED_AT_STAMP)).toBeLessThan(text.indexOf('14.08.2026 14:00:00'));
  });

  it('bos not verildiginde not bolumu yer tutucu ile yazilir', async () => {
    const pdf = await new ReportPdfBuilder().addTitle('Tutanak').addNote('').build();

    expect(extractPdfText(pdf)).toContain('Not');
  });
});
