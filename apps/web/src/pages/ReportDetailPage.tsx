// ReportDetailPage (design.md §3 ReportDetailPage sartnamesi): baslik + sablon adi +
// durum rozeti + not, fotograf akisi (T-006), PDF indirme (T-007 ucu) ve paylasim paneli
// (T-008). Onaylanmis tutanakta icerik dondurulur: ekleme arayuzu GOSTERILMEZ ve ustte
// onay banner'i cikar (CLAUDE.md §3.10, T-010).
import { useParams } from 'react-router-dom';
import type { ApiClient } from '../api/client';
import { PhotoSection } from '../features/photos/PhotoSection';
import { usePhotos } from '../features/photos/usePhotos';
import type { Approval } from '../features/approvals/approvals.api';
import { StatusChip } from '../features/reports/StatusChip';
import { useDownloadReportPdf } from '../features/reports/useDownloadReportPdf';
import { useReport } from '../features/reports/useReport';
import { SharePanel } from '../features/sharing/SharePanel';
import { formatStamp } from '../lib/format-timestamp';

interface ReportDetailPageProps {
  client: ApiClient;
}

const PDF_ERROR_MESSAGE = 'PDF olusturulamadi, tekrar deneyin';
const NO_PHOTOS_HINT = 'PDF olusturmak icin en az 1 fotograf ekleyin';

/** Onay gorunumu (design.md → SuccessBanner): onaylayan e-posta + sunucu damgasi. */
function ApprovedBanner({ approval }: { approval?: Approval }): React.JSX.Element {
  return (
    <p className="banner banner--success" role="status">
      {approval === undefined
        ? 'Bu tutanak onaylandi'
        : `Bu tutanak onaylandi — ${approval.approverEmail}, ${formatStamp(approval.approvedAt)}`}
    </p>
  );
}

export function ReportDetailPage({ client }: ReportDetailPageProps): React.JSX.Element {
  const { reportId } = useParams<{ reportId: string }>();

  if (reportId === undefined) {
    return (
      <main className="page">
        <p className="banner banner--danger" role="alert">
          Tutanak bulunamadi
        </p>
      </main>
    );
  }

  return <ReportDetailView client={client} reportId={reportId} />;
}

function ReportDetailView({
  client,
  reportId,
}: {
  client: ApiClient;
  reportId: string;
}): React.JSX.Element {
  const report = useReport(client, reportId);
  // Fotograf sayisi PhotoSection ile AYNI sorgu anahtarindan okunur (tek ag cagrisi):
  // yukleme sonrasi liste tazelendigi icin "PDF Indir" butonu da aninda dogru duruma gecer.
  const photos = usePhotos(client, reportId);
  const downloadPdf = useDownloadReportPdf(client, reportId);

  if (report.isPending) {
    return (
      <main className="page">
        <p className="skeleton-text">Tutanak yukleniyor...</p>
      </main>
    );
  }

  if (report.isError) {
    return (
      <main className="page">
        <div className="banner banner--danger" role="alert">
          <p>Tutanak yuklenemedi</p>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              void report.refetch();
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </main>
    );
  }

  const detail = report.data;
  const isApproved = detail.status === 'approved';
  // Fotografsiz tutanaktan PDF uretilemez (sunucu 400 REPORT_HAS_NO_PHOTOS doner); buton
  // disabled oldugu icin bu hata kullaniciya hic yansimaz (design.md).
  const photoCount = photos.data?.length ?? detail.photoCount;
  const hasPhotos = photoCount > 0;

  return (
    <main className="page report-detail">
      {isApproved && <ApprovedBanner approval={detail.approval} />}

      <header className="report-detail__header">
        <h1>{detail.title}</h1>
        <p className="report-detail__template">{detail.templateName}</p>
        <StatusChip status={detail.status} />
        {detail.note !== '' && <p className="report-detail__note">{detail.note}</p>}
      </header>

      <PhotoSection client={client} reportId={reportId} canAddPhoto={!isApproved} />

      <section className="report-actions" aria-label="Tutanak eylemleri">
        <button
          type="button"
          className="button button--primary"
          disabled={!hasPhotos || downloadPdf.isPending}
          onClick={() => {
            downloadPdf.mutate();
          }}
        >
          {downloadPdf.isPending ? 'PDF hazirlaniyor...' : 'PDF Indir'}
        </button>
        {!hasPhotos && <p className="report-actions__hint">{NO_PHOTOS_HINT}</p>}
        {downloadPdf.isError && (
          <p className="toast toast--danger" role="alert">
            {PDF_ERROR_MESSAGE}
          </p>
        )}
      </section>

      <SharePanel client={client} reportId={reportId} />
    </main>
  );
}
