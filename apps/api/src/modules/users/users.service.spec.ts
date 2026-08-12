import { UnauthenticatedError } from '../../common/errors/app-error';
import type { UserProfileRecord, UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const DEFAULT_CURRENCY = 'TRY';

function profileRecord(overrides: Partial<UserProfileRecord> = {}): UserProfileRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'selin@ornek.test',
    passwordHash: '$2b$10$sabit.test.hash.degeri',
    createdAt: new Date('2026-08-13T10:00:00.000Z'),
    subscription: null,
    ...overrides,
  };
}

function serviceWith(profile: UserProfileRecord | null): UsersService {
  const repository = {
    findProfileById: jest.fn().mockResolvedValue(profile),
  } as unknown as UsersRepository;
  return new UsersService(repository, DEFAULT_CURRENCY);
}

describe('UsersService.getProfile', () => {
  it('abonelik satiri yokken varsayilan pasif abonelik doner (satir OLUSTURMAZ)', async () => {
    const service = serviceWith(profileRecord());

    const result = await service.getProfile('11111111-1111-4111-8111-111111111111');

    expect(result.subscription).toEqual({
      status: 'inactive',
      priceAmount: null,
      currency: DEFAULT_CURRENCY,
      currentPeriodEnd: null,
    });
  });

  it('mevcut abonelik satirini oldugu gibi doner', async () => {
    const service = serviceWith(
      profileRecord({
        subscription: {
          status: 'active',
          priceAmount: '199.00',
          currency: 'TRY',
          currentPeriodEnd: new Date('2026-09-12T10:00:00.000Z'),
        },
      }),
    );

    const result = await service.getProfile('11111111-1111-4111-8111-111111111111');

    expect(result.subscription).toEqual({
      status: 'active',
      priceAmount: '199.00',
      currency: 'TRY',
      currentPeriodEnd: '2026-09-12T10:00:00.000Z',
    });
  });

  it("profil yanitinda parola hash'i bulunmaz", async () => {
    const service = serviceWith(profileRecord());

    const result = await service.getProfile('11111111-1111-4111-8111-111111111111');

    expect(JSON.stringify(result)).not.toContain('$2b$10$');
    expect(result.email).toBe('selin@ornek.test');
  });

  it('token gecerli ama kullanici artik yoksa UNAUTHENTICATED firlatir', async () => {
    const service = serviceWith(null);

    const error: unknown = await service
      .getProfile('11111111-1111-4111-8111-111111111111')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthenticatedError);
    expect((error as UnauthenticatedError).code).toBe('UNAUTHENTICATED');
  });
});
