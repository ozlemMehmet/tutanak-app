import sharp from 'sharp';
import { UnprocessableError } from '../../common/errors/app-error';
import { normalizePhoto } from './photo-image.processor';

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
