// Yuklenen icerigin GERCEK tipini icerikten (sihirli baytlardan) belirler
// (architecture.md §7): istemcinin `Content-Type` beyanina ve dosya adina GUVENILMEZ.
//
// SAPMA NOTU (devlog'da gerekcelendirildi): CLAUDE.md §6.1 bu is icin `file-type` 19.x
// listeliyor; ancak `file-type` 17+ YALNIZCA ESM yayinliyor, API derlemesi ise CommonJS.
// Jest'in CJS cozumleyicisi paketi hic cozemiyor (test altyapisini experimental ESM
// moduna almadan calistirilamiyor). Tip tespiti bu yuzden zaten zorunlu bagimlilik olan
// `sharp` ile yapiliyor: libvips bicimi DOSYA ICERIGINDEN sniff eder, beyan edilen MIME
// degerini hicbir kod yolunda okumaz — kuralin davranissal karsiligi korunur.

import sharp from 'sharp';
import type { PhotoContentTypeDto } from './dto/photo.dto';

/** Sozlesme + DDL CHECK ile ayni kume; buradaki liste tek dogruluk kaynagidir. */
const CONTENT_TYPE_BY_FORMAT: Record<string, PhotoContentTypeDto> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Depolama anahtarinin uzantisi; kullanici dosya adindan TUREMEZ. */
const EXTENSION_BY_CONTENT_TYPE: Record<PhotoContentTypeDto, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Icerik izin verilen bir goruntu bicimi ise gercek MIME tipini, degilse `null` doner.
 * `null` cagiran tarafta 400 UNSUPPORTED_MEDIA_FORMAT'a cevrilir.
 */
export async function detectPhotoContentType(buffer: Buffer): Promise<PhotoContentTypeDto | null> {
  let format: string;
  try {
    ({ format } = await sharp(buffer).metadata());
  } catch {
    // Cozumlenemeyen icerik = goruntu degil; ham kutuphane hatasi yutulur (CLAUDE.md §4.3).
    return null;
  }
  // Izin kumesinde olmayan bicim (gif, tiff, svg...) reddedilir.
  return CONTENT_TYPE_BY_FORMAT[format] ?? null;
}

export function extensionFor(contentType: PhotoContentTypeDto): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType];
}
