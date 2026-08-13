import { Route, Routes } from 'react-router-dom';
import type { ApiClient } from './api/client';
import { ReportDetailPage } from './pages/ReportDetailPage';

interface AppRoutesProps {
  client: ApiClient;
}

/**
 * MVP rotalari ticket'lariyla birlikte eklenir; bu ticket (T-006) tutanak detayindaki
 * fotograf bolumunu getirir. Giris/kayit/liste ekranlari kendi ticket'larinda baglanir.
 */
export function AppRoutes({ client }: AppRoutesProps): React.JSX.Element {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main className="page">
            <h1>Emlak Teslim Tutanagi</h1>
            <p>Uygulama iskeleti hazir.</p>
          </main>
        }
      />
      <Route path="/reports/:reportId" element={<ReportDetailPage client={client} />} />
    </Routes>
  );
}
