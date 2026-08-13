// Test verisi fabrikasi: fotograf icerigi (CLAUDE.md §8.4 — dosya basina bir varlik).
// Gercek goruntu baytlari uretir; sihirli bayt dogrulamasi ve `sharp` yeniden kodlamasi
// e2e'de SAHTELENMEZ (kabul kriterinin kendisi bu zincirdir).

import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

interface PhotoBytesInput {
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export function createPhotoBytes(input: PhotoBytesInput = {}): Promise<Buffer> {
  return sharp({
    create: {
      width: input.width ?? 16,
      height: input.height ?? 12,
      channels: 3,
      background: { r: 180, g: 40, b: 40 },
    },
  })
    .toFormat(input.format ?? 'jpeg')
    .toBuffer();
}

/**
 * Boyut siniri testleri icin gurultulu (sikismayan) goruntu uretir: duz renkli bir PNG
 * birkac yuz bayta kadar sikistigi icin gercek bir buyuk dosya senaryosunu temsil etmez.
 */
export function createNoisyPhotoBytes(width: number, height: number): Promise<Buffer> {
  const CHANNELS = 3;
  return sharp(randomBytes(width * height * CHANNELS), {
    raw: { width, height, channels: CHANNELS },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
}
