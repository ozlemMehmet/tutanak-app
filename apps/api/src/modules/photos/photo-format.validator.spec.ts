import sharp from 'sharp';
import { detectPhotoContentType, extensionFor } from './photo-format.validator';

type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff';

function image(format: ImageFormat): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 6, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .toFormat(format)
    .toBuffer();
}

describe('detectPhotoContentType', () => {
  it.each<[ImageFormat, string]>([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ])('%s icerigi icin gercek MIME tipini doner', async (format, expected) => {
    await expect(detectPhotoContentType(await image(format))).resolves.toBe(expected);
  });

  it('goruntu olmayan icerik icin null doner', async () => {
    await expect(
      detectPhotoContentType(Buffer.from('bu bir metin dosyasidir')),
    ).resolves.toBeNull();
  });

  it('bos icerik icin null doner', async () => {
    await expect(detectPhotoContentType(Buffer.alloc(0))).resolves.toBeNull();
  });

  it('izin verilmeyen goruntu bicimleri (gif, tiff) icin null doner', async () => {
    await expect(detectPhotoContentType(await image('gif'))).resolves.toBeNull();
    await expect(detectPhotoContentType(await image('tiff'))).resolves.toBeNull();
  });

  it('jpeg sihirli baytini taklit eden ama cozulemeyen veriyi reddeder', async () => {
    // Ilk baytlar JPEG basligina benzetilmis ama gecerli bir goruntu degil.
    const sahte = Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.from('bu aslinda metin')]);

    await expect(detectPhotoContentType(sahte)).resolves.toBeNull();
  });

  it('dosya adi ve beyan edilen MIME degil, YALNIZCA icerik belirleyicidir', async () => {
    // Cagri imzasinda dosya adi/mime yoktur; ayni PNG icerigi hangi adla gelirse gelsin
    // sonuc icerikten belirlenir.
    const png = await image('png');

    await expect(detectPhotoContentType(png)).resolves.toBe('image/png');
  });
});

describe('extensionFor', () => {
  it('her izin verilen MIME tipi icin depolama uzantisini doner', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
  });
});
