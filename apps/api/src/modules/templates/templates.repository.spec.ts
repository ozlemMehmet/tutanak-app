import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { TemplatesRepository } from './templates.repository';

const PRISMA_INCONSISTENT_COLUMN_DATA = 'P2023';
const CLIENT_VERSION = '6.19.3';

const STORED_TEMPLATE = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'move_in_out',
  name: 'Giris/Cikis Teslim Tutanagi',
  description: 'Kiraci giris veya cikis teslimi sirasinda mulkun genel durumu.',
  sortOrder: 1,
  createdAt: new Date('2026-08-13T10:00:00.000Z'),
  updatedAt: new Date('2026-08-13T10:00:00.000Z'),
};

function repositoryWith(templateDelegate: unknown): TemplatesRepository {
  return new TemplatesRepository({ template: templateDelegate } as unknown as PrismaService);
}

describe('TemplatesRepository.findAll', () => {
  it('sablonlari sort_order sirasiyla sorgular ve Prisma alanlarini disari sizdirmaz', async () => {
    const findMany = jest.fn().mockResolvedValue([STORED_TEMPLATE]);

    const result = await repositoryWith({ findMany }).findAll();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { sortOrder: 'asc' } });
    expect(result).toEqual([
      {
        id: STORED_TEMPLATE.id,
        code: STORED_TEMPLATE.code,
        name: STORED_TEMPLATE.name,
        description: STORED_TEMPLATE.description,
      },
    ]);
  });
});

describe('TemplatesRepository.findById', () => {
  it('kayit bulunca sablon kaydini doner', async () => {
    const findUnique = jest.fn().mockResolvedValue(STORED_TEMPLATE);

    const result = await repositoryWith({ findUnique }).findById(STORED_TEMPLATE.id);

    expect(findUnique).toHaveBeenCalledWith({ where: { id: STORED_TEMPLATE.id } });
    expect(result).toEqual({
      id: STORED_TEMPLATE.id,
      code: STORED_TEMPLATE.code,
      name: STORED_TEMPLATE.name,
      description: STORED_TEMPLATE.description,
    });
  });

  it('kayit yoksa null doner', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);

    const result = await repositoryWith({ findUnique }).findById(
      '33333333-3333-4333-8333-333333333333',
    );

    expect(result).toBeNull();
  });

  it('uuid bicimine uymayan kimlikte Prisma hatasini yutup null doner', async () => {
    const invalidUuid = new Prisma.PrismaClientKnownRequestError('Inconsistent column data', {
      code: PRISMA_INCONSISTENT_COLUMN_DATA,
      clientVersion: CLIENT_VERSION,
    });
    const findUnique = jest.fn().mockRejectedValue(invalidUuid);

    const result = await repositoryWith({ findUnique }).findById('sablon-42');

    expect(result).toBeNull();
  });

  it('diger veritabani hatalarini oldugu gibi yukari birakir', async () => {
    const failure = new Error('baglanti koptu');
    const findUnique = jest.fn().mockRejectedValue(failure);

    await expect(repositoryWith({ findUnique }).findById(STORED_TEMPLATE.id)).rejects.toBe(failure);
  });
});
