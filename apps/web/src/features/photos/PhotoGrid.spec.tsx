import { render, screen } from '@testing-library/react';
import type { Photo } from './photos.api';
import { PhotoGrid } from './PhotoGrid';

describe('PhotoGrid', () => {
  const photo = (overrides: Partial<Photo> = {}): Photo => ({
    id: 'foto-1',
    reportId: 'r-1',
    capturedAt: '2026-08-13T09:30:00.000Z',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    widthPx: 800,
    heightPx: 600,
    url: 'https://depolama.test/foto-1.jpg',
    ...overrides,
  });

  it('fotograf yokken bos durum metnini gosterir', () => {
    render(<PhotoGrid photos={[]} />);

    expect(screen.getByText('Henuz fotograf eklenmedi')).toBeInTheDocument();
  });

  it('her fotografi kendi damgasiyla birlikte listeler (kabul kriteri 6)', () => {
    const { container } = render(
      <PhotoGrid
        photos={[
          photo(),
          photo({ id: 'foto-2', capturedAt: '2026-08-13T10:45:00.000Z', url: 'https://d/2.jpg' }),
        ]}
      />,
    );

    expect(screen.getAllByRole('img')).toHaveLength(2);
    const stamps = [...container.querySelectorAll('time')];
    expect(stamps).toHaveLength(2);
    expect(stamps[0]).toHaveAttribute('datetime', '2026-08-13T09:30:00.000Z');
    expect(stamps[1]).toHaveAttribute('datetime', '2026-08-13T10:45:00.000Z');
  });

  it('fotograflari ekranda sunucudan geldigi sirada tutar', () => {
    render(<PhotoGrid photos={[photo({ id: 'ilk' }), photo({ id: 'ikinci' })]} />);

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('src', 'https://depolama.test/foto-1.jpg');
    expect(images).toHaveLength(2);
  });
});
