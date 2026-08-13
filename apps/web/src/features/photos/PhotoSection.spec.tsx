// Fotograf bolumunun uctan uca davranisi: listeleme (kriter 6), kamera ile ekleme (kriter 7)
// ve tasarim sartnamesindeki hata durumlari (design.md → ReportDetailPage).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import { PhotoSection } from './PhotoSection';
import type { Photo } from './photos.api';

describe('PhotoSection', () => {
  const OBJECT_URL = 'blob:onizleme-1';

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

  const renderSection = (request: jest.Mock, canAddPhoto = true): ReactElement => {
    const client = { request } as unknown as ApiClient;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const ui = (
      <QueryClientProvider client={queryClient}>
        <PhotoSection client={client} reportId="r-1" canAddPhoto={canAddPhoto} />
      </QueryClientProvider>
    );
    render(ui);
    return ui;
  };

  const captureFrame = async (): Promise<void> => {
    await userEvent.upload(
      screen.getByLabelText('Fotograf Ekle'),
      new File(['kare'], 'kamera.jpg', { type: 'image/jpeg' }),
    );
  };

  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn().mockReturnValue(OBJECT_URL),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: jest.fn(), configurable: true });
  });

  it('yuklenirken iskelet durumu gosterir', () => {
    renderSection(jest.fn().mockReturnValue(new Promise(() => undefined)));

    expect(screen.getByText('Fotograflar yukleniyor...')).toBeInTheDocument();
  });

  it('tutanagin fotograflarini damgalariyla listeler', async () => {
    renderSection(jest.fn().mockResolvedValue([photo(), photo({ id: 'foto-2' })]));

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(2);
    });
  });

  it('liste cekilemezse hata banner"i ve tekrar deneme sunar', async () => {
    const request = jest.fn().mockRejectedValue(new ApiError('INTERNAL_ERROR', 'patladi', 500));
    renderSection(request);

    expect(await screen.findByRole('alert')).toHaveTextContent('Fotograflar yuklenemedi');
    request.mockResolvedValue([photo()]);
    await userEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });
  });

  it('cekilen kare yuklendiginde listeye sunucudan gelen damgasiyla eklenir', async () => {
    const request = jest.fn().mockResolvedValueOnce([]);
    renderSection(request);
    await screen.findByText('Henuz fotograf eklenmedi');

    request.mockResolvedValueOnce(photo()).mockResolvedValue([photo()]);
    await captureFrame();
    await userEvent.click(screen.getByRole('button', { name: 'Yukle' }));

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });
    const [path, init] = request.mock.calls[1] as [string, RequestInit];
    expect(path).toBe('/reports/r-1/photos');
    expect(init.method).toBe('POST');
  });

  it('desteklenmeyen formatta tasarim sartnamesindeki uyariyi gosterir', async () => {
    const request = jest.fn().mockResolvedValueOnce([]);
    renderSection(request);
    await screen.findByText('Henuz fotograf eklenmedi');

    request.mockRejectedValueOnce(new ApiError('UNSUPPORTED_MEDIA_FORMAT', 'sunucu metni', 400));
    await captureFrame();
    await userEvent.click(screen.getByRole('button', { name: 'Yukle' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Desteklenmeyen dosya turu');
  });

  it('ust sinira ulasilinca kamera girisi devre disi kalir', async () => {
    const request = jest.fn().mockResolvedValueOnce([]);
    renderSection(request);
    await screen.findByText('Henuz fotograf eklenmedi');

    request.mockRejectedValueOnce(new ApiError('PHOTO_LIMIT_REACHED', 'sinir doldu', 409));
    await captureFrame();
    await userEvent.click(screen.getByRole('button', { name: 'Yukle' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Fotograf Ekle')).toBeDisabled();
    });
  });

  it('tutanak onaylandiginda fotograf ekleme arayuzu hic gosterilmez', async () => {
    renderSection(jest.fn().mockResolvedValue([photo()]), false);

    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });
    expect(screen.queryByLabelText('Fotograf Ekle')).not.toBeInTheDocument();
  });
});
