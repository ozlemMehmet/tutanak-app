// T-028 (perf raporu P-01): fotograf, POST /reports/{id}/photos istegi yapilmadan ONCE
// tarayicida kucultulur. Testler tarayicinin goruntu API'sini (createImageBitmap + canvas)
// TAKLIT eder: jsdom bu API'lari saglamaz. Taklit eden sey KODLAYICI (encoder), olculen sey
// bizim mantigimizdir — hangi olculere inildigi, hangi dosyanin gonderildigi ve her hata
// yolunda orijinale dusuldugu. Gercek tarayici (Chrome) dogrulamasi devlog'dadir.
import { PHOTO_UPLOAD_MAX_EDGE_PX, downscalePhotoForUpload } from './downscale-photo';

interface Size {
  width: number;
  height: number;
}

interface FakeBitmap extends Size {
  close: jest.Mock;
}

interface DecodeRequest {
  source: 'fotograf' | 'yoklama';
  options: ImageBitmapOptions | undefined;
}

/**
 * Sonucu SERILESTIRILEBILIR bicimde ozetler. Gerekce: jsdom `File` nesnesini bir assert'e
 * dogrudan vermek, test KIRILDIGINDA jest'in derin kopyalayicisini cokertiyor (okunamaz
 * cikti); bu yuzden karsilastirma dosya kimligi uzerinden degil, ozet uzerinden yapilir.
 */
function outcome(result: File, original: File): 'orijinal' | 'kucultulmus' {
  return result === original ? 'orijinal' : 'kucultulmus';
}

interface CanvasProbe {
  /** `drawImage`'a gecilen HEDEF olculer — goruntunun gercekten indirildigi olcu budur. */
  drawn: Size[];
  /** Her kodlama (`toBlob`) cagrisi: tuval olculeri + istenen bicim. */
  encoded: { size: Size; contentType: string }[];
}

interface CanvasStubOptions {
  /** 2d baglami alinamayan tarayici benzetimi. */
  contextUnavailable?: boolean;
  /** Kodlayici benzetimi; varsayilan JPEG mertebesinde bayt uretir. */
  encode?: (size: Size, contentType: string) => Blob | null;
}

/** Kodlayici benzetimi: tuvale cizilen piksel basina sabit bayt uretir (JPEG mertebesi). */
const SIMULATED_BYTES_PER_PIXEL = 0.25;

/** EXIF yonunu uygulayan tarayicida yoklama goruntusu (1x2, Orientation=6) 2x1 cozulur. */
const PROBE_ROTATED: Size = { width: 2, height: 1 };
const PROBE_UNROTATED: Size = { width: 1, height: 2 };

const BIG_PHOTO_BYTES = 5_000_000;

function photoFile(name = 'kamera.jpg', type = 'image/jpeg', bytes = BIG_PHOTO_BYTES): File {
  return new File([new ArrayBuffer(bytes)], name, { type });
}

/**
 * Tarayici benzetimi: `createImageBitmap` yuklenen dosya icin `decoded` olculerini,
 * yoklama goruntusu (File OLMAYAN Blob) icin `probe` olculerini doner.
 */
function stubImageDecoding(
  decoded: Size,
  probe: Size = PROBE_ROTATED,
): { requests: DecodeRequest[]; bitmaps: FakeBitmap[] } {
  const bitmaps: FakeBitmap[] = [];
  const requests: DecodeRequest[] = [];
  const decode = (source: Blob, options?: ImageBitmapOptions): Promise<FakeBitmap> => {
    const isPhoto = source instanceof File;
    requests.push({ source: isPhoto ? 'fotograf' : 'yoklama', options });
    const bitmap: FakeBitmap = { ...(isPhoto ? decoded : probe), close: jest.fn() };
    bitmaps.push(bitmap);
    return Promise.resolve(bitmap);
  };
  Object.defineProperty(globalThis, 'createImageBitmap', { value: decode, configurable: true });
  return { requests, bitmaps };
}

