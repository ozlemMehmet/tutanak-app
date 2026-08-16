// T-025 kriteri: uretim kaynaklarinda gomulu bcrypt hash literal'i kalmaz.
// Regresyon koruma amaci: `auth.service.ts`'teki dummy hash literal'i SonarCloud tarafindan
// "gomulu parola hash'i" olarak isaretlenip New Code icin E Security Rating uretiyordu.
// Literal acilista uretilen degerle degistirildi; bu test literal'in geri sizmasini yakalar.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(__dirname, '..');

/** Taranan uretim kaynak agaclari (test dosyalari haric tutulur). */
const SOURCE_ROOTS = [join('apps', 'api', 'src'), join('apps', 'web', 'src')];

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** bcrypt hash onekleri: $2a$, $2b$, $2y$. */
const BCRYPT_HASH_LITERAL = /\$2[aby]\$/;

/** Test dosyalari fixture olarak hash benzeri sabit tasiyabilir; tarama disidir. */
function isTestFile(absolutePath: string): boolean {
  const relativePath = relative(REPO_ROOT, absolutePath);
  return (
    relativePath.endsWith('.spec.ts') ||
    relativePath.endsWith('.spec.tsx') ||
    relativePath.split(sep).includes('test') ||
    relativePath.split(sep).includes('__tests__')
  );
}

function productionSourceFiles(): string[] {
  return SOURCE_ROOTS.flatMap((root) =>
    readdirSync(join(REPO_ROOT, root), { recursive: true, withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)),
      )
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((file) => !isTestFile(file)),
  );
}

describe('Gomulu bcrypt hash literal taramasi (T-025)', () => {
  const files = productionSourceFiles();

  it('tarama gercekten kaynak dosya goruyor (bos tarama yanlis yesil vermez)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('hicbir uretim kaynak dosyasinda bcrypt hash literal i yoktur', () => {
    const offenders = files
      .filter((file) => BCRYPT_HASH_LITERAL.test(readFileSync(file, 'utf8')))
      .map((file) => relative(REPO_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
