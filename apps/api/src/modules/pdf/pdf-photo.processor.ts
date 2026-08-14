// Fotografi PDF'e gomulmeden ONCE kucultur ve tek bicime indirir (architecture.md §3:
// "sharp yuklenen fotografi PDF'e gomulmeden once yeniden boyutlandirir, uzun kenar 1600 px"
// — PDF boyutu ve p95 uretim butcesi buna baglidir).

import sharp from 'sharp';

/**
 * PDF'e gomulen goruntunun uzun kenar siniri (architecture.md §3). Dagitim yapilandirmasi
 * degil BELGE DUZENI sabitidir: A4 sayfada bundan buyugu ek cozunurluk kazandirmaz,
 * yalnizca dosya boyutunu buyutur. CLAUDE.md §5.1 tablosunda karsiligi yoktur.
 */
export const PDF_PHOTO_MAX_EDGE_PX = 1600;

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
      width: PDF_PHOTO_MAX_EDGE_PX,
      height: PDF_PHOTO_MAX_EDGE_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: FLATTEN_BACKGROUND })
    .jpeg({ quality: PDF_PHOTO_JPEG_QUALITY })
    .toBuffer();
}
