import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { PhotosRepository } from './photos.repository';

const PRISMA_INCONSISTENT_COLUMN_DATA = 'P2023';
const CLIENT_VERSION = '6.19.3';

const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const PHOTO_ID = '55555555-5555-4555-8555-555555555555';

const STORED_PHOTO = {
  id: PHOTO_ID,
  reportId: REPORT_ID,
  storageKey: `reports/${REPORT_ID}/abc.jpg`,
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  widthPx: 800,
  heightPx: 600,
  sortOrder: 0,
  capturedAt: new Date('2026-08-13T10:00:00.000Z'),
  createdAt: new Date('2026-08-13T10:00:00.000Z'),
};

const CREATE_INPUT = {
  reportId: REPORT_ID,
  storageKey: STORED_PHOTO.storageKey,
  contentType: 'image/jpeg' as const,
  sizeBytes: 2048,
  widthPx: 800,
  heightPx: 600,
};

interface PhotoDelegateStub {
  aggregate?: jest.Mock;
  create?: jest.Mock;
  count?: jest.Mock;
  findMany?: jest.Mock;
}

/** Transaction geri cagrisi, ayni sahte delegate ile calisir (tek transaction dogrulanir). */
function repositoryWith(options: {
  photo?: PhotoDelegateStub;
  report?: unknown;
  transaction?: jest.Mock;
}): PhotosRepository {
  const photo = options.photo ?? {};
  const prisma = {
    reportPhoto: photo,
    report: options.report,
    $transaction:
      options.transaction ??
      jest.fn((callback: (tx: unknown) => unknown) => callback({ reportPhoto: photo })),
  };
  return new PhotosRepository(prisma as unknown as PrismaService);
}

/** jest.fn() cagri kayitlari tipsizdir; erisim tek noktada daraltilir. */
function firstCallArg(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0]?.[0];
}

describe('PhotosRepository.create', () => {
  it('sort_order degerini mevcut en buyuk + 1 olarak ayni transaction icinde atar', async () => {
    const aggregate = jest.fn().mockResolvedValue({ _max: { sortOrder: 4 } });
    const create = jest.fn().mockResolvedValue({ ...STORED_PHOTO, sortOrder: 5 });
    const transaction = jest.fn((callback: (tx: unknown) => unknown) =>
      callback({ reportPhoto: { aggregate, create } }),
    );

    await repositoryWith({ photo: { aggregate, create }, transaction }).create(CREATE_INPUT);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { ...CREATE_INPUT, sortOrder: 5 },
    });
  });

  it('ilk fotografta sort_order 0 olur', async () => {
    const aggregate = jest.fn().mockResolvedValue({ _max: { sortOrder: null } });
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);

    await repositoryWith({ photo: { aggregate, create } }).create(CREATE_INPUT);

    expect(create).toHaveBeenCalledWith({ data: { ...CREATE_INPUT, sortOrder: 0 } });
  });

  it('capturedAt gondermez — damga veritabani varsayilanindan gelir (CLAUDE.md §3.7)', async () => {
    const aggregate = jest.fn().mockResolvedValue({ _max: { sortOrder: null } });
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);

    await repositoryWith({ photo: { aggregate, create } }).create(CREATE_INPUT);

    const data = (firstCallArg(create) as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty('capturedAt');
    expect(data).not.toHaveProperty('createdAt');
  });

  it('servis sinirina yalnizca PhotoRecord alanlarini tasir', async () => {
    const aggregate = jest.fn().mockResolvedValue({ _max: { sortOrder: null } });
    const create = jest.fn().mockResolvedValue(STORED_PHOTO);

    const record = await repositoryWith({ photo: { aggregate, create } }).create(CREATE_INPUT);

    expect(record).toEqual({
      id: PHOTO_ID,
      reportId: REPORT_ID,
      storageKey: STORED_PHOTO.storageKey,
      contentType: 'image/jpeg',
      sizeBytes: 2048,
      widthPx: 800,
      heightPx: 600,
      capturedAt: STORED_PHOTO.capturedAt,
    });
  });
});

describe('PhotosRepository.findByReport', () => {
  it('fotograflari (sort_order, captured_at) sirasiyla sorgular (CLAUDE.md §3.14)', async () => {
    const findMany = jest.fn().mockResolvedValue([STORED_PHOTO]);

    const result = await repositoryWith({ photo: { findMany } }).findByReport(REPORT_ID);

    expect(findMany).toHaveBeenCalledWith({
      where: { reportId: REPORT_ID },
      orderBy: [{ sortOrder: 'asc' }, { capturedAt: 'asc' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.capturedAt).toEqual(STORED_PHOTO.capturedAt);
  });
});

describe('PhotosRepository.countByReport', () => {
  it('tutanaktaki fotograf sayisini veritabaninda sayar (uygulama icinde sayim yok)', async () => {
    const count = jest.fn().mockResolvedValue(3);

    const result = await repositoryWith({ photo: { count } }).countByReport(REPORT_ID);

    expect(count).toHaveBeenCalledWith({ where: { reportId: REPORT_ID } });
    expect(result).toBe(3);
  });
});

describe('PhotosRepository.findReportForAccess', () => {
  it('sahiplik kontrolu icin yalnizca owner_id ve status okur', async () => {
    const findUnique = jest.fn().mockResolvedValue({ ownerId: OWNER_ID, status: 'draft' });

    const result = await repositoryWith({ report: { findUnique } }).findReportForAccess(REPORT_ID);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: REPORT_ID },
      select: { ownerId: true, status: true },
    });
    expect(result).toEqual({ ownerId: OWNER_ID, status: 'draft' });
  });

  it('uuid bicimine uymayan kimlikte null doner (kayit yok ile ayni anlam)', async () => {
    const findUnique = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Inconsistent column data', {
        code: PRISMA_INCONSISTENT_COLUMN_DATA,
        clientVersion: CLIENT_VERSION,
      }),
    );

    await expect(
      repositoryWith({ report: { findUnique } }).findReportForAccess('tutanak-42'),
    ).resolves.toBeNull();
  });

  it('beklenmeyen veritabani hatasini yutmaz', async () => {
    const findUnique = jest.fn().mockRejectedValue(new Error('baglanti koptu'));

    await expect(
      repositoryWith({ report: { findUnique } }).findReportForAccess(REPORT_ID),
    ).rejects.toThrow('baglanti koptu');
  });
});
