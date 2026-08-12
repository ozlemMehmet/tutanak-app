import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const README_PATH = join(__dirname, '..', 'README.md');

function readReadme(): string {
  return readFileSync(README_PATH, 'utf8');
}

describe('README', () => {
  it('yerelde calistirma adimlarini icerir', () => {
    const readme = readReadme();

    expect(readme).toContain('cp .env.example .env');
    expect(readme).toContain('docker compose up');
    expect(readme).toContain('npm install');
  });

  it('testleri calistirma adimlarini icerir', () => {
    const readme = readReadme();

    expect(readme).toContain('npm run test');
    expect(readme).toContain('npm run test:e2e');
  });

  it('build ve kalite komutlarini icerir', () => {
    const readme = readReadme();

    expect(readme).toContain('npm run build');
    expect(readme).toContain('npm run lint');
  });
});
