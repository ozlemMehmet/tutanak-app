// Tutanak PDF belgesinin bolum bolum kurulmasi (CLAUDE.md §7 — Builder deseni:
// baslik -> sablon -> not -> fotograflar -> onay blogu[T-010]). Bu dosya YALNIZCA duzeni
// bilir: veri okumaz, depolamaya gitmez, is kurali uygulamaz.

import PDFDocument from 'pdfkit';
import { formatReportStamp } from './pdf-timestamp.formatter';

/** Belge duzeni sabitleri (punto/pt). Yapilandirma degil, sabit A4 duzenidir. */
const PAGE_SIZE = 'A4';
const PAGE_MARGIN_PT = 50;
const TITLE_FONT_SIZE_PT = 20;
const BODY_FONT_SIZE_PT = 12;
/** Fotograf icin ayrilan azami yukseklik; kalan yer damga satirina birakilir. */
const PHOTO_MAX_HEIGHT_PT = 640;
const SECTION_GAP_LINES = 1;

/**
 * PDF'in 14 standart fontundan biri; ek font dosyasi gomulmez. Bilinen sinirlama:
 * WinAnsi kodlamasi Turkce'ye ozgu s/g/i (s-cedilla, g-breve, noktasiz i) harflerini
 * TASIMAZ — gomulu Unicode font karari mimaride yoktur (devlog: "anayasa boslugu").
 */
const TITLE_FONT = 'Helvetica-Bold';
const BODY_FONT = 'Helvetica';

const TEMPLATE_LABEL = 'Sablon: ';
const NOTE_LABEL = 'Not: ';
const PHOTO_STAMP_LABEL = 'Fotograf tarihi: ';
/** T-010: onay blogunun etiketleri (delil degerinin tasiyicisi bu iki satirdir). */
const APPROVAL_HEADING = 'Taraf onayi';
const APPROVER_LABEL = 'Onaylayan: ';
const APPROVED_AT_LABEL = 'Onay tarihi: ';
/** Bos not, bolumun kaybolmasi yerine yer tutucu ile yazilir (belge alanlari sabittir). */
const EMPTY_NOTE_PLACEHOLDER = '-';

export interface ReportPdfApprovalSection {
  approverEmail: string;
  /** Veritabaninin urettigi onay damgasi (CLAUDE.md §3.7); bicimleme burada yapilir. */
  approvedAt: Date;
}

export interface ReportPdfPhotoSection {
  /** PDF'e gomulebilir bicime indirgenmis goruntu (bkz. pdf-photo.processor). */
  image: Buffer;
  /** Veritabaninin urettigi damga (CLAUDE.md §3.7); bicimleme burada yapilir. */
  capturedAt: Date;
}

export class ReportPdfBuilder {
  private readonly document: PDFKit.PDFDocument;
  private readonly chunks: Buffer[] = [];

  constructor() {
    this.document = new PDFDocument({ size: PAGE_SIZE, margin: PAGE_MARGIN_PT });
    this.document.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  addTitle(title: string): this {
    this.document.font(TITLE_FONT).fontSize(TITLE_FONT_SIZE_PT).text(title);
    this.document.moveDown(SECTION_GAP_LINES);
    return this;
  }

  addTemplateName(templateName: string): this {
    return this.addBodyLine(`${TEMPLATE_LABEL}${templateName}`);
  }

  addNote(note: string): this {
    const text = note.trim() === '' ? EMPTY_NOTE_PLACEHOLDER : note;
    return this.addBodyLine(`${NOTE_LABEL}${text}`);
  }

  /**
   * Her fotograf kendi sayfasinda, altinda kendi tarih-saat damgasiyla yer alir: sabit
   * duzen, degisken sayida fotografta yer hesabi gerektirmez ve damganin fotograftan
   * ayri dusmesi (sayfa kirilmasi) yapisal olarak imkansizdir.
   */
  addPhoto(section: ReportPdfPhotoSection): this {
    this.document.addPage();
    this.document.image(section.image, {
      fit: [this.contentWidth(), PHOTO_MAX_HEIGHT_PT],
      align: 'center',
    });
    this.document.moveDown(SECTION_GAP_LINES);
    return this.addBodyLine(`${PHOTO_STAMP_LABEL}${formatReportStamp(section.capturedAt)}`);
  }

  /**
   * Onay blogu (T-010): belgenin SON bolumudur (Builder sirasi: baslik -> sablon -> not ->
   * fotograflar -> onay). Kendi sayfasinda yer alir; boylece son fotografin damgasiyla ayni
   * satira dusmez ve onay bilgisi belgede tek bir yerde, aranabilir bicimde durur.
   */
  addApproval(section: ReportPdfApprovalSection): this {
    this.document.addPage();
    this.document.font(TITLE_FONT).fontSize(BODY_FONT_SIZE_PT).text(APPROVAL_HEADING);
    this.document.moveDown(SECTION_GAP_LINES);
    this.addBodyLine(`${APPROVER_LABEL}${section.approverEmail}`);
    return this.addBodyLine(`${APPROVED_AT_LABEL}${formatReportStamp(section.approvedAt)}`);
  }

  /** Belgeyi sonlandirir ve tam baytlarini doner (yarim belge stream EDILMEZ — §4.2.1). */
  build(): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      this.document.on('end', () => {
        resolve(Buffer.concat(this.chunks));
      });
      this.document.on('error', reject);
      this.document.end();
    });
  }

  private addBodyLine(text: string): this {
    this.document.font(BODY_FONT).fontSize(BODY_FONT_SIZE_PT).text(text);
    this.document.moveDown(SECTION_GAP_LINES);
    return this;
  }

  private contentWidth(): number {
    return this.document.page.width - PAGE_MARGIN_PT * 2;
  }
}
