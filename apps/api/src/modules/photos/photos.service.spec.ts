import {
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../../common/errors/app-error';
import { FakeStorageAdapter } from '../../infra/storage/fake-storage.adapter';
import type { StoragePort } from '../../infra/storage/storage.port';
import type { PhotoRecord, PhotosRepository, ReportAccessRecord } from './photos.repository';
import { PhotosService } from './photos.service';

const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const PHOTO_ID = '55555555-5555-4555-8555-555555555555';
const PHOTO_MAX_PER_REPORT = 30;

const DRAFT_REPORT: ReportAccessRecord = { ownerId: OWNER_ID, status: 'draft' };

const STORED_PHOTO: PhotoRecord = {
  id: PHOTO_ID,
  reportId: REPORT_ID,
  storageKey: `reports/${REPORT_ID}/abc.jpg`,
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  widthPx: 800,
  heightPx: 600,
  capturedAt: new Date('2026-08-13T10:00:00.000Z'),
};

/**
 * Gercek bir JPEG: sihirli bayt dogrulamasi ve `sharp` yeniden kodlamasi bu testlerde
 * SAHTELENMEZ (dogrulama zinciri kabul kriterinin kendisi — sahtelemek testi zayiflatirdi).
 */
async function jpegBuffer(): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({
    create: { width: 8, height: 6, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg()
    .toBuffer();
}

function serviceWith(
  repository: Partial<PhotosRepository>,
  storage: StoragePort = new FakeStorageAdapter(),
): PhotosService {
  return new PhotosService(repository as PhotosRepository, storage, PHOTO_MAX_PER_REPORT);
}

/** jest.fn() cagri kayitlari tipsizdir; erisim tek noktada daraltilir. */
function firstCallArg(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0]?.[0];
}

describe('PhotosService.addPhoto', () => {
  it('gecerli fotografi once depolamaya sonra veritabanina yazar ve Photo yanitini doner', async () => {
    const findReportForAccess = jest.fn().mockResolvedValue(DRAFT_REPORT);
    const countByReport = jest.fn().mockResolvedValue(0);
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);
    const storage = new FakeStorageAdapter();

    const result = await serviceWith(
      { findReportForAccess, countByReport, create },
      storage,
    ).addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() });

    expect(result.id).toBe(PHOTO_ID);
    expect(result.reportId).toBe(REPORT_ID);
    expect(result.capturedAt).toBe('2026-08-13T10:00:00.000Z');
    expect(result.contentType).toBe('image/jpeg');
    expect(result.url).toContain(STORED_PHOTO.storageKey);
    // Once depolama, sonra DB (§4.2.1: yetim kayit yasak).
    expect(storage.storedCount).toBe(1);
  });

  it('capturedAt alanini veritabanina GONDERMEZ (damga sunucu tarafinda uretilir)', async () => {
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);

    await serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      countByReport: jest.fn().mockResolvedValue(0),
      create,
    }).addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() });

    const input: unknown = firstCallArg(create);
    expect(input).not.toHaveProperty('capturedAt');
    expect(input).not.toHaveProperty('sortOrder');
  });

  it('depolama anahtarini sunucuda uretir; kullanici dosya adi kullanilmaz', async () => {
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);
    const storage = new FakeStorageAdapter();

    await serviceWith(
      {
        findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
        countByReport: jest.fn().mockResolvedValue(0),
        create,
      },
      storage,
    ).addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() });

    const key = (firstCallArg(create) as { storageKey: string }).storageKey;
    expect(key).toMatch(new RegExp(`^reports/${REPORT_ID}/[0-9a-f-]{36}\\.jpg$`));
    expect(storage.read(key)?.contentType).toBe('image/jpeg');
  });

  it('yuklenen icerigi yeniden kodlar; gomulu EXIF yuku depolamaya tasinmaz', async () => {
    const sharp = (await import('sharp')).default;
    const withExif = await sharp({
      create: { width: 8, height: 6, channels: 3, background: { r: 5, g: 5, b: 5 } },
    })
      .withMetadata({ exif: { IFD0: { Copyright: 'gizli-veri' } } })
      .jpeg()
      .toBuffer();
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);
    const storage = new FakeStorageAdapter();

    await serviceWith(
      {
        findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
        countByReport: jest.fn().mockResolvedValue(0),
        create,
      },
      storage,
    ).addPhoto(REPORT_ID, OWNER_ID, { buffer: withExif });

    const key = (firstCallArg(create) as { storageKey: string }).storageKey;
    const stored = storage.read(key);
    expect(stored).toBeDefined();
    expect(withExif.includes(Buffer.from('gizli-veri'))).toBe(true);
    // Depolanan govde, istemcinin gonderdigi baytlarin kopyasi degildir.
    expect(stored?.body.includes(Buffer.from('gizli-veri'))).toBe(false);
  });

  it('olculeri ve boyutu istemciden degil kodlanmis ciktidan alarak kaydeder', async () => {
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);

    await serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      countByReport: jest.fn().mockResolvedValue(0),
      create,
    }).addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ widthPx: 8, heightPx: 6, contentType: 'image/jpeg' }),
    );
    const input = firstCallArg(create) as { sizeBytes: number };
    expect(input.sizeBytes).toBeGreaterThan(0);
  });

  it('tutanak yoksa NotFoundError firlatir', async () => {
    const service = serviceWith({ findReportForAccess: jest.fn().mockResolvedValue(null) });

    await expect(
      service.addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('tutanak baskasina aitse ForbiddenError firlatir', async () => {
    const create = jest.fn();
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      countByReport: jest.fn().mockResolvedValue(0),
      create,
    });

    await expect(
      service.addPhoto(REPORT_ID, OTHER_USER_ID, { buffer: await jpegBuffer() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(create).not.toHaveBeenCalled();
  });

  it('tutanak onaylanmissa ConflictError(REPORT_ALREADY_APPROVED) firlatir (kanit butunlugu)', async () => {
    const create = jest.fn();
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue({ ownerId: OWNER_ID, status: 'approved' }),
      countByReport: jest.fn().mockResolvedValue(0),
      create,
    });

    const error = await service
      .addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe('REPORT_ALREADY_APPROVED');
    expect(create).not.toHaveBeenCalled();
  });

  it('paylasilmis (shared) tutanaga yukleme serbesttir', async () => {
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue({ ownerId: OWNER_ID, status: 'shared' }),
      countByReport: jest.fn().mockResolvedValue(0),
      create,
    });

    await expect(
      service.addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() }),
    ).resolves.toHaveProperty('id', PHOTO_ID);
  });

  it('fotograf ust sinirina ulasilmissa ConflictError(PHOTO_LIMIT_REACHED) firlatir', async () => {
    const create = jest.fn();
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      countByReport: jest.fn().mockResolvedValue(PHOTO_MAX_PER_REPORT),
      create,
    });

    const error = await service
      .addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe('PHOTO_LIMIT_REACHED');
    expect(create).not.toHaveBeenCalled();
  });

  it('goruntu olmayan icerik icin UnprocessableError(UNSUPPORTED_MEDIA_FORMAT) firlatir', async () => {
    const create = jest.fn();
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      countByReport: jest.fn().mockResolvedValue(0),
      create,
    });

    const error = await service
      .addPhoto(REPORT_ID, OWNER_ID, { buffer: Buffer.from('bu bir metin dosyasidir') })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnprocessableError);
    expect((error as UnprocessableError).code).toBe('UNSUPPORTED_MEDIA_FORMAT');
    expect(create).not.toHaveBeenCalled();
  });

  it('desteklenen ama izin verilmeyen goruntu bicimi (gif) icin de 400 uretir', async () => {
    const sharp = (await import('sharp')).default;
    const gif = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .gif()
      .toBuffer();
    const create = jest.fn();
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      countByReport: jest.fn().mockResolvedValue(0),
      create,
    });

    await expect(service.addPhoto(REPORT_ID, OWNER_ID, { buffer: gif })).rejects.toBeInstanceOf(
      UnprocessableError,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('depolama yazimi basarisizsa veritabanina satir YAZMAZ (yetim kayit yasak)', async () => {
    const create = jest.fn();
    const failingStorage: StoragePort = {
      putObject: jest
        .fn()
        .mockRejectedValue(new ExternalServiceError('STORAGE_UNAVAILABLE', 'erisilemiyor')),
      createReadUrl: jest.fn(),
    };
    const service = serviceWith(
      {
        findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
        countByReport: jest.fn().mockResolvedValue(0),
        create,
      },
      failingStorage,
    );

    await expect(
      service.addPhoto(REPORT_ID, OWNER_ID, { buffer: await jpegBuffer() }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('PhotosService.listPhotos', () => {
  it('tutanagin tum fotograflarini damgalari ve okuma URL"leriyle doner', async () => {
    const second: PhotoRecord = {
      ...STORED_PHOTO,
      id: '66666666-6666-4666-8666-666666666666',
      storageKey: `reports/${REPORT_ID}/def.jpg`,
      capturedAt: new Date('2026-08-13T10:05:00.000Z'),
    };
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      findByReport: jest.fn().mockResolvedValue([STORED_PHOTO, second]),
    });

    const result = await service.listPhotos(REPORT_ID, OWNER_ID);

    expect(result).toHaveLength(2);
    expect(result.map((photo) => photo.capturedAt)).toEqual([
      '2026-08-13T10:00:00.000Z',
      '2026-08-13T10:05:00.000Z',
    ]);
    expect(result[1]?.url).toContain(second.storageKey);
  });

  it('fotograf yoksa bos dizi doner', async () => {
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      findByReport: jest.fn().mockResolvedValue([]),
    });

    await expect(service.listPhotos(REPORT_ID, OWNER_ID)).resolves.toEqual([]);
  });

  it('baskasinin tutanagini listeleme denemesi ForbiddenError firlatir', async () => {
    const findByReport = jest.fn();
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      findByReport,
    });

    await expect(service.listPhotos(REPORT_ID, OTHER_USER_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(findByReport).not.toHaveBeenCalled();
  });

  it('var olmayan tutanak icin NotFoundError firlatir', async () => {
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(null),
      findByReport: jest.fn(),
    });

    await expect(service.listPhotos(REPORT_ID, OWNER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});
