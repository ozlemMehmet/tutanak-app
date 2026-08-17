// Fotografi SUNUCUYA GONDERMEDEN ONCE tarayicida kucultur (T-028 / performance-report.md
// P-01). Sahadan gelen 5-6 MB'lik kare, `POST /reports/{id}/photos` istegine girmeden once
// uzun kenari 1600 px'e indirilir: hem yukleme suresi (mobil sebeke) hem de sunucudaki
// `sharp` girdisi kokten kuculur.
//
// Bu bir GUVENLIK ya da DOGRULUK katmani DEGILDIR, yalnizca bir hizlandirmadir: sunucu
// tarafindaki `normalizePhoto` 1600 px sinirini, bicim dogrulamasini ve boyut sinirini
// uygulamaya AYNEN devam eder (istemciye guvenilmez). Bu yuzden buradaki her hata yolu
// sessizce ORIJINAL dosyaya duser — akis kirilmaz, kullaniciya hata gosterilmez.

/**
 * Uzun kenar siniri. Dogruluk kaynagi SUNUCUDUR
 * (`apps/api/src/modules/photos/photo-image.processor.ts` → `PHOTO_MAX_EDGE_PX`); tarayici
 * kodu o modulu ithal EDEMEZ (ayri dagitim birimi), bu yuzden deger burada yansitilir —
 * `photo-limits.ts`'teki `PHOTO_MAX_PER_REPORT` ile ayni kalip. Iki deger saparsa yalnizca
 * sunucu bir kez daha kucultme yapar; ciktinin dogrulugu degismez.
 */
export const PHOTO_UPLOAD_MAX_EDGE_PX = 1600;

/** Sozlesmenin kabul ettigi bicimler; disindaki hicbir sey DONUSTURULMEZ (sunucu reddetsin). */
const DOWNSCALABLE_CONTENT_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * 1x2 piksellik, EXIF `Orientation=6` tasiyan JPEG. Yonu piksellere uygulayan bir tarayici
 * bunu 2x1 olarak cozer. Gerekce: `imageOrientation: 'from-image'` secenegini YOK SAYAN eski
 * bir tarayicida tuvale cizilen goruntu dondurulmemis olur, cikti ise EXIF tasimaz — yani
 * sunucudaki `.rotate()` de duzeltemez ve dik cekilmis fotograf galeride/PDF'te yan yatardi.
 * Sessiz bozulma yerine kucultmeden vazgecmek icin bu yoklama yapilir (T-028 kriter 3 + 5).
 */
const ORIENTATION_PROBE_JPEG_BASE64 =
  '/9j/4QAiRXhpZgAASUkqAAgAAAABABIBAwABAAAABgAAAAAAAAD/2wBDAP////////////////////////////' +
  '//////////////////////////////////////////////////////////2wBDAf//////////////////////' +
  '////////////////////////////////////////////////////////////////wAARCAACAAEDASIAAhEBAxEB' +
  '/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAA' +
  'AQP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCQAo//2Q==';

/** Tarayicida hic tanimli olmayabilir; DOM tip tanimi bu olasiligi ifade etmez. */
function imageDecoder(): typeof createImageBitmap | undefined {
  return (globalThis as { createImageBitmap?: typeof createImageBitmap }).createImageBitmap;
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

/**
 * Tarayici EXIF yonunu piksellere uyguluyor mu? Sonuc onbelleklenmez: yoklama goruntusu
 * 304 bayttir ve cozulmesi, hemen ardindan gelen ~5 MB'lik fotograf cozmenin yaninda
 * olculemeyecek kadar ucuzdur — onbellek, kazandirmadigi bir durum tutmus olurdu.
 */
async function appliesExifOrientation(decode: typeof createImageBitmap): Promise<boolean> {
  const probe = new Blob([decodeBase64(ORIENTATION_PROBE_JPEG_BASE64)], { type: 'image/jpeg' });
  const bitmap = await decode(probe, { imageOrientation: 'from-image' });
  try {
    return bitmap.width > bitmap.height;
  } finally {
    bitmap.close();
  }
}

function toBlob(canvas: HTMLCanvasElement, contentType: string): Promise<Blob | null> {
  // Kalite parametresi VERILMEZ: sikistirma orani bir urun karari degildir ve bu ticket'in
  // hedefi yalnizca uzun kenardir; tarayicinin varsayilani kullanilir.
  return new Promise((resolve) => {
    canvas.toBlob(resolve, contentType);
  });
}

function encodeDownscaled(bitmap: ImageBitmap, file: File): Promise<Blob | null> | null {
  const scale = PHOTO_UPLOAD_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height);
  // Sinirin altindaki gorsel BUYUTULMEZ: yeniden kodlama ne bayt kazandirir ne kalite.
  if (scale >= 1) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (context === null) {
    return null;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return toBlob(canvas, file.type);
}

/**
 * Fotografi yukleme oncesi kucultur. Kucultemedigi HER durumda (API yok, bicim desteklenmiyor,
 * cozme/kodlama basarisiz) girdiyi OLDUGU GIBI dondurur; hicbir kosulda hata firlatmaz.
 *
 * Olcut PIKSELDIR, bayt DEGIL: yeniden kodlanan kare orijinalden daha fazla bayt tutsa bile
 * (duz renkli buyuk PNG'lerde olur) 1600 px'lik hal gonderilir — sunucudaki `sharp` maliyeti
 * dosya boyutuyla degil COZULEN PIKSEL sayisiyla buyur, P-01'in kok nedeni de budur.
 */
export async function downscalePhotoForUpload(file: File): Promise<File> {
  try {
    const decode = imageDecoder();
    if (decode === undefined || !DOWNSCALABLE_CONTENT_TYPES.includes(file.type)) {
      return file;
    }
    if (!(await appliesExifOrientation(decode))) {
      return file;
    }
    // `imageOrientation: 'from-image'` EXIF yonunu PIKSELLERE uygular; tuval ciktisi meta veri
    // tasimadigi icin sunucudaki `.rotate()` bu dosyada no-op olur ve yon korunur.
    const bitmap = await decode(file, { imageOrientation: 'from-image' });
    try {
      const blob = await encodeDownscaled(bitmap, file);
      if (blob === null) {
        return file;
      }
      return new File([blob], file.name, { type: file.type });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
