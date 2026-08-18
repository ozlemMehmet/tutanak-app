// H-007: kullaniciya donuk dizelerde ASCII'ye katlanmis Turkce'yi yakalayan kontrol.
//
// Neden: B-002 (arayuz/API metinleri) ve B-005 (seed, manifest, index.html) ayni kok nedenden
// dogdu — Turkce metinler `Odeme`, `henuz`, `Tutanagi` gibi ASCII'ye katlanarak yazilmisti ve
// hicbir kapi tetiklenmedi. Bu modul o sinifi otomatiklestirir.
//
// Yaklasim: yalnizca KULLANICIYA DONUK metin taranir. TS/TSX dosyalarinda bu, TypeScript
// AST'inden toplanan dize sabitleri + sablon dize parcalari + JSX metin dugumleridir; kod
// yorumlari (bu dosyanin yorumlari dahil) bilincli olarak ASCII yazilir ve TARANMAZ.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import ts from 'typescript';

/** Bir katlanma kalibi: ASCII'ye katlanmis bicim + beklenen dogru Turkce yazim. */
export interface AsciiFoldPattern {
  /** Katlanmis bicim (kelime basi sinirli, ek almaya izin verir). */
  readonly folded: RegExp;
  /** Hata mesajinda gosterilen dogru yazim. */
  readonly expected: string;
}

/**
 * Kalip listesi — TEK YER. Yeni bir katlanma gorulurse buraya bir satir eklenir.
 *
 * Kural: her kalip, katlanmis HALIYLE yazilir ve dogru yazimda mutlaka Turkce'ye ozgu bir harf
 * (`ş ğ ı ç ö ü`) icerir. Bu sayede dogru yazilmis metin kalibi ASLA tetiklemez ("Ödeme",
 * "Tutanağı"), tamamen ASCII olan dogru kelimeler de bulgu uretmez ("Yeni Tutanak", "teslim").
 */
export const ASCII_FOLDED_PATTERNS: readonly AsciiFoldPattern[] = [
  // Urun sozlugu (B-002 / B-005'te fiilen kacan kelimeler basta).
  { folded: /\bodeme\w*/gi, expected: 'ödeme' },
  { folded: /\bhenuz\b/gi, expected: 'henüz' },
  { folded: /\bdegil\w*/gi, expected: 'değil' },
  { folded: /\btutanag\w*/gi, expected: 'tutanağ…' },
  { folded: /\bfotograf\w*/gi, expected: 'fotoğraf' },
  { folded: /\bpaylas\w*/gi, expected: 'paylaş…' },
  { folded: /\bicin\b/gi, expected: 'için' },
  { folded: /\bsablon\w*/gi, expected: 'şablon' },
  { folded: /\bteslimat\w*i\b/gi, expected: 'teslimatı' },
  { folded: /\bkiraci\w*/gi, expected: 'kiracı' },
  { folded: /\bkullanici\w*/gi, expected: 'kullanıcı' },
  { folded: /\bmusteri\w*/gi, expected: 'müşteri' },
  { folded: /\bsifre\w*/gi, expected: 'şifre' },
  { folded: /\bimzalayan\w*i\b/gi, expected: 'imzalayanı' },
  // Sik gecen fiil/sifat govdeleri.
  { folded: /\byukle\w*/gi, expected: 'yükle…' },
  { folded: /\bgonder\w*/gi, expected: 'gönder…' },
  { folded: /\bgoster\w*/gi, expected: 'göster…' },
  { folded: /\bgorunt\w*/gi, expected: 'görünt…' },
  { folded: /\bgorev\w*/gi, expected: 'görev' },
  { folded: /\bolustur\w*/gi, expected: 'oluştur…' },
  { folded: /\bguncelle\w*/gi, expected: 'güncelle…' },
  { folded: /\bduzenle\w*/gi, expected: 'düzenle…' },
  { folded: /\bcalis\w*/gi, expected: 'çalış…' },
  { folded: /\bdogrula\w*/gi, expected: 'doğrula…' },
  { folded: /\bdogru\b/gi, expected: 'doğru' },
  { folded: /\byanlis\w*/gi, expected: 'yanlış' },
  { folded: /\bgecerli\w*/gi, expected: 'geçerli' },
  { folded: /\bgecersiz\w*/gi, expected: 'geçersiz' },
  { folded: /\bgecmis\w*/gi, expected: 'geçmiş' },
  { folded: /\bbasari\w*/gi, expected: 'başarı…' },
  { folded: /\bbaslik\w*/gi, expected: 'başlık' },
  { folded: /\bbasla\w*/gi, expected: 'başla…' },
  { folded: /\baciklama\w*/gi, expected: 'açıklama' },
  { folded: /\bgiris\w*/gi, expected: 'giriş' },
  { folded: /\bcikis\w*/gi, expected: 'çıkış' },
  { folded: /\bcikar\w*/gi, expected: 'çıkar…' },
  { folded: /\blutfen\b/gi, expected: 'lütfen' },
  // DIKKAT: "sonucu/sonuca" DOGRUDUR (sonuç + unlu ek = yumusama). Kalip eksiz bicimle sinirli.
  { folded: /\bsonuc\b/gi, expected: 'sonuç' },
  { folded: /\bdeger\w*/gi, expected: 'değer' },
  { folded: /\bbagli\w*/gi, expected: 'bağlı' },
  { folded: /\bbaglanti\w*/gi, expected: 'bağlantı' },
  { folded: /\bbuyuk\w*/gi, expected: 'büyük' },
  { folded: /\bkucuk\w*/gi, expected: 'küçük' },
  { folded: /\bkapali\b/gi, expected: 'kapalı' },
  { folded: /\bhazir\w*/gi, expected: 'hazır' },
  { folded: /\bkisa\b/gi, expected: 'kısa' },
  { folded: /\bkisi\w*/gi, expected: 'kişi' },
  { folded: /\bguvenlik\w*/gi, expected: 'güvenlik' },
  { folded: /\bsurum\w*/gi, expected: 'sürüm' },
  // Ek (suffix) kaliplari: dogru yazimlari HER ZAMAN Turkce harf tasiyan ekler.
  { folded: /\b\w+lari\b/gi, expected: '-ları' },
  { folded: /\b\w+madi\b/gi, expected: '-madı' },
  { folded: /\b\w+digi\b/gi, expected: '-dığı' },
  { folded: /\b\w+ligi\b/gi, expected: '-lığı' },
];

