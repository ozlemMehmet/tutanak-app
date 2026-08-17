// PDF dogrulama yardimcilari (CLAUDE.md §8.4): uretilen PDF'in ICINDEKI metni ve gomulu
// goruntu sayisini okur. Bu dosya varlik/entity URETMEZ — yalnizca test altyapisidir.
//
// Neden ek bir kutuphane degil: PDFKit'in ciktisi standart PDF'tir; metin, Flate ile
// sikistirilmis icerik akislarinda `Tj`/`TJ` operatorleriyle durur. Bu iki operatoru
// node'un kendi `zlib`'i ile acip okumak, testin "PDF gercekten bu metni tasiyor mu"
// sorusunu bagimlilik eklemeden cevaplar (CLAUDE.md §6.2 — kutuphane butcesi).
//
// H-001: belgeye gomulu bir TrueType font kullanildiginda (Type0/Identity-H) dizgelerdeki
// baytlar KARAKTER degil, fontun GLIF NUMARALARIDIR; ham baytlari okumak `Şişli` yerine
// anlamsiz kod uretir. PDF bu esleme icin her fontun yaninda bir `/ToUnicode` CMap'i tasir;
// asagidaki cozumleme once bu CMap'leri okur, sonra icerik akisindaki `Tf` (font sec)
// operatoruyle hangi dizgenin hangi CMap'e ait oldugunu izler. Gomulu font kullanilmayan
// (WinAnsi, 14 standart font) belgelerde eski davranis aynen gecerlidir.

import { inflateSync } from 'node:zlib';

/** `stream ... endstream` govdeleri; ikili (goruntu) akislar da bu kaliba uyar. */
const STREAM_PATTERN = /stream\r?\n([\s\S]*?)endstream/g;
/** Tek bir nesnenin govdesi: `12 0 obj ... endobj`. */
const OBJECT_PATTERN = /(\d+)\s+0\s+obj\b([\s\S]*?)\bendobj/g;
/**
 * Metin operatorleri (`[...] TJ`, `(...) Tj`, `<hex> Tj`) ve font secme operatoru
 * (`/F2 20 Tf`) TEK taramada, sirasiyla okunur: bir dizgenin nasil cozulecegi kendisinden
 * once gelen `Tf` ile belirlenir.
 */
const CONTENT_TOKEN_PATTERN =
  /\/([^\s/<>[\]()]+)\s+[\d.]+\s+Tf|\[[^\]]*\]\s*TJ|\((?:\\.|[^\\)])*\)\s*Tj|<[0-9A-Fa-f\s]*>\s*Tj/g;
/** Operator icindeki dizge belirtecleri: `<hex>` ya da `(literal)`. */
const STRING_TOKEN_PATTERN = /<([0-9A-Fa-f\s]*)>|\(((?:\\.|[^\\)])*)\)/g;
/** Gomulu goruntu nesnesinin sozluk imzasi. */
const IMAGE_XOBJECT_PATTERN = /\/Subtype\s*\/Image/g;
/** Sayfa kaynak sozlugundeki font tablosu: `/Font << /F2 8 0 R /F3 9 0 R >>`. */
const FONT_RESOURCE_DICT_PATTERN = /\/Font\s*<<([\s\S]*?)>>/g;
/** Kaynak tablosundaki tek giris: `/F2 8 0 R`. */
const FONT_RESOURCE_ENTRY_PATTERN = /\/([^\s/<>[\]()]+)\s+(\d+)\s+0\s+R/g;
/** Font nesnesinin ToUnicode CMap referansi. */
const TO_UNICODE_REFERENCE_PATTERN = /\/ToUnicode\s+(\d+)\s+0\s+R/;
const FONT_OBJECT_PATTERN = /\/Type\s*\/Font\b/;
/** CMap bloklari: `N beginbfchar ... endbfchar`, `N beginbfrange ... endbfrange`. */
const BF_CHAR_BLOCK_PATTERN = /beginbfchar([\s\S]*?)endbfchar/g;
const BF_RANGE_BLOCK_PATTERN = /beginbfrange([\s\S]*?)endbfrange/g;
const BF_CHAR_ENTRY_PATTERN = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g;
/** `<lo> <hi> [<u1> <u2> ...]` ya da `<lo> <hi> <ilkUnicode>` bicimleri. */
const BF_RANGE_ENTRY_PATTERN =
  /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:\[([\s\S]*?)\]|<([0-9A-Fa-f]*)>)/g;
