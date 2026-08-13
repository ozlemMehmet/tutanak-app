import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { ReportsRepository } from './reports.repository';

const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';
const PRISMA_INCONSISTENT_COLUMN_DATA = 'P2023';
const CLIENT_VERSION = '6.19.3';

const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';

const STORED_REPORT = {
  id: REPORT_ID,
  ownerId: OWNER_ID,
  templateId: TEMPLATE_ID,
  title: 'Bahcelievler 3+1 cikis teslimi',
  note: 'Salon duvarinda cizik var.',
  status: 'draft' as const,
  createdAt: new Date('2026-08-13T10:00:00.000Z'),
  updatedAt: new Date('2026-08-13T10:00:00.000Z'),
  template: { name: 'Giris/Cikis Teslim Tutanagi' },
  _count: { photos: 0 },
};

const EXPECTED_INCLUDE = {
  template: { select: { name: true } },
  _count: { select: { photos: true } },
};

const EXPECTED_RECORD = {
  id: REPORT_ID,
  ownerId: OWNER_ID,
  templateId: TEMPLATE_ID,
  templateName: 'Giris/Cikis Teslim Tutanagi',
  title: STORED_REPORT.title,
  note: STORED_REPORT.note,
  status: 'draft',
  photoCount: 0,
  createdAt: STORED_REPORT.createdAt,
  updatedAt: STORED_REPORT.updatedAt,
};

function repositoryWith(reportDelegate: unknown): ReportsRepository {
  return new ReportsRepository({
    report: reportDelegate,
    // Prisma'nin dizi bicimli $transaction'i: verilen sorgulari tek islemde kosar.
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  } as unknown as PrismaService);
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('test hatasi', {
    code,
    clientVersion: CLIENT_VERSION,
  });
}

describe('ReportsRepository.createDraft', () => {
  it('sahibi, sablonu, basligi ve notu yazar; durum ve damgalar veritabanindan gelir', async () => {
    const create = jest.fn().mockResolvedValue(STORED_REPORT);

    const result = await repositoryWith({ create }).createDraft({
      ownerId: OWNER_ID,
      templateId: TEMPLATE_ID,
      title: STORED_REPORT.title,
      note: STORED_REPORT.note,
    });

    // Birebir esitlik: `data` YALNIZCA bu dort alani tasir — `status`/`createdAt`
    // gonderilmez, DDL varsayilanlari (draft, now()) sunucuda uretir.
    expect(create).toHaveBeenCalledWith({
      data: {
        ownerId: OWNER_ID,
        templateId: TEMPLATE_ID,
        title: STORED_REPORT.title,
        note: STORED_REPORT.note,
      },
      // Sablon adi ve fotograf sayisi ayni sorgudan gelir (ek gidis-donus yok).
      include: EXPECTED_INCLUDE,
    });
    expect(result).toEqual(EXPECTED_RECORD);
  });

  it('sablon kaydi yoksa (yabanci anahtar ihlali) null doner', async () => {
    const create = jest.fn().mockRejectedValue(prismaError(PRISMA_FOREIGN_KEY_VIOLATION));

    const result = await repositoryWith({ create }).createDraft({
      ownerId: OWNER_ID,
      templateId: TEMPLATE_ID,
      title: 'Sablonsuz tutanak',
      note: '',
    });

    expect(result).toBeNull();
  });

  it('beklenmeyen veritabani hatasini yutmaz', async () => {
    const create = jest.fn().mockRejectedValue(new Error('baglanti koptu'));

    const promise = repositoryWith({ create }).createDraft({
      ownerId: OWNER_ID,
      templateId: TEMPLATE_ID,
      title: 'Tutanak',
      note: '',
    });

    await expect(promise).rejects.toThrow('baglanti koptu');
  });
});

