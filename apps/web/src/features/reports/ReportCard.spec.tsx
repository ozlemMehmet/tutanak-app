// ReportCard (design.md §3 ReportListPage): title, templateName, StatusChip, photoCount,
// createdAt — T-021 kriter 1 ve 8.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Report } from './reports.api';
import { ReportCard } from './ReportCard';

const REPORT: Report = {
  id: 'rapor-1',
  templateId: 'sablon-1',
  templateName: 'Giris/Cikis Teslim Tutanagi',
  title: 'Bahce Kat Teslimi',
  note: '',
  status: 'shared',
  photoCount: 3,
  createdAt: '2026-08-15T09:00:00.000Z',
  updatedAt: '2026-08-15T09:00:00.000Z',
};

function renderCard(report: Report = REPORT): void {
  render(
    <MemoryRouter>
      <ul>
        <ReportCard report={report} />
      </ul>
    </MemoryRouter>,
  );
}

describe('ReportCard', () => {
  it('baslik, sablon adi, durum rozeti ve fotograf sayisini gosterir', () => {
    renderCard();

    expect(screen.getByText('Bahce Kat Teslimi')).toBeInTheDocument();
    expect(screen.getByText('Giris/Cikis Teslim Tutanagi')).toBeInTheDocument();
    expect(screen.getByText('Paylasildi')).toBeInTheDocument();
    expect(screen.getByText('3 fotograf')).toBeInTheDocument();
  });

  it('olusturma tarihini okunur bicimde ve makine okunur damgayla gosterir', () => {
    renderCard();

    const stamp = screen.getByText((_content, element) => element?.tagName === 'TIME');
    expect(stamp).toHaveAttribute('dateTime', '2026-08-15T09:00:00.000Z');
    // Bicimleme sunucu damgasini degistirmez; ham ISO metni kullaniciya gosterilmez.
    expect(stamp.textContent).not.toBe('2026-08-15T09:00:00.000Z');
    expect(stamp.textContent).not.toBe('');
  });

  it('fotograf sayisi sifirken de gosterilir', () => {
    renderCard({ ...REPORT, photoCount: 0 });

    expect(screen.getByText('0 fotograf')).toBeInTheDocument();
  });

  it('kartin tamami tutanagin detay rotasina baglanir', () => {
    renderCard();

    expect(screen.getByRole('link', { name: /Bahce Kat Teslimi/ })).toHaveAttribute(
      'href',
      '/reports/rapor-1',
    );
  });
});
