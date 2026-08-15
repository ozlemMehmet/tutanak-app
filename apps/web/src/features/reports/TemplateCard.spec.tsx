// TemplateCard — design.md §3 ReportCreatePage: secilebilir kart, secili durumda `primary`
// renginde 2px kenarlik + `surface-muted` arka plan (T-019 kriter 1-2).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Template } from './reports.api';
import { TemplateCard } from './TemplateCard';

const TEMPLATE: Template = {
  id: 'sablon-1',
  code: 'move_in_out',
  name: 'Giris/Cikis Teslim Tutanagi',
  description: 'Kiraci giris ve cikis teslimleri icin.',
};

function renderCard(isSelected: boolean, onSelect = jest.fn()): { onSelect: jest.Mock } {
  render(
    <ul>
      <TemplateCard template={TEMPLATE} isSelected={isSelected} onSelect={onSelect} />
    </ul>,
  );
  return { onSelect };
}

describe('TemplateCard', () => {
  it('sablon adini ve aciklamasini secilebilir bir secenek olarak sunar', () => {
    renderCard(false);

    const option = screen.getByRole('radio', { name: /Giris\/Cikis Teslim Tutanagi/ });
    expect(option).toBeInTheDocument();
    expect(screen.getByText('Kiraci giris ve cikis teslimleri icin.')).toBeInTheDocument();
  });

  it('tiklandiginda sablon kimligi ile onSelect cagirir', async () => {
    const { onSelect } = renderCard(false);

    await userEvent.click(screen.getByRole('radio', { name: /Giris\/Cikis Teslim Tutanagi/ }));

    expect(onSelect).toHaveBeenCalledWith('sablon-1');
  });

  it('secili degilken secili gorunum sinifini tasimaz', () => {
    renderCard(false);

    expect(screen.getByRole('radio')).not.toBeChecked();
    expect(screen.getByRole('listitem').className).not.toContain('template-card--selected');
  });

  it('secili oldugunda isaretli olur ve secili gorunum sinifini tasir', () => {
    renderCard(true);

    expect(screen.getByRole('radio')).toBeChecked();
    expect(screen.getByRole('listitem').className).toContain('template-card--selected');
  });

  it('secili oldugunda gorsel geri bildirim ikonunu gosterir (design.md mobil notu)', () => {
    renderCard(true);

    expect(screen.getByTestId('sablon-secili-ikonu')).toBeInTheDocument();
  });
});

/**
 * jsdom harici stil dosyasini uygulamaz; kriter 2'deki gorsel sozlesme (2px `primary`
 * kenarlik + `surface-muted` zemin) bu yuzden stil kaynagi uzerinden dogrulanir.
 * Degerler yalnizca token degiskenlerinden gelmelidir (CLAUDE.md tasarim sozlesmesi).
 */
describe('TemplateCard gorsel sozlesmesi (app.css)', () => {
  const css = readFileSync(join(__dirname, '..', '..', 'styles', 'app.css'), 'utf8');

  const blockOf = (selector: string): string => {
    const match = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(css);
    expect(match).not.toBeNull();
    return match?.[1] ?? '';
  };

  it('secili kart 2px kalinliginda kenarlik kullanir', () => {
    expect(blockOf('.template-card')).toMatch(/border:\s*2px solid/);
  });

  it('secili kart kenarligi `primary`, zemini `surface-muted` tokenidir', () => {
    const selected = blockOf('.template-card--selected');

    expect(selected).toMatch(/border-color:\s*var\(--color-primary\)/);
    expect(selected).toMatch(/background:\s*var\(--color-surface-muted\)/);
  });

  it('secili gorunumde ham hex deger kullanmaz', () => {
    expect(blockOf('.template-card--selected')).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