const HEX_STRING_PATTERN = /<([0-9A-Fa-f]*)>/g;
const CMAP_MARKER = 'begincmap';

const LITERAL_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t' };

/** PDF dizgeleri bayt dizisidir; latin1 bayt<->karakter esligini bozmadan tasir. */
const PDF_BYTE_ENCODING = 'latin1';
/** Identity-H kodlamasinda her glif numarasi 2 bayttir (4 onaltilik basamak). */
const GLYPH_CODE_HEX_LENGTH = 4;
/** Eslesmeyen glif: sessizce yutulursa test "metin var" sanir; gorunur olmasi sarttir. */
const UNMAPPED_GLYPH = '�';

/** CMap'in tasidigi esleme: glif kodu -> gercek metin (ligaturler icin cok karakterli). */
type ToUnicodeMap = Map<number, string>;

function decodeUtf16BeHex(hex: string): string {
  let text = '';
  for (let index = 0; index + GLYPH_CODE_HEX_LENGTH <= hex.length; index += GLYPH_CODE_HEX_LENGTH) {
    text += String.fromCharCode(parseInt(hex.slice(index, index + GLYPH_CODE_HEX_LENGTH), 16));
  }
  return text;
}

function parseToUnicodeMap(cmap: string): ToUnicodeMap {
  const mapping: ToUnicodeMap = new Map();

  for (const block of cmap.matchAll(BF_CHAR_BLOCK_PATTERN)) {
    for (const entry of (block[1] ?? '').matchAll(BF_CHAR_ENTRY_PATTERN)) {
      mapping.set(parseInt(entry[1] ?? '0', 16), decodeUtf16BeHex(entry[2] ?? ''));
    }
  }

  for (const block of cmap.matchAll(BF_RANGE_BLOCK_PATTERN)) {
    for (const entry of (block[1] ?? '').matchAll(BF_RANGE_ENTRY_PATTERN)) {
      const from = parseInt(entry[1] ?? '0', 16);
      const to = parseInt(entry[2] ?? '0', 16);
      const list = entry[3];
      if (list !== undefined) {
        let code = from;
        for (const destination of list.matchAll(HEX_STRING_PATTERN)) {
          mapping.set(code, decodeUtf16BeHex(destination[1] ?? ''));
          code += 1;
        }
        continue;
      }
      const start = parseInt(entry[4] ?? '0', 16);
      for (let code = from; code <= to; code += 1) {
        mapping.set(code, String.fromCharCode(start + (code - from)));
      }
    }
  }

  return mapping;
}

/** Nesne govdesindeki akisi (varsa) acar; sikistirilmamis akis oldugu gibi doner. */
function readStreamContent(objectBody: string): string | undefined {
  const stream = new RegExp(STREAM_PATTERN.source).exec(objectBody);
  if (stream === null) {
    return undefined;
  }
  const body = Buffer.from(stream[1] ?? '', PDF_BYTE_ENCODING);
  try {
    return inflateSync(body).toString(PDF_BYTE_ENCODING);
  } catch {
    return body.toString(PDF_BYTE_ENCODING);
  }
}

/**
 * Kaynak adi (`/F2`) -> ToUnicode eslemesi. PDFKit kaynak adlarini belge genelinde tekil
 * uretir (`F1`, `F2`, ...), bu yuzden tek bir tablo tum sayfalar icin gecerlidir.
 */
