// Paylasim paneli davranisi (design.md → ReportDetailPage SharePanel sartnamesi):
// panel acilinca idempotent link uretimi, kopyalama, wa.me butonu, e-posta gonderimi
// (sent/failed) ve link uretim hatasi durumu.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiClient } from '../../api/client';
import { SharePanel } from './SharePanel';

const SHARE_LINK = {
  token: 'AbC123token',
  url: 'https://app.example.com/t/AbC123token',
  whatsAppUrl: 'https://wa.me/?text=merhaba%20https%3A%2F%2Fapp.example.com%2Ft%2FAbC123token',
  createdAt: '2026-08-14T09:00:00.000Z',
};

const SENT_DELIVERY = {
  id: 'd-1',
  channel: 'email',
  recipientEmail: 'kiraci@ornek.test',
  status: 'sent',
  errorMessage: null,
  createdAt: '2026-08-14T09:05:00.000Z',
};

function renderPanel(request: jest.Mock): void {
  const client = { request } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SharePanel client={client} reportId="r-1" />
    </QueryClientProvider>,
  );
}

const openPanel = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Paylaş' }));
};

describe('SharePanel', () => {
  it('panel acilinca paylasim linkini uretir ve link kutusunda gosterir (kriter 1)', async () => {
    const request = jest.fn().mockResolvedValue(SHARE_LINK);
    renderPanel(request);

    await openPanel();

    expect(await screen.findByLabelText('Paylaşım linki')).toHaveValue(SHARE_LINK.url);
    expect(request).toHaveBeenCalledWith('/reports/r-1/share-link', { method: 'POST' });
  });

  it('WhatsApp butonu onceden doldurulmus wa.me adresine gider (kriter 5)', async () => {
    renderPanel(jest.fn().mockResolvedValue(SHARE_LINK));

    await openPanel();

    const whatsAppLink = await screen.findByRole('link', { name: 'WhatsApp ile Paylaş' });
    expect(whatsAppLink).toHaveAttribute('href', SHARE_LINK.whatsAppUrl);
  });

  it('Kopyala butonu linki panoya yazar', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPanel(jest.fn().mockResolvedValue(SHARE_LINK));

    await openPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Kopyala' }));

    expect(writeText).toHaveBeenCalledWith(SHARE_LINK.url);
    expect(await screen.findByText('Kopyalandı')).toBeInTheDocument();
  });

  it.each([
    ['pano API"si reddederse', { writeText: jest.fn().mockRejectedValue(new Error('izin yok')) }],
    ['pano API"si yoksa (guvenli olmayan baglam)', undefined],
  ])('%s kullaniciya uyari gosterir, sessizce yutmaz', async (_ad, clipboard) => {
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
    renderPanel(jest.fn().mockResolvedValue(SHARE_LINK));

    await openPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Kopyala' }));

    expect(await screen.findByText(/Kopyalanamadı/)).toBeInTheDocument();
    expect(screen.queryByText('Kopyalandı')).not.toBeInTheDocument();
  });

  it('link uretimi basarisiz olursa hata banner"i ve Tekrar Dene gosterir (design.md error durumu)', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(new Error('sunucu hatasi'))
      .mockResolvedValue(SHARE_LINK);
    renderPanel(request);

    await openPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('Paylaşım linki oluşturulamadı');
    await userEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));
    expect(await screen.findByLabelText('Paylaşım linki')).toHaveValue(SHARE_LINK.url);
  });

  it('e-posta formu gonderimden ONCE linki (idempotent) yeniden uretir ve sent sonucunu gosterir', async () => {
    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/reports/r-1/share-link') {
        return Promise.resolve(SHARE_LINK);
      }
      return Promise.resolve(SENT_DELIVERY);
    });
    renderPanel(request);

    await openPanel();
    await userEvent.type(await screen.findByLabelText('Alıcı e-posta'), 'kiraci@ornek.test');
    await userEvent.click(screen.getByRole('button', { name: 'E-posta Gönder' }));

    expect(await screen.findByText('E-posta gönderildi (kiraci@ornek.test)')).toBeInTheDocument();
    // Design.md is kurali: e-posta cagrisindan once share-link POST'u (idempotent) yapilir;
    // boylece 404 SHARE_LINK_NOT_FOUND kullaniciya hicbir zaman yansimaz.
    const paths = (request.mock.calls as [string][]).map(([path]) => path);
    const emailIndex = paths.indexOf('/reports/r-1/share-link/email');
    expect(paths.slice(0, emailIndex)).toContain('/reports/r-1/share-link');
  });

  it('gonderim failed dondugunde WARNING tonunda mesaj gosterir; akis durmaz (design.md bilgi durumu)', async () => {
    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/reports/r-1/share-link') {
        return Promise.resolve(SHARE_LINK);
      }
      return Promise.resolve({
        ...SENT_DELIVERY,
        status: 'failed',
        errorMessage: 'E-posta sağlayıcısına ulaşılamadı.',
      });
    });
    renderPanel(request);

    await openPanel();
    await userEvent.type(await screen.findByLabelText('Alıcı e-posta'), 'kiraci@ornek.test');
    await userEvent.click(screen.getByRole('button', { name: 'E-posta Gönder' }));

    const warning = await screen.findByText(/E-postayı gönderemedik/);
    expect(warning).toHaveTextContent('E-posta sağlayıcısına ulaşılamadı.');
    expect(warning).toHaveTextContent(
      'Link her zaman geçerli — WhatsApp veya kopyalama ile paylaşabilirsiniz.',
    );
    // Uyari danger degil warning tonundadir (kullanicinin akisini durdurmamali).
    expect(warning).toHaveClass('toast--warning');
    // Link kutusu ve WhatsApp butonu kullanilabilir kalir.
    expect(screen.getByLabelText('Paylaşım linki')).toHaveValue(SHARE_LINK.url);
  });

  it('istek reddedilirse (orn. 401) hata mesajini danger tonunda gosterir', async () => {
    const request = jest.fn().mockImplementation((path: string) => {
      if (path === '/reports/r-1/share-link') {
        return Promise.resolve(SHARE_LINK);
      }
      return Promise.reject(new Error('Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.'));
    });
    renderPanel(request);

    await openPanel();
    await userEvent.type(await screen.findByLabelText('Alıcı e-posta'), 'kiraci@ornek.test');
    await userEvent.click(screen.getByRole('button', { name: 'E-posta Gönder' }));

    await waitFor(() => {
      expect(screen.getByText('Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.')).toHaveClass(
        'toast--danger',
      );
    });
  });
});
