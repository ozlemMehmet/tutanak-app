// PDF dogrulama yardimcilari (CLAUDE.md §8.4): uretilen PDF'in ICINDEKI metni ve gomulu
// goruntu sayisini okur. Bu dosya varlik/entity URETMEZ — yalnizca test altyapisidir.
//
// Neden ek bir kutuphane degil: PDFKit'in ciktisi standart PDF'tir; metin, Flate ile
// sikistirilmis icerik akislarinda `Tj`/`TJ` operatorleriyle durur. Bu iki operatoru
// node'un kendi `zlib`'i ile acip okumak, testin "PDF gercekten bu metni tasiyor mu"
// sorusunu bagimlilik eklemeden cevaplar (CLAUDE.md §6.2 — kutuphane butcesi).

import { inflateSync } from 'node:zlib';

/** `stream ... endstream` govdeleri; ikili (goruntu) akislar da bu kaliba uyar. */
const STREAM_PATTERN = /stream\r?\n([\s\S]*?)endstream/g;
/** Metin gosteren operatorler: `[...] TJ`, `(...) Tj`, `<hex> Tj`. */
const TEXT_OPERATOR_PATTERN = /\[[^\]]*\]\s*TJ|\((?:\\.|[^\\)])*\)\s*Tj|<[0-9A-Fa-f\s]*>\s*Tj/g;
/** Operator icindeki dizge belirtecleri: `<hex>` ya da `(literal)`. */
const STRING_TOKEN_PATTERN = /<([0-9A-Fa-f\s]*)>|\(((?:\\.|[^\\)])*)\)/g;
/** Gomulu goruntu nesnesinin sozluk imzasi. */
const IMAGE_XOBJECT_PATTERN = /\/Subtype\s*\/Image/g;

const LITERAL_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t' };

/** PDF dizgeleri bayt dizisidir; latin1 bayt<->karakter esligini bozmadan tasir. */
const PDF_BYTE_ENCODING = 'latin1';

function decodeStringToken(hex: string | undefined, literal: string | undefined): string {
  if (hex !== undefined) {
    return Buffer.from(hex.replace(/\s+/g, ''), 'hex').toString(PDF_BYTE_ENCODING);
  }
  return (literal ?? '').replace(/\\([\\()nrt])/g, (_, character: string) => {
    return LITERAL_ESCAPES[character] ?? character;
  });
}

/** Tek bir metin operatorunun tasidigi tum dizgeleri birlestirir (kerning parcalarini birler). */
function decodeTextOperator(operator: string): string {
  let text = '';
  for (const token of operator.matchAll(STRING_TOKEN_PATTERN)) {
    text += decodeStringToken(token[1], token[2]);
  }
  return text;
}

/**
 * PDF'teki gorunur metni satir satir doner. Acilamayan (sikistirilmamis ikili) akislar
 * atlanir — gomulu JPEG verisi metin olarak yorumlanmaz.
 */
export function extractPdfText(pdf: Buffer): string {
  const raw = pdf.toString(PDF_BYTE_ENCODING);
  const lines: string[] = [];

  for (const stream of raw.matchAll(STREAM_PATTERN)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(stream[1] ?? '', PDF_BYTE_ENCODING)).toString(
        PDF_BYTE_ENCODING,
      );
    } catch {
      continue;
    }
    for (const operator of content.matchAll(TEXT_OPERATOR_PATTERN)) {
      lines.push(decodeTextOperator(operator[0]));
    }
  }

  return lines.join('\n');
}

/** PDF'e gomulu goruntu (XObject) sayisi — "fotograf gercekten gomuldu mu" sorusu icin. */
export function countPdfImages(pdf: Buffer): number {
  return pdf.toString(PDF_BYTE_ENCODING).match(IMAGE_XOBJECT_PATTERN)?.length ?? 0;
}
