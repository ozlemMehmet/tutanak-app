// Yuklenen goruntuyu yeniden kodlar (architecture.md §7): gomulu EXIF/ek yuk temizlenir,
// EXIF yonlendirmesi piksellere uygulanir ve gercek olculer sunucuda olculur.

import type { FormatEnum } from 'sharp';
import sharp from 'sharp';
import { UnprocessableError } from '../../common/errors/app-error';
import type { PhotoContentTypeDto } from './dto/photo.dto';

const CORRUPT_IMAGE_MESSAGE = 'Fotograf okunamadi; dosya bozuk ya da desteklenmeyen bicimde.';

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
 * Goruntuyu yeniden kodlar. Olculer ve boyut, ISTEMCIDEN gelen degerlerden degil
 * kodlanmis ciktidan okunur — DDL'deki `width_px/height_px/size_bytes` kisitlarinin
 * dogru degerlerle karsilanmasi buna baglidir.
 */
export async function normalizePhoto(
  buffer: Buffer,
  contentType: PhotoContentTypeDto,
): Promise<NormalizedPhoto> {
  try {
    // `.rotate()` argumansiz cagrilinca EXIF yonlendirmesini piksellere uygular;
    // sharp varsayilan olarak meta veriyi ciktiya TASIMAZ.
    const { data, info } = await sharp(buffer)
      .rotate()
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
