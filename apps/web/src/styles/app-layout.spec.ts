/**
 * H-004 masaustu yerlesim sozlesmesi (kaynak bug: B-004).
 *
 * jsdom harici stil dosyalarini uygulamaz VE yerlesim hesaplamaz (`getBoundingClientRect`
 * her zaman 0 doner), bu yuzden "hesaplanan genislik" kriterleri tarayicida degil stil
 * KAYNAGINDA dogrulanir — kod tabanindaki yerlesik desen budur
 * (bkz. `ReportListPage.spec.tsx` → "ReportListPage gorsel sozlesmesi (app.css)").
 * Olculen degerler ham sayi olarak degil, `tokens.css`teki kirilma noktalariyla
 * karsilastirilarak dogrulanir: boylece test hem kriteri hem token disiplinini korur.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_CSS = stripComments(readFileSync(join(__dirname, 'app.css'), 'utf8'));
const TOKENS_CSS = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

/** H-004 kabul kriteri: masaustu kapsayicisi bu genisligi ASMAZ. */
const MAX_CONTAINER_WIDTH_PX = 960;

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Tek seviye ic ice `{}` iceren `@media` bloklarini yakalar (app.css'te derinlik 1). */
const MEDIA_BLOCK = /@media([^{]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g;

/** Verilen media sorgusuna ait TUM blok govdelerini birlestirip dondurur. */
function mediaBody(query: string): string {
  const bodies: string[] = [];
  for (const match of APP_CSS.matchAll(MEDIA_BLOCK)) {
    if (normalize(match[1] ?? '') === normalize(query)) bodies.push(match[2] ?? '');
  }
  return bodies.join('\n');
}

/** Media sorgusu ICERMEYEN (taban / mobil oncelikli) kurallar. */
function baseCss(): string {
  return APP_CSS.replace(MEDIA_BLOCK, '');
}

/**
 * Verilen secicinin bildirimlerini dondurur. Secici bir grup icinde de yer alabilir
 * (`.photo-section, .share-panel { ... }`), birden fazla kurala dagilmis olabilir.
 */
function declarationsFor(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (match[1] ?? '').split(',').map(normalize);
    if (selectors.includes(selector)) bodies.push(match[2] ?? '');
  }
  return bodies.join(';');
}

/** Bir ozelligin SON degeri (ayni blokta tekrar edilirse cascade sonuncuyu uygular). */
function valueOf(declarations: string, property: string): string | undefined {
  let value: string | undefined;
  const pattern = new RegExp(`[;{]\\s*${property}\\s*:\\s*([^;}]+)`, 'g');
  for (const match of `;${declarations}`.matchAll(pattern)) value = normalize(match[1] ?? '');
  return value;
}

function pxOf(value: string | undefined): number {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value ?? '');
  return match === null ? Number.NaN : Number(match[1]);
}

/** `tokens.css` kirilma noktalarini yorum satirlarindan okur (uretilmis dosya, tek kaynak). */
function breakpointPx(name: string): number {
  const match = new RegExp(`breakpoint ${name}: min-width (\\d+)px`).exec(TOKENS_CSS);
  return match === null ? Number.NaN : Number(match[1]);
}

const MD_BREAKPOINT_PX = breakpointPx('md');
const MD_MEDIA = `(min-width: ${String(MD_BREAKPOINT_PX)}px)`;

/** Butonlarin daraltilmasi gereken tam liste — H-004 kabul kriteri 3. */
const FULL_WIDTH_BUTTONS = ['.subscription__pay', '.auth-form__submit', '.report-create__submit'];

describe('app.css .page kapsayicisi (H-004 kriter 1)', () => {
  const page = declarationsFor(baseCss(), '.page');

  it('masaustunde kapsayici genisligi 960px ustune cikmaz', () => {
    expect(pxOf(valueOf(page, 'max-width'))).toBeLessThanOrEqual(MAX_CONTAINER_WIDTH_PX);
  });

  it('kapsayici genisligi tokens.css kirilma noktasindan gelir (keyfi px degil)', () => {
    expect(MD_BREAKPOINT_PX).toBeGreaterThan(0);
    expect(pxOf(valueOf(page, 'max-width'))).toBe(MD_BREAKPOINT_PX);
  });

  it('kapsayici yatayda ortalanir (sol/sag bosluk esit)', () => {
    expect(valueOf(page, 'margin-inline')).toBe('auto');
  });
});

describe('app.css .page mobil davranisi (H-004 kriter 2 — regresyon)', () => {
  const page = declarationsFor(baseCss(), '.page');

  it('mobil kenar boslugu --space-3 olarak KORUNUR', () => {
    expect(valueOf(page, 'padding')).toBe('var(--space-3)');
  });

  it('alt guvenli alan (safe-area-inset-bottom) payi KORUNUR', () => {
    expect(valueOf(page, 'padding-bottom')).toContain('env(safe-area-inset-bottom)');
  });

  it('kapsayici genisligi md kirilma noktasinin ALTINDA hicbir sinir getirmez', () => {
    // 375px viewport'ta `max-width` devreye girmez: sinir >= md (768px) oldugu surece
    // mobil yerlesim (viewport'u dolduran genislik) aynen kalir.
    expect(pxOf(valueOf(page, 'max-width'))).toBeGreaterThanOrEqual(MD_BREAKPOINT_PX);
  });

  it('kapsayiciya sabit bir width verilmez (mobilde viewport doldurulur)', () => {
    expect(valueOf(page, 'width')).toBeUndefined();
  });
});

describe('app.css birincil buton genisligi (H-004 kriter 3)', () => {
  const wide = mediaBody(MD_MEDIA);

  it.each(FULL_WIDTH_BUTTONS)('%s mobilde tam genislik KALIR', (selector) => {
    expect(valueOf(declarationsFor(baseCss(), selector), 'width')).toBe('100%');
  });

  it.each(FULL_WIDTH_BUTTONS)('%s md ustunde icerik genisligine gore boyutlanir', (selector) => {
    expect(valueOf(declarationsFor(wide, selector), 'width')).toBe('auto');
  });

  it.each(FULL_WIDTH_BUTTONS)('%s md ustunde kapsayicisina gerilmez', (selector) => {
    // Kapsayicilar flex kolon (`align-items: stretch` varsayilani): `width: auto` tek
    // basina yetmez, oge yine kapsayici genisligine gerilirdi.
    expect(valueOf(declarationsFor(wide, selector), 'align-self')).toBe('flex-start');
  });

  it.each(FULL_WIDTH_BUTTONS)('%s md ustunde makul bir min-width korur', (selector) => {
    expect(valueOf(declarationsFor(wide, selector), 'min-width')).toBeDefined();
  });
});

describe('app.css detay bolumu yuzeyleri (H-004 kriter 4)', () => {
  const base = baseCss();
  const elevation1 = valueOf(declarationsFor(base, '.report-card'), 'box-shadow');

  it('referans Elevation 1 golgesi mevcut kartlarda tanimlidir', () => {
    expect(elevation1).toBe('0 1px 2px rgb(0 0 0 / 6%)');
    expect(valueOf(declarationsFor(base, '.status-card'), 'box-shadow')).toBe(elevation1);
  });

  it.each(['.photo-section', '.share-panel'])(
    '%s mevcut kartlarla AYNI Elevation 1 golgesini tasir',
    (selector) => {
      expect(valueOf(declarationsFor(base, selector), 'box-shadow')).toBe(elevation1);
    },
  );

  it.each(['.photo-section', '.share-panel'])('%s kart/panel yuzeyi olarak durur', (selector) => {
    const rule = declarationsFor(base, selector);
    expect(valueOf(rule, 'background')).toBe('var(--color-surface)');
    expect(valueOf(rule, 'border-radius')).toBe('var(--radius-lg)');
    expect(valueOf(rule, 'padding')).toBe('var(--space-3)');
  });
});

describe('app.css genis ekran regresyonu (H-004 kriter 5)', () => {
  const wide = mediaBody(MD_MEDIA);

  it('tutanak kart listesi md ustunde 2 kolon KALIR', () => {
    expect(valueOf(declarationsFor(wide, '.report-card-list'), 'grid-template-columns')).toBe(
      'repeat(2, 1fr)',
    );
  });

  it('FAB md ustunde normal butona DONMEYE devam eder', () => {
    const rule = declarationsFor(wide, '.report-list__new');
    expect(valueOf(rule, 'position')).toBe('static');
    expect(valueOf(rule, 'box-shadow')).toBe('none');
  });
});