describe('ReportsRepository.findById', () => {
  it('kayit bulunca sahiplik kontrolu icin owner kimligini de tasiyan kaydi doner', async () => {
    const findUnique = jest.fn().mockResolvedValue(STORED_REPORT);

    const result = await repositoryWith({ findUnique }).findById(REPORT_ID);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: REPORT_ID },
      include: EXPECTED_INCLUDE,
    });
    expect(result).toEqual(EXPECTED_RECORD);
  });

  it('kayit yoksa null doner', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);

    const result = await repositoryWith({ findUnique }).findById(REPORT_ID);

    expect(result).toBeNull();
  });

  it('uuid bicimine uymayan kimlikte null doner (sozlesme bu yol icin 400 tanimlamaz)', async () => {
    const findUnique = jest.fn().mockRejectedValue(prismaError(PRISMA_INCONSISTENT_COLUMN_DATA));

    const result = await repositoryWith({ findUnique }).findById('tutanak-42');

    expect(result).toBeNull();
  });

  it('beklenmeyen veritabani hatasini yutmaz', async () => {
    const findUnique = jest.fn().mockRejectedValue(new Error('baglanti koptu'));

    await expect(repositoryWith({ findUnique }).findById(REPORT_ID)).rejects.toThrow(
      'baglanti koptu',
    );
  });
});

describe('ReportsRepository.findManyByOwner', () => {
  const EXPECTED_ORDER = [{ createdAt: 'desc' }, { id: 'desc' }];

  it('yalnizca sahibin kayitlarini en yeniden eskiye ve sayfali sorgular', async () => {
    const findMany = jest.fn().mockResolvedValue([STORED_REPORT]);
    const count = jest.fn().mockResolvedValue(1);

    const result = await repositoryWith({ findMany, count }).findManyByOwner({
      ownerId: OWNER_ID,
      skip: 0,
      take: 20,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: OWNER_ID },
      include: EXPECTED_INCLUDE,
      orderBy: EXPECTED_ORDER,
      skip: 0,
      take: 20,
    });
    // Toplam sayi ayni filtre ile hesaplanir (sayfa disi kayitlar da sayilir).
    expect(count).toHaveBeenCalledWith({ where: { ownerId: OWNER_ID } });
    expect(result).toEqual({ records: [EXPECTED_RECORD], total: 1 });
  });

  it('arama terimi verilince baslik ve notta harf buyuklugunden bagimsiz filtreler', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);

    await repositoryWith({ findMany, count }).findManyByOwner({
      ownerId: OWNER_ID,
      searchTerm: 'kiraci',
      skip: 0,
      take: 20,
    });

    const expectedWhere = {
      ownerId: OWNER_ID,
      OR: [
        { title: { contains: 'kiraci', mode: 'insensitive' } },
        { note: { contains: 'kiraci', mode: 'insensitive' } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('arama terimindeki LIKE joker karakterlerini kacirir (harfi harfine aranir)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);

    await repositoryWith({ findMany, count }).findManyByOwner({
      ownerId: OWNER_ID,
      searchTerm: 'a%b_c\\d',
      skip: 0,
      take: 20,
    });

    // `%`, `_` ve `\` harfi harfine aranmali: her biri `\` ile kacirilir.
    const expectedWhere = {
      ownerId: OWNER_ID,
      OR: [
        { title: { contains: 'a\\%b\\_c\\\\d', mode: 'insensitive' } },
        { note: { contains: 'a\\%b\\_c\\\\d', mode: 'insensitive' } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('eslesme yoksa bos kayit listesi ve sifir toplam doner (hata firlatmaz)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);

    const result = await repositoryWith({ findMany, count }).findManyByOwner({
      ownerId: OWNER_ID,
      searchTerm: 'bulunmayan terim',
      skip: 0,
      take: 20,
    });

    expect(result).toEqual({ records: [], total: 0 });
  });

  it('sayfa atlamasini ve sayfa boyutunu verildigi gibi sorguya tasir', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);

    await repositoryWith({ findMany, count }).findManyByOwner({
      ownerId: OWNER_ID,
      skip: 40,
      take: 20,
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
  });

  it('beklenmeyen veritabani hatasini yutmaz', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('baglanti koptu'));
    const count = jest.fn().mockResolvedValue(0);

    const promise = repositoryWith({ findMany, count }).findManyByOwner({
      ownerId: OWNER_ID,
      skip: 0,
      take: 20,
    });

    await expect(promise).rejects.toThrow('baglanti koptu');
  });
});
