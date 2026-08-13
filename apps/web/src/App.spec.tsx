import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import type { ApiClient } from './api/client';
import { ReportDetailPage } from './pages/ReportDetailPage';

describe('App yonlendirmesi', () => {
  const client = { request: jest.fn().mockResolvedValue([]) } as unknown as ApiClient;

  it('/reports/:reportId adresinde tutanak detayindaki fotograf bolumunu acar', async () => {
    window.history.pushState({}, '', '/reports/r-1');

    render(<App client={client} />);

    expect(await screen.findByRole('heading', { name: 'Tutanak' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Fotograf Ekle')).toBeInTheDocument();
    });
  });

  it('kok adreste uygulama iskeletini gosterir', () => {
    window.history.pushState({}, '', '/');

    render(<App client={client} />);

    expect(screen.getByRole('heading', { name: 'Emlak Teslim Tutanagi' })).toBeInTheDocument();
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

    expect(screen.getByRole('alert')).toHaveTextContent('Tutanak bulunamadi');
  });
});
