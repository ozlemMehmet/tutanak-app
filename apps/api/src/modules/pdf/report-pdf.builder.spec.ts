import sharp from 'sharp';
import { countPdfImages, extractPdfText } from '../../../test/pdf-text';
import { ReportPdfBuilder } from './report-pdf.builder';

const CAPTURED_AT = new Date('2026-08-14T10:45:12.000Z');
/** Europe/Istanbul karsiligi (pdf-timestamp.formatter). */
const CAPTURED_AT_STAMP = '14.08.2026 13:45:12';
const APPROVED_AT = new Date('2026-08-15T06:30:00.000Z');
const APPROVED_AT_STAMP = '15.08.2026 09:30:00';
const APPROVER_EMAIL = 'kiraci@ornek.test';
/**
 * H-001: fixture'lar dilin ZOR harflerini tasir. `ş ğ ı Ş İ` WinAnsi'de YOKTUR; ASCII'ye
 * katlanmis test verisi (`cikis teslimi`) bu siniri hic zorlamadigi icin font hatasi
 * urun teslim edilene kadar gorunmez kalmisti.
 */
const TURKISH_TITLE = 'Şişli Çağlayan 3+1 çıkış teslimi';
const TURKISH_NOTE = 'Mutfak dolabı çizik, ışık düğmesi bozuk, boyası eskimiş.';
const TURKISH_TEMPLATE_NAME = 'Giriş/Çıkış Teslim Tutanağı';

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

  it('baslik ve govdedeki Turkce harfleri (s g i S I) bozulmadan yazar', async () => {
    const pdf = await new ReportPdfBuilder()
      .addTitle(TURKISH_TITLE)
      .addTemplateName(TURKISH_TEMPLATE_NAME)
      .addNote(TURKISH_NOTE)
      .build();

    const text = extractPdfText(pdf);
    // Aranan dize ASCII karsiligi DEGIL, Turkce dizenin KENDISIDIR.
    expect(text).toContain(TURKISH_TITLE);
    expect(text).toContain(TURKISH_TEMPLATE_NAME);
    expect(text).toContain(TURKISH_NOTE);
  });

  it('WinAnsi disi harfleri yer tutucu/cop karaktere DUSURMEZ', async () => {
    const pdf = await new ReportPdfBuilder()
      .addTitle('ışık düğmesi')
      .addNote('Şişli İnönü')
      .build();

    const text = extractPdfText(pdf);
    expect(text).toContain('ışık düğmesi');
    expect(text).toContain('Şişli İnönü');
    // Kayip harf yerine soru isareti/yer tutucu konmasi da bir regresyondur.
    expect(text).not.toMatch(/[?�]/);
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

  it('onay blogunu onaylayanin e-postasi ve onay damgasi ile yazar (T-010 kriter 5)', async () => {
    const pdf = await new ReportPdfBuilder()
      .addTitle('Tutanak')
      .addApproval({ approverEmail: APPROVER_EMAIL, approvedAt: APPROVED_AT })
      .build();

    const text = extractPdfText(pdf);
    expect(text).toContain(APPROVER_EMAIL);
    expect(text).toContain(APPROVED_AT_STAMP);
  });

  it('onay blogu belgenin SONUNDA yer alir (baslik -> ... -> fotograflar -> onay)', async () => {
    const pdf = await new ReportPdfBuilder()
      .addTitle('Tutanak')
      .addPhoto({ image: await photoBytes(), capturedAt: CAPTURED_AT })
      .addApproval({ approverEmail: APPROVER_EMAIL, approvedAt: APPROVED_AT })
      .build();

    const text = extractPdfText(pdf);
    expect(text.indexOf(CAPTURED_AT_STAMP)).toBeLessThan(text.indexOf(APPROVED_AT_STAMP));
  });

  it('sabit etiketleri ASCII karsiligiyla degil, duzgun Turkce ile basar (H-002)', async () => {
    const pdf = await new ReportPdfBuilder()
      .addTitle(TURKISH_TITLE)
      .addTemplateName(TURKISH_TEMPLATE_NAME)
      .addNote(TURKISH_NOTE)
      .addPhoto({ image: await photoBytes(), capturedAt: CAPTURED_AT })
      .addApproval({ approverEmail: APPROVER_EMAIL, approvedAt: APPROVED_AT })
      .build();

    const text = extractPdfText(pdf);
    // Aranan dize etiketin Turkce KENDISIDIR; ASCII'ye katlanmis hali kalmis olmamalidir.
    expect(text).toContain('Şablon: ');
    expect(text).toContain('Not: ');
    expect(text).toContain('Fotoğraf tarihi: ');
    expect(text).toContain('Taraf onayı');
    expect(text).toContain('Onaylayan: ');
    expect(text).toContain('Onay tarihi: ');
    expect(text).not.toContain('Sablon: ');
    expect(text).not.toContain('Fotograf tarihi: ');
    expect(text).not.toContain('Taraf onayi');
  });

  it('bos not verildiginde not bolumu yer tutucu ile yazilir', async () => {
    const pdf = await new ReportPdfBuilder().addTitle('Tutanak').addNote('').build();

    expect(extractPdfText(pdf)).toContain('Not');
  });
});
