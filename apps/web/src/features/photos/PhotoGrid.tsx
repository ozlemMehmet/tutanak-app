// Fotograf izgarasi (design.md → `PhotoGrid` + `PhotoThumbnail`): her karenin uzerinde
// sunucunun urettigi damga bir scrim uzerinde gosterilir (§5 kontrast notu).
import { formatStamp } from '../../lib/format-timestamp';

/**
 * Izgaranin ihtiyac duydugu asgari alanlar: sozlesmedeki `Photo` (tutanak sahibi gorunumu)
 * ve `PublicPhoto` (T-009 oturumsuz gorunum) bu sekle uyar — ayni izgara iki ekranda da
 * kullanilir (design.md: PublicReportPage bilesenleri → PhotoGrid readonly).
 */
export interface PhotoGridItem {
  id: string;
  capturedAt: string;
  url: string;
}

interface PhotoGridProps {
  photos: PhotoGridItem[];
}

export function PhotoGrid({ photos }: PhotoGridProps): React.JSX.Element {
  if (photos.length === 0) {
    return <p className="empty-state">Henuz fotograf eklenmedi</p>;
  }

  return (
    <ul className="photo-grid">
      {photos.map((photo) => (
        <li key={photo.id} className="photo-thumbnail">
          <img src={photo.url} alt="Tutanak fotografi" loading="lazy" />
          <time className="photo-thumbnail__stamp" dateTime={photo.capturedAt}>
            {formatStamp(photo.capturedAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
