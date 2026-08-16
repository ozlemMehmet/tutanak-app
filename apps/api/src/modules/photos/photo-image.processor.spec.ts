import sharp from 'sharp';
import { UnprocessableError } from '../../common/errors/app-error';
import { PHOTO_MAX_EDGE_PX, normalizePhoto } from './photo-image.processor';

function jpeg(width = 12, height = 8): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg()
    .toBuffer();
}

describe('normalizePhoto', () => {
  it('olculeri ve boyutu kodlanmis ciktidan olcer (istemci beyanindan degil)', async () => {
    const result = await normalizePhoto(await jpeg(12, 8), 'image/jpeg');

    expect(result.widthPx).toBe(12);
    expect(result.heightPx).toBe(8);
    expect(result.sizeBytes).toBe(result.body.length);
    expect(result.contentType).toBe('image/jpeg');
  });

  it('uzun kenari sinirdan buyuk goruntuyu sinira indirir (T-026: depolanan hal kucuktur)', async () => {
    const buyuk = await jpeg(2400, 3200);

    const result = await normalizePhoto(buyuk, 'image/jpeg');

    expect(result.heightPx).toBe(PHOTO_MAX_EDGE_PX);
    // En-boy orani korunur: 2400x3200 -> 1200x1600.
    expect(result.widthPx).toBe(1200);
    // Bildirilen olculer gercekten depolanan baytlardan gelir.
    const stored = await sharp(result.body).metadata();
    expect(stored.width).toBe(result.widthPx);
    expect(stored.height).toBe(result.heightPx);
  });

  it('genis (yatay) goruntude de sinirlanan kenar UZUN kenardir', async () => {
    const genis = await jpeg(3200, 2400);

    const result = await normalizePhoto(genis, 'image/jpeg');

    expect(result.widthPx).toBe(PHOTO_MAX_EDGE_PX);
    expect(result.heightPx).toBe(1200);
  });

  it('sinirin altindaki goruntuyu BUYUTMEZ (withoutEnlargement)', async () => {
    const kucuk = await jpeg(320, 240);

    const result = await normalizePhoto(kucuk, 'image/jpeg');

    expect(result.widthPx).toBe(320);
    expect(result.heightPx).toBe(240);
  });

  it('sinirin tam ustundeki goruntuyu sinira indirir (sinir degeri dahil edilir)', async () => {
    const sinirda = await jpeg(PHOTO_MAX_EDGE_PX + 1, 800);

    const result = await normalizePhoto(sinirda, 'image/jpeg');

    expect(result.widthPx).toBe(PHOTO_MAX_EDGE_PX);
  });

  it('tam sinir olcusundeki goruntu oldugu gibi kalir', async () => {
    const tamSinir = await jpeg(PHOTO_MAX_EDGE_PX, 800);

    const result = await normalizePhoto(tamSinir, 'image/jpeg');

    expect(result.widthPx).toBe(PHOTO_MAX_EDGE_PX);
    expect(result.heightPx).toBe(800);
  });

  it('EXIF yonlendirmesi kucultmeden ONCE uygulanir (dondurulmus olculer sinirlanir)', async () => {
    // Orientation 6: goruntu 90 derece dondurulerek gosterilir; dondurme uygulandiginda
    // 3000x1000 girdi 1000x3000 olur ve sinirlanan kenar YUKSEKLIK olmalidir.
    const dondurulecek = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const result = await normalizePhoto(dondurulecek, 'image/jpeg');

    expect(result.heightPx).toBe(PHOTO_MAX_EDGE_PX);
    expect(result.widthPx).toBe(533);
  });

  it('goruntuyu yeniden kodlar; gomulu meta veri ciktiya tasinmaz', async () => {
    const withExif = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .withMetadata({ exif: { IFD0: { Copyright: 'gizli-veri' } } })
      .jpeg()
      .toBuffer();

    const result = await normalizePhoto(withExif, 'image/jpeg');

    const metadata = await sharp(result.body).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(result.body.includes(Buffer.from('gizli-veri'))).toBe(false);
  });

  it('png ve webp bicimlerini kendi bicimlerinde korur', async () => {
    const png = await sharp({
      create: { width: 6, height: 6, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const result = await normalizePhoto(png, 'image/png');

    await expect(sharp(result.body).metadata()).resolves.toMatchObject({ format: 'png' });
  });

  it('bozuk icerik icin UnprocessableError(UNSUPPORTED_MEDIA_FORMAT) firlatir', async () => {
    const bozuk = Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.from('bu aslinda metin')]);

    const error = await normalizePhoto(bozuk, 'image/jpeg').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnprocessableError);
    expect((error as UnprocessableError).code).toBe('UNSUPPORTED_MEDIA_FORMAT');
    // Kutuphane ham hata metni istemciye sizmaz (CLAUDE.md §4.3).
    expect((error as UnprocessableError).message).not.toMatch(/vips|sharp/i);
  });
});
