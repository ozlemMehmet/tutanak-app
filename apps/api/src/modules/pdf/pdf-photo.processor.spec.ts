import sharp from 'sharp';
import { PDF_PHOTO_MAX_EDGE_PX, shrinkPhotoForPdf } from './pdf-photo.processor';

function imageBytes(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp' = 'jpeg',
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .toFormat(format)
    .toBuffer();
}

describe('shrinkPhotoForPdf', () => {
  it('uzun kenari sinirdan buyuk goruntuyu sinira kucultur', async () => {
    const buyuk = await imageBytes(PDF_PHOTO_MAX_EDGE_PX + 400, 900);

    const { width, height } = await sharp(await shrinkPhotoForPdf(buyuk)).metadata();

    expect(width).toBe(PDF_PHOTO_MAX_EDGE_PX);
    expect(height).toBeLessThan(900);
  });

  it('sinirin altindaki goruntuyu BUYUTMEZ (olculeri korur)', async () => {
    const kucuk = await imageBytes(320, 240);

    const { width, height } = await sharp(await shrinkPhotoForPdf(kucuk)).metadata();

    expect(width).toBe(320);
    expect(height).toBe(240);
  });

  it('webp fotografi PDF-e gomulebilen jpeg bicimine cevirir', async () => {
    const webp = await imageBytes(200, 150, 'webp');

    const { format } = await sharp(await shrinkPhotoForPdf(webp)).metadata();

    expect(format).toBe('jpeg');
  });

  it('saydam png fotografi de jpeg olarak doner (saydamlik duz zemine indirilir)', async () => {
    const saydam = await sharp({
      create: { width: 100, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const { format, channels } = await sharp(await shrinkPhotoForPdf(saydam)).metadata();

    expect(format).toBe('jpeg');
    expect(channels).toBe(3);
  });
});
