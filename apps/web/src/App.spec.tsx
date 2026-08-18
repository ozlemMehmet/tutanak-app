import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ACCESS_TOKEN_STORAGE_KEY } from './api/access-token';
import { App } from './App';
import type { ApiClient } from './api/client';
import { createSessionStore } from './features/auth/session';
import { ReportDetailPage } from './pages/ReportDetailPage';

describe('App yonlendirmesi', () => {
  const me = {
    id: 'kullanici-1',
    email: 'selin@ornek.com',
    createdAt: '2026-08-01T10:00:00.000Z',
    subscription: {
      status: 'inactive',
      priceAmount: null,
      currency: 'TRY',
      currentPeriodEnd: null,
    },
  };

  // T-020: detay ekrani tutanagi sozlesme sekliyle ceker; baslik artik tutanagin kendi basligidir.
  const reportDetail = {
    id: 'r-1',
    templateId: 'sablon-1',
    templateName: 'Giris/Cikis Teslim Tutanagi',
    title: 'Kadikoy 3+1 teslim tutanagi',
    note: '',
    status: 'draft',
    photoCount: 0,
    createdAt: '2026-08-14T09:00:00.000Z',
    updatedAt: '2026-08-14T09:00:00.000Z',
    photos: [],
  };

  const client = {
    request: jest.fn((path: string) => {
      if (path === '/me') {
        return Promise.resolve(me);
      }
      if (path === '/reports/r-1') {
        return Promise.resolve(reportDetail);
      }
      return Promise.resolve([]);
    }),
  } as unknown as ApiClient;

  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  it('oturum acikken /reports/:reportId adresinde tutanak detayini AppShell icinde acar', async () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-abc');
    window.history.pushState({}, '', '/reports/r-1');

    render(<App client={client} session={createSessionStore(window.localStorage)} />);

    expect(await screen.findByRole('heading', { name: reportDetail.title })).toBeInTheDocument();
    expect(await screen.findByText('selin@ornek.com')).toBeInTheDocument();
  });

  it('oturum yokken korumali adresi giris ekranina dusurur', () => {
    window.history.pushState({}, '', '/reports/r-1');

    render(<App client={client} session={createSessionStore(window.localStorage)} />);

    expect(screen.getByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
    expect(window.location.search).toBe(`?redirectTo=${encodeURIComponent('/reports/r-1')}`);
  });
});

describe('ReportDetailPage', () => {
  const client = { request: jest.fn().mockResolvedValue([]) } as unknown as ApiClient;

  it('rota parametresi yoksa tutanak bulunamadi mesaji gosterir', () => {
    render(
      <MemoryRouter>
        <ReportDetailPage client={client} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Tutanak bulunamadı');
  });
});
