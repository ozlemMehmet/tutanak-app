// ReportDetailPage (design.md → Ekran Envanteri). Bu ticket YALNIZCA fotograf bolumunu
// uygular (T-006 kabul kriteri 7); PDF indirme T-007'de, paylasim paneli T-008'de,
// baslik/durum rozeti tutanak detayini ceken ticket'ta bu sayfaya eklenir.
import { useParams } from 'react-router-dom';
import type { ApiClient } from '../api/client';
import { PhotoSection } from '../features/photos/PhotoSection';

interface ReportDetailPageProps {
  client: ApiClient;
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

  return (
    <main className="page">
      <h1>Tutanak</h1>
      {/*
        `canAddPhoto` su an sabit: tutanagin durumunu (approved) veren detay cagrisi bu
        sayfaya eklendiginde `status !== 'approved'` ile beslenecek. Onaylanmis tutanakta
        yuklemeyi sunucu zaten 409 REPORT_ALREADY_APPROVED ile reddeder (CLAUDE.md §3.10).
      */}
      <PhotoSection client={client} reportId={reportId} canAddPhoto />
    </main>
  );
}
