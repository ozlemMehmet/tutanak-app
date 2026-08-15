// Tutanagin fotograf bolumu: listeleme (kabul kriteri 6) + kamera ile ekleme (kriter 7).
// Durumlar (loading / empty / error / success) design.md → ReportDetailPage sartnamesinden gelir.
import type { ApiClient } from '../../api/client';
import { isPhotoLimitReached, photoUploadErrorMessage } from './photo-error-message';
import { isPhotoLimitReachedByCount } from './photo-limits';
import { PhotoCaptureInput } from './PhotoCaptureInput';
import { PhotoGrid } from './PhotoGrid';
import { usePhotos, useUploadPhoto } from './usePhotos';

interface PhotoSectionProps {
  client: ApiClient;
  reportId: string;
  /** Onaylanmis tutanakta icerik dondurulur: ekleme arayuzu hic gosterilmez (CLAUDE.md §3.10). */
  canAddPhoto: boolean;
}

export function PhotoSection({
  client,
  reportId,
  canAddPhoto,
}: PhotoSectionProps): React.JSX.Element {
  const photosQuery = usePhotos(client, reportId);
  const upload = useUploadPhoto(client, reportId);

  const uploadFrame = async (file: File): Promise<void> => {
    await upload.mutateAsync(file);
  };

  // Ust sinir iki yoldan da kapanir: listedeki fotograf sayisi sinira ULASTIGINDA proaktif
  // olarak (T-020 kriter 5) ve sunucudan 409 PHOTO_LIMIT_REACHED geldiginde savunma olarak.
  const isLimitReached =
    isPhotoLimitReachedByCount(photosQuery.data?.length ?? 0) || isPhotoLimitReached(upload.error);

  return (
    <section className="photo-section">
      <h2>Fotograflar</h2>

      {canAddPhoto && (
        <PhotoCaptureInput
          onUpload={uploadFrame}
          isUploading={upload.isPending}
          disabled={isLimitReached}
        />
      )}

      {canAddPhoto && isLimitReached && (
        <p className="photo-section__limit">Bu tutanakta fotograf ust sinirina ulastiniz</p>
      )}

      {upload.isError && (
        <p className="toast toast--danger" role="alert">
          {photoUploadErrorMessage(upload.error)}
        </p>
      )}

      {photosQuery.isPending && <p className="skeleton-text">Fotograflar yukleniyor...</p>}

      {photosQuery.isError && (
        <div className="banner banner--danger" role="alert">
          <p>Fotograflar yuklenemedi</p>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              void photosQuery.refetch();
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {photosQuery.data !== undefined && <PhotoGrid photos={photosQuery.data} />}
    </section>
  );
}