/**
 * Tuval benzetimi: eleman GERCEK jsdom `<canvas>`'idir (olculeri gercekten tasir), yalnizca
 * jsdom'da uygulanmayan iki uc nokta (`getContext`, `toBlob`) taklit edilir.
 */
function stubCanvas(options: CanvasStubOptions = {}): CanvasProbe {
  const probe: CanvasProbe = { drawn: [], encoded: [] };
  const context = {
    drawImage: (_bitmap: unknown, _x: number, _y: number, width: number, height: number): void => {
      probe.drawn.push({ width, height });
    },
  };
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(
      options.contextUnavailable === true ? null : (context as unknown as CanvasRenderingContext2D),
    );
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    contentType,
  ) {
    const size: Size = { width: this.width, height: this.height };
    probe.encoded.push({ size, contentType: String(contentType) });
    const encode = options.encode ?? jpegLikeBlob;
    callback(encode(size, String(contentType)));
  });
  return probe;
}

function jpegLikeBlob(size: Size, contentType: string): Blob {
  const bytes = Math.round(size.width * size.height * SIMULATED_BYTES_PER_PIXEL);
  return new Blob([new ArrayBuffer(bytes)], { type: contentType });
}

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'createImageBitmap');
});

describe('downscalePhotoForUpload', () => {
  it('uzun kenari sinirdan buyuk fotografi 1600 px e indirir (dik fotograf)', async () => {
    stubImageDecoding({ width: 2400, height: 3200 });
    const canvas = stubCanvas();

    const result = await downscalePhotoForUpload(photoFile());

    expect(canvas.drawn).toEqual([{ width: 1200, height: 1600 }]);
    expect(canvas.encoded[0]?.size).toEqual({ width: 1200, height: 1600 });
    expect(Math.max(1200, 1600)).toBeLessThanOrEqual(PHOTO_UPLOAD_MAX_EDGE_PX);
    expect(result.size).toBeLessThan(BIG_PHOTO_BYTES);
  });

  it('yatay fotografta da sinirlanan kenar UZUN kenardir', async () => {
    stubImageDecoding({ width: 3200, height: 2400 });
    const canvas = stubCanvas();

    await downscalePhotoForUpload(photoFile());

    expect(canvas.drawn).toEqual([{ width: 1600, height: 1200 }]);
  });

  it('gonderilen govde belirgin sekilde kuculur (2400x3200 / ~5 MB girdi)', async () => {
    stubImageDecoding({ width: 2400, height: 3200 });
    stubCanvas();
    const original = photoFile();

    const result = await downscalePhotoForUpload(original);

    expect(outcome(result, original)).toBe('kucultulmus');
    expect(result.size).toBeLessThan(original.size / 2);
  });

  it('dosya adini ve icerik turunu korur (sunucu sozlesmesi degismez)', async () => {
    stubImageDecoding({ width: 2400, height: 3200 });
    stubCanvas();

    const result = await downscalePhotoForUpload(photoFile('saha-1.jpg'));

    expect(result.name).toBe('saha-1.jpg');
    expect(result.type).toBe('image/jpeg');
  });

  it('cikti bicimi girdi bicimiyle AYNI kalir (png -> png)', async () => {
    stubImageDecoding({ width: 2400, height: 3200 });
    const canvas = stubCanvas();

    const result = await downscalePhotoForUpload(photoFile('plan.png', 'image/png'));

    expect(canvas.encoded[0]?.contentType).toBe('image/png');
    expect(result.type).toBe('image/png');
  });

  it('sinirdan kucuk gorseli BUYUTMEZ, orijinal dosyayi dokunmadan doner', async () => {
    stubImageDecoding({ width: 800, height: 600 });
    const canvas = stubCanvas();
    const original = photoFile();

    const result = await downscalePhotoForUpload(original);

    expect(outcome(result, original)).toBe('orijinal');
    expect(canvas.encoded).toEqual([]);
  });

  it('tam sinirdaki gorseli yeniden kodlamaz', async () => {
    stubImageDecoding({ width: 1200, height: PHOTO_UPLOAD_MAX_EDGE_PX });
    const canvas = stubCanvas();
    const original = photoFile();

    const result = await downscalePhotoForUpload(original);

    expect(outcome(result, original)).toBe('orijinal');
    expect(canvas.encoded).toEqual([]);
  });

  it('EXIF yonlendirmesini piksellere uygulatarak cozer', async () => {
    const { requests } = stubImageDecoding({ width: 2400, height: 3200 });
    stubCanvas();

    await downscalePhotoForUpload(photoFile());

    expect(requests).toEqual([
      { source: 'yoklama', options: { imageOrientation: 'from-image' } },
      { source: 'fotograf', options: { imageOrientation: 'from-image' } },
    ]);
  });

  it('EXIF yonunu uygulamayan tarayicida orijinali gonderir (yon bozulmasin)', async () => {
    stubImageDecoding({ width: 2400, height: 3200 }, PROBE_UNROTATED);
    const canvas = stubCanvas();
    const original = photoFile();

    const result = await downscalePhotoForUpload(original);

    expect(outcome(result, original)).toBe('orijinal');
    expect(canvas.encoded).toEqual([]);
  });

  it('cozulen bitmap serbest birakilir (bellek sizmaz)', async () => {
    const { bitmaps } = stubImageDecoding({ width: 2400, height: 3200 });
    stubCanvas();

    await downscalePhotoForUpload(photoFile());

    expect(bitmaps).toHaveLength(2);
    for (const bitmap of bitmaps) {
      expect(bitmap.close).toHaveBeenCalled();
    }
  });

  it('yeniden kodlanan kare daha COK bayt tutsa bile 1600 px hali gonderilir', async () => {
    // Duz renkli buyuk PNG'lerde tuval ciktisi orijinalden buyuk olabilir; olcut PIKSELDIR:
    // sunucudaki `sharp` maliyeti dosya boyutuyla degil COZULEN PIKSEL sayisiyla buyur.
    stubImageDecoding({ width: 2400, height: 3200 });
    const canvas = stubCanvas({
      encode: (_size, contentType) =>
        new Blob([new ArrayBuffer(BIG_PHOTO_BYTES + 1)], { type: contentType }),
    });
    const original = photoFile('plan.png', 'image/png');

    const result = await downscalePhotoForUpload(original);

    expect(outcome(result, original)).toBe('kucultulmus');
    expect(canvas.drawn).toEqual([{ width: 1200, height: 1600 }]);
  });

  describe('kucultme yapilamadiginda orijinal dosya yuklenir (akis kirilmaz)', () => {
    it('tarayici createImageBitmap desteklemiyorsa', async () => {
      const original = photoFile();

      const result = await downscalePhotoForUpload(original);

      expect(outcome(result, original)).toBe('orijinal');
    });

    it('cozme (decode) hata firlatirsa', async () => {
      Object.defineProperty(globalThis, 'createImageBitmap', {
        value: () => Promise.reject(new Error('bozuk goruntu')),
        configurable: true,
      });
      const original = photoFile();

      const result = await downscalePhotoForUpload(original);

      expect(outcome(result, original)).toBe('orijinal');
    });

    it('2d baglami alinamazsa', async () => {
      stubImageDecoding({ width: 2400, height: 3200 });
      stubCanvas({ contextUnavailable: true });
      const original = photoFile();

      const result = await downscalePhotoForUpload(original);

      expect(outcome(result, original)).toBe('orijinal');
    });

    it('kodlama (toBlob) null donerse', async () => {
      stubImageDecoding({ width: 2400, height: 3200 });
      stubCanvas({ encode: () => null });
      const original = photoFile();

      const result = await downscalePhotoForUpload(original);

      expect(outcome(result, original)).toBe('orijinal');
    });

    it('desteklenmeyen bicimde hic cozmeye kalkismaz (sunucu bicim dogrulamasi calissin)', async () => {
      const { requests } = stubImageDecoding({ width: 2400, height: 3200 });
      const original = photoFile('animasyon.gif', 'image/gif');

      const result = await downscalePhotoForUpload(original);

      expect(outcome(result, original)).toBe('orijinal');
      expect(requests).toEqual([]);
    });
  });
});
