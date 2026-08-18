// PublicReportPage (`/t/:token`) — kiracinin hesap acmadan tutanagi goruntuledigi ve
// TEK TIKLA onayladigi ekran (T-009 + T-010, design.md → PublicReportPage). AppShell
// YOKTUR: sayfa kimliksizdir ve genelde e-posta/WhatsApp linkinden mobilde acilir.
//
// Tutanak icerigi salt-okunurdur; tek yazma etkilesimi onay formudur. Uyari banner'i
// (H-11) onay bolumunun USTUNDE ve sabit kalir: onay oncesi mutlaka okunur olmalidir.
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { ApiClient } from '../api/client';
import { ApprovalForm } from '../features/approvals/ApprovalForm';
import type { Approval } from '../features/approvals/approvals.api';
import { isAlreadyApprovedError, useApproveReport } from '../features/approvals/useApproveReport';
import { PhotoGrid } from '../features/photos/PhotoGrid';
import { usePublicReport } from '../features/sharing/usePublicReport';
import { formatStamp } from '../lib/format-timestamp';

interface PublicReportPageProps {
  client: ApiClient;
}

const INVALID_LINK_MESSAGE = 'Bu bağlantı geçersiz veya süresi dolmuş';
const RATE_LIMITED_MESSAGE = 'Çok fazla istek, birazdan tekrar deneyin';
const GENERIC_ERROR_MESSAGE = 'Tutanak şu anda görüntülenemiyor, birazdan tekrar deneyin';

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

/** Gecersiz link onay sirasinda da ortaya cikabilir: sayfa tam sayfa hataya gecer. */
function isInvalidLinkError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.code === 'SHARE_LINK_NOT_FOUND' || error.status === 404)
  );
}

/** Onay sonrasi basari banner'i (design.md → SuccessBanner). */
function ApprovalBanner({ approval }: { approval?: Approval }): React.JSX.Element {
  return (
    <p className="banner banner--success" role="status">
      {approval === undefined
        ? 'Onaylandı'
        : `Onaylandı — ${approval.approverEmail}, ${formatStamp(approval.approvedAt)}`}
    </p>
  );
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
  const approve = useApproveReport(client, token ?? '');

  if (report.isPending) {
    // Uyari banner'i iskelet asamasinda gosterilmez: metni API'den gelir (design.md).
    return (
      <main className="page public-report">
        <p className="skeleton-text">Tutanak yükleniyor...</p>
      </main>
    );
  }

  if (report.isError) {
    return <FullPageError message={errorMessageOf(report.error)} />;
  }

  // Onay sirasinda linkin gecersiz cikmasi tutanagi gosterilemez kilar (design.md).
  if (approve.isError && isInvalidLinkError(approve.error)) {
    return <FullPageError message={INVALID_LINK_MESSAGE} />;
  }

  const view = report.data;
  // Onay durumu sunucudan gelir; 409 (zaten onayli) da BASARILI sonuc sayilir.
  const isApproved = view.isApproved || approve.isSuccess || isAlreadyApprovedError(approve.error);
  const approval = view.approval ?? approve.data;

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
          Oluşturulma: <time dateTime={view.createdAt}>{formatStamp(view.createdAt)}</time>
        </p>
      </header>

      {view.note !== '' && <p className="public-report__note">{view.note}</p>}

      <section className="public-report__photos">
        <h2>Fotoğraflar</h2>
        {view.photos.length === 0 ? (
          // Paylasim, PDF'ten farkli olarak fotografsiz da yapilabilir; akis engellenmez.
          <p className="empty-state">Bu tutanakta henüz fotoğraf bulunmuyor</p>
        ) : (
          <PhotoGrid photos={view.photos} />
        )}
      </section>

      <section className="public-report__approval">
        {isApproved ? (
          <ApprovalBanner approval={approval} />
        ) : (
          <ApprovalForm
            onApprove={(approverEmail) => {
              approve.mutate(approverEmail);
            }}
            isPending={approve.isPending}
            error={approve.error}
          />
        )}
      </section>
    </main>
  );
}
