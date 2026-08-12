import * as bcrypt from 'bcrypt';
import type { JwtService } from '@nestjs/jwt';
import { ConflictError, UnauthenticatedError } from '../../common/errors/app-error';
import type { UserRecord, UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';

// Testlerde kullanilan sabit parola; gercek bir sir degildir (CLAUDE.md §5).
const PASSWORD = 'gizli-parola-123';
const BCRYPT_COST_PREFIX = '$2b$10$';

function userRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'selin@ornek.test',
    passwordHash: '$2b$10$sabit.test.hash.degeri',
    createdAt: new Date('2026-08-13T10:00:00.000Z'),
    ...overrides,
  };
}

describe('AuthService.register', () => {
  it("parolayi bcrypt ile hash'ler ve duz metni deposuna yazmaz", async () => {
    let storedHash = '';
    const repository = {
      create: jest.fn(async (input: { email: string; passwordHash: string }) => {
        storedHash = input.passwordHash;
        return Promise.resolve(userRecord({ passwordHash: input.passwordHash }));
      }),
      findByEmail: jest.fn(),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, {} as JwtService);

    await service.register({ email: 'selin@ornek.test', password: PASSWORD });

    expect(storedHash).not.toBe(PASSWORD);
    expect(storedHash.startsWith(BCRYPT_COST_PREFIX)).toBe(true);
    await expect(bcrypt.compare(PASSWORD, storedHash)).resolves.toBe(true);
  });

  it("olusturulan kullaniciyi parola hash'i olmadan doner", async () => {
    const created = userRecord();
    const repository = {
      create: jest.fn().mockResolvedValue(created),
      findByEmail: jest.fn(),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, {} as JwtService);

    const result = await service.register({ email: created.email, password: PASSWORD });

    expect(result).toEqual({
      id: created.id,
      email: created.email,
      createdAt: created.createdAt.toISOString(),
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('e-posta zaten kayitliysa depo katmanindan gelen ConflictError yutulmaz', async () => {
    const conflict = new ConflictError('EMAIL_ALREADY_REGISTERED', 'Bu e-posta zaten kayitli.', [
      { field: 'email', message: 'bu e-posta zaten kayitli' },
    ]);
    const repository = {
      create: jest.fn().mockRejectedValue(conflict),
      findByEmail: jest.fn(),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, {} as JwtService);

    await expect(service.register({ email: 'selin@ornek.test', password: PASSWORD })).rejects.toBe(
      conflict,
    );
  });
});

describe('AuthService.login', () => {
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('imzali.jwt.token'),
    decode: jest.fn().mockReturnValue({ iat: 1_000, exp: 605_800 }),
  } as unknown as JwtService;

  it('dogru parola ile erisim tokeni, gecerlilik suresi ve kullaniciyi doner', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const repository = {
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(userRecord({ passwordHash })),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, jwtService);

    const result = await service.login({ email: 'selin@ornek.test', password: PASSWORD });

    expect(result.accessToken).toBe('imzali.jwt.token');
    expect(result.expiresIn).toBe(604_800);
    expect(result.user.email).toBe('selin@ornek.test');
  });

  it('hatali parolada INVALID_CREDENTIALS ile UnauthenticatedError firlatir', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const repository = {
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(userRecord({ passwordHash })),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, jwtService);

    await expect(
      service.login({ email: 'selin@ornek.test', password: 'yanlis-parola-123' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', httpStatus: 401 });
  });

  it('kayitli olmayan e-postada da ayni INVALID_CREDENTIALS hatasini firlatir (kullanici sizdirmaz)', async () => {
    const repository = {
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, jwtService);

    const error: unknown = await service
      .login({ email: 'yok@ornek.test', password: PASSWORD })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthenticatedError);
    expect((error as UnauthenticatedError).code).toBe('INVALID_CREDENTIALS');
    expect((error as UnauthenticatedError).details).toBeUndefined();
  });
});