/** Taranan yuzeyler (ticket H-007 kriter 2). Dizin ya da tek dosya olabilir. */
export const SCAN_TARGETS: readonly string[] = [
  'apps/web/src',
  'apps/api/src',
  'apps/api/prisma/seed.ts',
  'apps/web/public/manifest.webmanifest',
  'apps/web/index.html',
];

/** Icerigi ayristirabildigimiz uzantilar; digerleri (png, css, sql...) taranmaz. */
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.html', '.webmanifest', '.json'] as const;

/**
 * Dislama listesi — her maddenin gerekcesi yaninda yazilidir (kriter 5: sessiz genis dislama yok).
 */
const EXCLUDED_PATH_RULES: readonly { readonly matches: (path: string) => boolean }[] = [
  // Uretilmis/derlenmis ciktilar: kaynagi biz yazmiyoruz.
  { matches: (p) => /(^|\/)(node_modules|dist|dev-dist|coverage|build)\//.test(p) },
  // openapi-typescript ciktisi (CLAUDE.md §3.6: elle duzenlenmez).
  { matches: (p) => p.endsWith('.d.ts') },
  // Test fixture'lari bilincli olarak ASCII'dir (H-007 "Kapsam DISI").
  { matches: (p) => /\.(spec|e2e-spec)\.tsx?$/.test(p) },
  // Test yardimcilari/fabrikalari ayni gerekceyle disaridadir.
  { matches: (p) => /(^|\/)(test|e2e|__mocks__|__fixtures__)\//.test(p) },
];

/**
 * JSX'te kullaniciya GORUNMEYEN oznitelikler: degerleri teknik tanimlayicidir (sinif adi, rota,
 * dosya yolu, test kancasi). `alt`, `title`, `placeholder`, `aria-label` bilincli olarak
 * LISTEDE DEGILDIR — onlar kullaniciya/ekran okuyucuya gider ve taranir.
 */
const NON_USER_FACING_JSX_ATTRIBUTES = new Set([
  'className',
  'class',
  'id',
  'key',
  'href',
  'src',
  'srcSet',
  'to',
  'type',
  'role',
  'name',
  'htmlFor',
  'rel',
  'target',
  'method',
  'accept',
  'capture',
  'autoComplete',
  'inputMode',
  'enterKeyHint',
  'data-testid',
  'testId',
]);

/** HTML'de kullaniciya donuk oznitelikler; digerlerinin degeri taranmaz. */
const USER_FACING_HTML_ATTRIBUTES = ['content', 'alt', 'title', 'placeholder', 'aria-label'];

/**
 * Teshis (log) cagrilari: govdeleri operatore/loga gider, son kullaniciya ASLA ulasmaz.
 * Kod tabaninin yerlesik kurali budur — kullaniciya donuk sabitler gercek Turkce yazilir
 * (`REJECTED_MESSAGE = 'E-posta sağlayıcısı gönderimi reddetti.'`), log baglami ASCII kalir
 * (`logger.error('E-posta saglayicisi gonderimi reddetti (to=...)')`). CLAUDE.md §4.4.
 */
const DIAGNOSTIC_CALLEE_PATTERNS: readonly RegExp[] = [
  /(?:^|\.)(?:logger|log|console)\.(?:error|warn|log|info|debug|trace|fatal)$/,
  /^process\.(?:stdout|stderr)\.write$/,
];

/**
 * Satir bazli, GEREKCE ZORUNLU susturma isareti. Kullanim:
 * `// ascii-tr-ok: <neden bu dize kullaniciya gitmiyor>`
 * Gerekcesiz yazilan isaret (`// ascii-tr-ok:`) gecerli DEGILDIR ve bulguyu susturmaz
 * (CLAUDE.md §9: "uyari bastirma gerekce ister").
 */
const SUPPRESSION_MARKER = /(?:\/\/|\/\*|<!--|#)\s*ascii-tr-ok:[ \t]*\S+/;

/** Bir bulgu: hangi dosyanin hangi satirinda, hangi katlanmis kelime. */
export interface AsciiFoldFinding {
  /** Depo koku'ne gore, `/` ayracli yol. */
  readonly filePath: string;
  /** 1 tabanli satir numarasi. */
  readonly line: number;
  /** Yakalanan katlanmis kelime. */
  readonly match: string;
  /** Beklenen dogru yazim (ipucu). */
  readonly expected: string;
  /** Bulgunun icinde gectigi kullaniciya donuk metin. */
  readonly snippet: string;
}

interface ExtractedText {
  readonly text: string;
  /** Metnin dosya icindeki baslangic satiri (1 tabanli). */
  readonly line: number;
}

function toPosixPath(path: string): string {
  return path.split(sep).join('/');
}

/**
 * Teknik deger mi? Bu degerler kullaniciya prose olarak gitmez; kod anahtari, URL, e-posta,
 * dosya yolu, MIME tipi, renk kodu ya da sabit anahtaridir (kriter 5).
 */
function isTechnicalValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return true;
  return (
    /^[a-z][\w.+-]*:\/\//i.test(trimmed) || // URL (https://, mailto: benzeri semalar dahil)
    /^mailto:/i.test(trimmed) ||
    /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed) || // e-posta
    /^\.{0,2}\/[\w\-./:{}?=&%#]*$/.test(trimmed) || // mutlak/gorece yol, rota kalibi
    /^[a-z0-9]+([_-][a-z0-9]+)+$/i.test(trimmed) || // kod anahtari: move_in_out, share-link
    /^[A-Z][A-Z0-9_]*$/.test(trimmed) || // sabit anahtari: ODEME_SONUCU
    /^#[0-9a-f]{3,8}$/i.test(trimmed) || // renk
    /^[a-z0-9]+\/[a-z0-9.+-]+$/i.test(trimmed) // MIME tipi
  );
}

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

function scanExtractedText(filePath: string, extracted: ExtractedText): AsciiFoldFinding[] {
  const { text } = extracted;
  if (isTechnicalValue(text)) return [];

  const findings: AsciiFoldFinding[] = [];
  for (const { folded, expected } of ASCII_FOLDED_PATTERNS) {
    for (const match of text.matchAll(folded)) {
      const value = match[0];
      const index = match.index;
      findings.push({
        filePath,
        line: extracted.line + lineOf(text, index) - 1,
        match: value,
        expected,
        snippet: text.trim(),
      });
    }
  }
  return findings;
}

/**
 * Dize, teshis amacli bir cagrinin argumani mi? (log cagrilari ve `new Error(...)`)
 *
 * `new Error(...)` bilincli olarak listededir: kullaniciya donuk hatalar CLAUDE.md §4.2'deki
 * `AppError` hiyerarsisiyle firlatilir ve TARANIR; ciplak `Error` yalnizca gelistirici
 * hatasidir (`'SessionProvider bulunamadi: ...'`), istemciye `500 INTERNAL_ERROR` doner (§4.2).
 */
/**
 * TypeScript tipleri `node.parent`i her zaman dolu sayar; SourceFile'da runtime degeri
 * `undefined`'dir. Bu yardimci, kontrolun dogru tiple yapilmasini saglar.
 */
function parentOf(node: ts.Node): ts.Node | undefined {
  return node.parent;
}

function isDiagnosticArgument(node: ts.Node): boolean {
  let current: ts.Node = node;
  let parent = parentOf(current);
  // Sablon dize parcasi, dize birlestirme, kosullu ifade ve parantez icinden cagri argumanina cik.
  while (
    parent !== undefined &&
    (ts.isTemplateExpression(parent) ||
      ts.isTemplateSpan(parent) ||
      ts.isBinaryExpression(parent) ||
      ts.isConditionalExpression(parent) ||
      ts.isParenthesizedExpression(parent))
  ) {
    current = parent;
    parent = parentOf(parent);
  }
  if (parent === undefined) return false;

  if (ts.isNewExpression(parent) && parent.expression.getText() === 'Error') return true;
  if (ts.isCallExpression(parent) && parent.arguments.some((argument) => argument === current)) {
    const callee = parent.expression.getText();
    return DIAGNOSTIC_CALLEE_PATTERNS.some((pattern) => pattern.test(callee));
  }
  return false;
}

function isNonUserFacingStringNode(node: ts.StringLiteralLike): boolean {
  const parent = parentOf(node);
  if (parent === undefined) return false;
  if (isDiagnosticArgument(node)) return true;

  // Modul yolu: import/export ... from '...'
  if (
    (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
    parent.moduleSpecifier === node
  ) {
    return true;
  }
  if (ts.isExternalModuleReference(parent) || ts.isImportTypeNode(parent)) return true;

  // Tip seviyesi literal: 'draft' | 'shared'
  if (ts.isLiteralTypeNode(parent)) return true;

  // Nesne/sinif uye ADI (deger degil): { 'odeme_durumu': 1 }
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isEnumMember(parent)) &&
    parent.name === node
  ) {
    return true;
  }

  // JSX ozniteligi: teknik oznitelik degerleri taranmaz.
  const jsxAttribute = ts.isJsxExpression(parent) ? parentOf(parent) : parent;
  if (jsxAttribute !== undefined && ts.isJsxAttribute(jsxAttribute)) {
    return NON_USER_FACING_JSX_ATTRIBUTES.has(jsxAttribute.name.getText());
  }

  return false;
}

function extractFromTypeScript(filePath: string, source: string): ExtractedText[] {
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  );
  const extracted: ExtractedText[] = [];

  const push = (text: string, position: number): void => {
    if (text.trim() === '') return;
    extracted.push({
      text,
      line: sourceFile.getLineAndCharacterOfPosition(position).line + 1,
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isNonUserFacingStringNode(node)) push(node.text, node.getStart(sourceFile));
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (!isDiagnosticArgument(node)) push(node.text, node.getStart(sourceFile));
    } else if (ts.isJsxText(node)) {
      push(node.text, node.getStart(sourceFile));
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return extracted;
}

/** Ayni uzunlukta bosluga cevirir; satir numaralari korunur. */
function blankOut(source: string, pattern: RegExp): string {
  return source.replace(pattern, (chunk) => chunk.replace(/[^\n]/g, ' '));
}

function extractFromHtml(source: string): ExtractedText[] {
  // Yorumlar ve script/style govdeleri kullaniciya donuk metin degildir.
  let cleaned = blankOut(source, /<!--[\s\S]*?-->/g);
  cleaned = blankOut(cleaned, /<script\b[\s\S]*?<\/script>/gi);
  cleaned = blankOut(cleaned, /<style\b[\s\S]*?<\/style>/gi);

  const extracted: ExtractedText[] = [];
  const tagPattern = /<[^>]*>/g;
  let cursor = 0;

  for (const tag of cleaned.matchAll(tagPattern)) {
    const tagText = tag[0];
    const tagStart = tag.index;
    const between = cleaned.slice(cursor, tagStart);
    if (between.trim() !== '') {
      extracted.push({ text: between, line: lineOf(cleaned, cursor) });
    }
    for (const attribute of USER_FACING_HTML_ATTRIBUTES) {
      const attributePattern = new RegExp(`\\b${attribute}\\s*=\\s*"([^"]*)"`, 'gi');
      for (const found of tagText.matchAll(attributePattern)) {
        const value = found[1] ?? '';
        extracted.push({ text: value, line: lineOf(cleaned, tagStart + found.index) });
      }
    }
    cursor = tagStart + tagText.length;
  }

  const tail = cleaned.slice(cursor);
  if (tail.trim() !== '') extracted.push({ text: tail, line: lineOf(cleaned, cursor) });
  return extracted;
}

function extractFromJson(source: string): ExtractedText[] {
  const extracted: ExtractedText[] = [];
  // Nesne ANAHTARLARI (`"ad":`) teknik alan adlaridir; yalnizca degerler taranir.
  for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"(\s*:)?/g)) {
    if (match[2] !== undefined) continue;
    extracted.push({ text: match[1] ?? '', line: lineOf(source, match.index) });
  }
  return extracted;
}

/** Tek bir dosyanin kaynagini tarar (yol filtresi UYGULAMAZ; saf fonksiyon). */
export function scanSource(filePath: string, source: string): AsciiFoldFinding[] {
  const path = toPosixPath(filePath);
  let extracted: ExtractedText[];
  if (path.endsWith('.ts') || path.endsWith('.tsx')) {
    extracted = extractFromTypeScript(path, source);
  } else if (path.endsWith('.html')) {
    extracted = extractFromHtml(source);
  } else if (path.endsWith('.json') || path.endsWith('.webmanifest')) {
    extracted = extractFromJson(source);
  } else {
    return [];
  }

  const suppressed = suppressedLines(source);
  return extracted
    .flatMap((item) => scanExtractedText(path, item))
    .filter((finding) => !suppressed.has(finding.line));
}

/** Susturma isareti tasiyan satirlar: isaretin kendi satiri ve bir SONRAKI satir. */
function suppressedLines(source: string): Set<number> {
  const lines = new Set<number>();
  source.split('\n').forEach((line, index) => {
    if (SUPPRESSION_MARKER.test(line)) {
      lines.add(index + 1);
      lines.add(index + 2);
    }
  });
  return lines;
}

/** Bu yol taranmali mi? (kapsam + dislama listesi) */
export function isScannedFile(filePath: string): boolean {
  const path = toPosixPath(filePath);
  const isInScope = SCAN_TARGETS.some((target) => path === target || path.startsWith(`${target}/`));
  if (!isInScope) return false;
  if (!SUPPORTED_EXTENSIONS.some((extension) => path.endsWith(extension))) return false;
  return !EXCLUDED_PATH_RULES.some((rule) => rule.matches(path));
}

function collectFiles(repoRoot: string, target: string): string[] {
  const absolute = join(repoRoot, target);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return []; // Hedef bu depoda yoksa (ornegin sentetik test deposu) sessizce atlanir.
  }
  if (stats.isFile()) return [target];

  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = `${target}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...collectFiles(repoRoot, child));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

/** Taranacak dosyalarin (depo koku'ne gore) listesi. */
export function collectScannedFiles(repoRoot: string): string[] {
  return SCAN_TARGETS.flatMap((target) => collectFiles(repoRoot, target))
    .map((path) => toPosixPath(relative(repoRoot, join(repoRoot, path))))
    .filter(isScannedFile)
    .sort();
}

/** Tum yuzeyleri tarar; bulgu yoksa bos dizi doner. */
export function scanRepository(repoRoot: string): AsciiFoldFinding[] {
  return collectScannedFiles(repoRoot).flatMap((path) =>
    scanSource(path, readFileSync(join(repoRoot, path), 'utf8')),
  );
}

/** Bulgulari insan okunur rapora cevirir; bulgu yoksa bos dize doner. */
export function formatFindings(findings: readonly AsciiFoldFinding[]): string {
  return findings
    .map(
      (finding) =>
        `${finding.filePath}:${String(finding.line)} — "${finding.match}" ` +
        `(beklenen: "${finding.expected}") | ${finding.snippet}`,
    )
    .join('\n');
}
