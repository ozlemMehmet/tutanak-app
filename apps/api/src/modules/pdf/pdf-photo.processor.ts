// Fotografi PDF'e gomulmeden ONCE kucultur ve tek bicime indirir (architecture.md §3:
// "sharp yuklenen fotografi PDF'e gomulmeden once yeniden boyutlandirir, uzun kenar 1600 px"
// — PDF boyutu ve p95 uretim butcesi buna baglidir).

import sharp from 'sharp';
// T-026: sinir degeri TEK KAYNAKTAN gelir. Fotograf zaten YUKLEME aninda bu olcuye
// indirilerek depolandigi icin (`normalizePhoto`) buradaki kucultme cogu fotograf icin
// etkisizdir (`withoutEnlargement`); yine de KALDIRILMAZ — asagidaki bicim/saydamlik
// donusumu zorunludur ve T-026 oncesi yuklenmis buyuk fotograflar hala depoda olabilir.
import { PHOTO_MAX_EDGE_PX } from '../photos/photo-image.processor';

/** Kayipli sikistirma orani: basili belge kalitesi ile dosya boyutu arasindaki denge. */
const PDF_PHOTO_JPEG_QUALITY = 80;

/** Saydam alanlarin indirgendigi zemin: basili belgede zemin beyazdir. */
const FLATTEN_BACKGROUND = { r: 255, g: 255, b: 255 };

/**
 * Goruntuyu PDF'e uygun hale getirir: uzun kenari sinira indirir (kucukse BUYUTMEZ) ve
 * jpeg'e cevirir. Bicim donusumu zorunludur — PDF, depoda izin verilen uc bicimden
 * (jpeg/png/webp) webp'yi TASIYAMAZ; saydamlik da basili belgede karsiligi olmadigi icin
 * duz zemine indirilir.
 */
export function shrinkPhotoForPdf(photo: Buffer): Promise<Buffer> {
  return sharp(photo)
    .resize({
      width: PHOTO_MAX_EDGE_PX,
      height: PHOTO_MAX_EDGE_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: FLATTEN_BACKGROUND })
    .jpeg({ quality: PDF_PHOTO_JPEG_QUALITY })
    .toBuffer();
}
