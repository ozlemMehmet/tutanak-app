import { Navigate, Route, Routes } from 'react-router-dom';
import type { ApiClient } from './api/client';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { PublicReportPage } from './pages/PublicReportPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportCreatePage } from './pages/ReportCreatePage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ReportListPage } from './pages/ReportListPage';
import { SubscriptionPage } from './pages/SubscriptionPage';

interface AppRoutesProps {
  client: ApiClient;
}

/**
 * Rota haritasi design.md §1 Ekran Envanteri ile birebirdir (T-017). Ikiye ayrilir:
 * - Genel rotalar: oturum GEREKTIRMEZ — `/login`, `/register` ve kiraci akisi `/t/:token` (H-06).
 * - Korumali rotalar: `RequireAuth` guard'i + ortak `AppShell` duzeni altindadir; token yoksa
 *   `/login`'e yonlendirilir ve hedef rota `redirectTo` olarak korunur.
 *
 * Ekranlarin ICERIGI kendi ticket'larinda doldurulur (T-018..T-022); burada teslim edilen
 * sey o ekranlara ulasilabilmesini saglayan iskelettir.
 */
export function AppRoutes({ client }: AppRoutesProps): React.JSX.Element {
  return (
    <Routes>
      {/* Kok adres kendi basina bir ekran degildir: kimlikli kullanicinin baslangic ekrani
          tutanak listesidir; oturum yoksa guard bunu `/login`'e dusurur. */}
      <Route path="/" element={<Navigate to="/reports" replace />} />

      <Route path="/login" element={<LoginPage client={client} />} />
      <Route path="/register" element={<RegisterPage client={client} />} />
      {/* Paylasim linkinin adresi (`<PUBLIC_APP_URL>/t/<token>`, T-008): kiraci bu rotayi
          hesap acmadan/oturum acmadan acar — AppShell'e bagli DEGILDIR (T-009). */}
      <Route path="/t/:token" element={<PublicReportPage client={client} />} />

      <Route
        element={
          <RequireAuth>
            <AppShell client={client} />
          </RequireAuth>
        }
      >
        <Route path="/reports" element={<ReportListPage client={client} />} />
        <Route path="/reports/new" element={<ReportCreatePage client={client} />} />
        {/* Rota parametresi ReportDetailPage'in mevcut `useParams<{ reportId }>` sozlesmesiyle
            ayni adi tasir; URL bicimi design.md'deki `/reports/:id` ile birebir aynidir. */}
        <Route path="/reports/:reportId" element={<ReportDetailPage client={client} />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
      </Route>
    </Routes>
  );
}
