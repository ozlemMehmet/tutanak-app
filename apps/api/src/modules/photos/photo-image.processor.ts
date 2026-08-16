// Yuklenen goruntuyu yeniden kodlar (architecture.md §7): gomulu EXIF/ek yuk temizlenir,
// EXIF yonlendirmesi piksellere uygulanir, uzun kenar sinira indirilir (architecture.md §104)
// ve gercek olculer sunucuda olculur.

import type { FormatEnum } from 'sharp';
import sharp from 'sharp';
import { UnprocessableError } from '../../common/errors/app-error';
import type { PhotoContentTypeDto } from './dto/photo.dto';

const CORRUPT_IMAGE_MESSAGE = 'Fotograf okunamadi; dosya bozuk ya da desteklenmeyen bicimde.';

/**
 * Fotografin uzun kenar siniri — DEPOLANAN hal bu olcudedir (architecture.md §104:
 * "sharp yuklenen fotografi PDF'e gomulmeden once yeniden boyutlandirir (uzun kenar
 * 1600 px) — PDF boyutu ve p95 uretim butcesi (§6) bu sayede tutar").
 *
 * Deger burada TEK KEZ tanimlanir: PDF yolu (`pdf-photo.processor.ts`) ayni sabiti
 * buradan alir, cunku o yol depolanan halin uzerinde calisir — iki ayri "1600" olsaydi
 * biri degistiginde digeri sessizce sapardi. Dagitim yapilandirmasi degil goruntu
 * hattinin sabitidir; CLAUDE.md §5.1 tablosunda karsiligi yoktur (env'den gelmez).
 */
export const PHOTO_MAX_EDGE_PX = 1600;

/** Cikti bicimi girdi bicimiyle ayni tutulur (kayipsiz->kayipli donusum yapilmaz). */
const SHARP_FORMAT_BY_CONTENT_TYPE = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const satisfies Record<PhotoContentTypeDto, keyof FormatEnum>;

export interface NormalizedPhoto {
  body: Buffer;
  contentType: PhotoContentTypeDto;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
}

/**
 * Goruntuyu yeniden kodlar ve uzun kenari `PHOTO_MAX_EDGE_PX`'e indirir. Olculer ve boyut,
 * ISTEMCIDEN gelen degerlerden degil kodlanmis ciktidan okunur — DDL'deki
 * `width_px/height_px/size_bytes` kisitlarinin dogru degerlerle karsilanmasi buna baglidir.
 */
export async function normalizePhoto(
  buffer: Buffer,
  contentType: PhotoContentTypeDto,
): Promise<NormalizedPhoto> {
  try {
    // `.rotate()` argumansiz cagrilinca EXIF yonlendirmesini piksellere uygular;
    // sharp varsayilan olarak meta veriyi ciktiya TASIMAZ. Kucultme dondurmeden SONRA
    // gelir: sinirlanan kenar, kullanicinin gordugu (dondurulmus) uzun kenardir.
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({
        width: PHOTO_MAX_EDGE_PX,
        height: PHOTO_MAX_EDGE_PX,
        fit: 'inside',
        // Kucuk gorseller BUYUTULMEZ: buyutmek ne kalite kazandirir ne de butceye katki.
        withoutEnlargement: true,
      })
      .toFormat(SHARP_FORMAT_BY_CONTENT_TYPE[contentType])
      .toBuffer({ resolveWithObject: true });

    return {
      body: data,
      contentType,
      sizeBytes: info.size,
      widthPx: info.width,
      heightPx: info.height,
    };
  } catch (error: unknown) {
    if (error instanceof UnprocessableError) {
      throw error;
    }
    // Saglayici/kutuphane ham hatasi istemciye sizmaz (CLAUDE.md §4.3).
    throw new UnprocessableError('UNSUPPORTED_MEDIA_FORMAT', CORRUPT_IMAGE_MESSAGE);
  }
}