function collectFontMaps(raw: string): Map<string, ToUnicodeMap> {
  const objects = new Map<string, string>();
  for (const object of raw.matchAll(OBJECT_PATTERN)) {
    objects.set(object[1] ?? '', object[2] ?? '');
  }

  const fontObjectToMap = new Map<string, ToUnicodeMap>();
  for (const [number, body] of objects) {
    if (!FONT_OBJECT_PATTERN.test(body)) {
      continue;
    }
    const reference = TO_UNICODE_REFERENCE_PATTERN.exec(body);
    const cmapBody = objects.get(reference?.[1] ?? '');
    const cmap = cmapBody === undefined ? undefined : readStreamContent(cmapBody);
    if (cmap?.includes(CMAP_MARKER) === true) {
      fontObjectToMap.set(number, parseToUnicodeMap(cmap));
    }
  }

  const resourceToMap = new Map<string, ToUnicodeMap>();
  for (const body of objects.values()) {
    for (const dictionary of body.matchAll(FONT_RESOURCE_DICT_PATTERN)) {
      for (const entry of (dictionary[1] ?? '').matchAll(FONT_RESOURCE_ENTRY_PATTERN)) {
        const mapping = fontObjectToMap.get(entry[2] ?? '');
        if (mapping !== undefined) {
          resourceToMap.set(entry[1] ?? '', mapping);
        }
      }
    }
  }

  return resourceToMap;
}

function decodeStringToken(
  hex: string | undefined,
  literal: string | undefined,
  mapping: ToUnicodeMap | undefined,
): string {
  if (hex !== undefined) {
    const digits = hex.replace(/\s+/g, '');
    if (mapping === undefined) {
      return Buffer.from(digits, 'hex').toString(PDF_BYTE_ENCODING);
    }
    let text = '';
    for (
      let index = 0;
      index + GLYPH_CODE_HEX_LENGTH <= digits.length;
      index += GLYPH_CODE_HEX_LENGTH
    ) {
      const code = parseInt(digits.slice(index, index + GLYPH_CODE_HEX_LENGTH), 16);
      text += mapping.get(code) ?? UNMAPPED_GLYPH;
    }
    return text;
  }
  return (literal ?? '').replace(/\\([\\()nrt])/g, (_, character: string) => {
    return LITERAL_ESCAPES[character] ?? character;
  });
}

/** Tek bir metin operatorunun tasidigi tum dizgeleri birlestirir (kerning parcalarini birler). */
function decodeTextOperator(operator: string, mapping: ToUnicodeMap | undefined): string {
  let text = '';
  for (const token of operator.matchAll(STRING_TOKEN_PATTERN)) {
    text += decodeStringToken(token[1], token[2], mapping);
  }
  return text;
}

/**
 * PDF'teki gorunur metni satir satir doner. Acilamayan (sikistirilmamis ikili) akislar
 * atlanir — gomulu JPEG verisi metin olarak yorumlanmaz.
 */
export function extractPdfText(pdf: Buffer): string {
  const raw = pdf.toString(PDF_BYTE_ENCODING);
  const fontMaps = collectFontMaps(raw);
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
    if (content.includes(CMAP_MARKER)) {
      continue;
    }
    let mapping: ToUnicodeMap | undefined;
    for (const token of content.matchAll(CONTENT_TOKEN_PATTERN)) {
      const selectedFont = token[1];
      if (selectedFont !== undefined) {
        mapping = fontMaps.get(selectedFont);
        continue;
      }
      lines.push(decodeTextOperator(token[0], mapping));
    }
  }

  return lines.join('\n');
}

/** PDF'e gomulu goruntu (XObject) sayisi — "fotograf gercekten gomuldu mu" sorusu icin. */
export function countPdfImages(pdf: Buffer): number {
  return pdf.toString(PDF_BYTE_ENCODING).match(IMAGE_XOBJECT_PATTERN)?.length ?? 0;
}
