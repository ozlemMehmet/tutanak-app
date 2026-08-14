// PublicReportPage (`/t/:token`) — kiracinin hesap acmadan tutanagi goruntuledigi
// SALT-OKUNUR ekran (T-009, design.md → PublicReportPage). AppShell YOKTUR: sayfa
// kimliksizdir ve genelde e-posta/WhatsApp linkinden mobilde acilir.
//
// KAPSAM: bu ekran yalnizca GORUNTULER. Tek tikla onay formu ve onay sonrasi
// SuccessBanner T-010 kapsamindadir ve burada bilerek yoktur.
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { ApiClient } from '../api/client';
import { PhotoGrid } from '../features/photos/PhotoGrid';
import { usePublicReport } from '../features/sharing/usePublicReport';
import { formatStamp } from '../lib/format-timestamp';

interface PublicReportPageProps {
  client: ApiClient;
}

const INVALID_LINK_MESSAGE = 'Bu baglanti gecersiz veya suresi dolmus';
const RATE_LIMITED_MESSAGE = 'Cok fazla istek, birazdan tekrar deneyin';
const GENERIC_ERROR_MESSAGE = 'Tutanak su anda goruntulenemiyor, birazdan tekrar deneyin';

/** Hata ekrani metni sunucu mesajina gore degil, hata KODUNA gore secilir (CLAUDE.md §4.3). */
function errorMessageOf(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'SHARE_LINK_NOT_FOUND' || error.status === 404) {
      return INVALID_LINK_MESSAGE;
    }
    if (error.code === 'RATE_LIMIT_EXCEEDED' || error.status === 429) {
      return RATE_LIMITED_MESSAGE;
    }
  }
  return GENERIC_ERROR_MESSAGE;
}

/** Tam sayfa hata durumu: AppShell'siz, bagimsiz (design.md → FullPageErrorState). */
function FullPageError({ message }: { message: string }): React.JSX.Element {
  return (
    <main className="page public-report public-report--error">
      <p className="banner banner--danger" role="alert">
        {message}
      </p>
    </main>
  );
}

export function PublicReportPage({ client }: PublicReportPageProps): React.JSX.Element {
  const { token } = useParams<{ token: string }>();
  const report = usePublicReport(client, token ?? '');

  if (report.isPending) {
    // Uyari banner'i iskelet asamasinda gosterilmez: metni API'den gelir (design.md).
    return (
      <main className="page public-report">
        <p className="skeleton-text">Tutanak yukleniyor...</p>
      </main>
    );
  }

  if (report.isError) {
    return <FullPageError message={errorMessageOf(report.error)} />;
  }

  const view = report.data;

  return (
    <main className="page public-report">
      {/* Sabit (sticky) uyari banner'i: sayfa kaydirilsa da okunur kalir (design.md, H-11). */}
      <p className="disclaimer-banner" role="note">
        {view.disclaimer}
      </p>

      <header className="public-report__header">
        <h1>{view.title}</h1>
        <p className="public-report__template">{view.templateName}</p>
        <p className="public-report__created">
          Olusturulma: <time dateTime={view.createdAt}>{formatStamp(view.createdAt)}</time>
        </p>
      </header>

      {view.note !== '' && <p className="public-report__note">{view.note}</p>}

      <section className="public-report__photos">
        <h2>Fotograflar</h2>
        {view.photos.length === 0 ? (
          // Paylasim, PDF'ten farkli olarak fotografsiz da yapilabilir; akis engellenmez.
          <p className="empty-state">Bu tutanakta henuz fotograf bulunmuyor</p>
        ) : (
          <PhotoGrid photos={view.photos} />
        )}
      </section>
    </main>
  );
}
