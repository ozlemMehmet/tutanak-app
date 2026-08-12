import { Prisma } from '@prisma/client';
import { ConflictError } from '../../common/errors/app-error';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { UsersRepository } from './users.repository';

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const CLIENT_VERSION = '6.19.3';

function repositoryWith(userDelegate: unknown): UsersRepository {
  return new UsersRepository({ user: userDelegate } as unknown as PrismaService);
}

describe('UsersRepository.create', () => {
  it("e-posta ve parola hash'ini yazip kullanici kaydini doner", async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'selin@ornek.test',
      passwordHash: '$2b$10$hash',
      createdAt: new Date('2026-08-13T10:00:00.000Z'),
      updatedAt: new Date('2026-08-13T10:00:00.000Z'),
    };
    const create = jest.fn().mockResolvedValue(created);
    const repository = repositoryWith({ create });

    const result = await repository.create({
      email: 'selin@ornek.test',
      passwordHash: '$2b$10$hash',
    });

    expect(create).toHaveBeenCalledWith({
      data: { email: 'selin@ornek.test', passwordHash: '$2b$10$hash' },
    });
    expect(result).toEqual({
      id: created.id,
      email: created.email,
      passwordHash: created.passwordHash,
      createdAt: created.createdAt,
    });
  });

  it('benzersiz e-posta kisiti ihlalinde alan bazli ConflictError firlatir', async () => {
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: PRISMA_UNIQUE_VIOLATION,
      clientVersion: CLIENT_VERSION,
    });
    const repository = repositoryWith({ create: jest.fn().mockRejectedValue(uniqueViolation) });

    const error: unknown = await repository
      .create({ email: 'selin@ornek.test', passwordHash: '$2b$10$hash' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
      httpStatus: 409,
      details: [{ field: 'email', message: 'bu e-posta zaten kayitli' }],
    });
  });

  it('kisit disi veritabani hatalarini oldugu gibi yukari birakir', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Connection lost', {
      code: 'P1001',
      clientVersion: CLIENT_VERSION,
    });
    const repository = repositoryWith({ create: jest.fn().mockRejectedValue(other) });

    await expect(
      repository.create({ email: 'selin@ornek.test', passwordHash: '$2b$10$hash' }),
    ).rejects.toBe(other);
  });
});

describe('UsersRepository.findByEmail', () => {
  it('kayit yoksa null doner', async () => {
    const repository = repositoryWith({ findUnique: jest.fn().mockResolvedValue(null) });

    await expect(repository.findByEmail('yok@ornek.test')).resolves.toBeNull();
  });

  it("kaydi parola hash'i ile birlikte doner (giris dogrulamasi icin gereklidir)", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'selin@ornek.test',
      passwordHash: '$2b$10$hash',
      createdAt: new Date('2026-08-13T10:00:00.000Z'),
      updatedAt: new Date('2026-08-13T10:00:00.000Z'),
    });
    const repository = repositoryWith({ findUnique });

    const result = await repository.findByEmail('selin@ornek.test');

    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'selin@ornek.test' } });
    expect(result?.passwordHash).toBe('$2b$10$hash');
  });
});

describe('UsersRepository.findProfileById', () => {
  it('abonelik satiri yoksa subscription alanini null doner', async () => {
    const repository = repositoryWith({
      findUnique: jest.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'selin@ornek.test',
        passwordHash: '$2b$10$hash',
        createdAt: new Date('2026-08-13T10:00:00.000Z'),
        subscriptions: [],
      }),
    });

    const result = await repository.findProfileById('11111111-1111-4111-8111-111111111111');

    expect(result?.subscription).toBeNull();
  });

  it('abonelik satirini Prisma tipi sizdirmadan sade kayda cevirir', async () => {
    const repository = repositoryWith({
      findUnique: jest.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'selin@ornek.test',
        passwordHash: '$2b$10$hash',
        createdAt: new Date('2026-08-13T10:00:00.000Z'),
        subscriptions: [
          {
            status: 'active',
            priceAmount: new Prisma.Decimal('199.00'),
            currency: 'TRY',
            currentPeriodEnd: new Date('2026-09-12T10:00:00.000Z'),
          },
        ],
      }),
    });

    const result = await repository.findProfileById('11111111-1111-4111-8111-111111111111');

    expect(result?.subscription).toEqual({
      status: 'active',
      priceAmount: '199.00',
      currency: 'TRY',
      currentPeriodEnd: new Date('2026-09-12T10:00:00.000Z'),
    });
  });

  it('kullanici yoksa null doner', async () => {
    const repository = repositoryWith({ findUnique: jest.fn().mockResolvedValue(null) });

    await expect(
      repository.findProfileById('11111111-1111-4111-8111-111111111111'),
    ).resolves.toBeNull();
  });
});
