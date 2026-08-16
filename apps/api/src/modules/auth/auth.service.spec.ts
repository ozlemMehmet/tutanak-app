import * as bcrypt from 'bcrypt';
import type { JwtService } from '@nestjs/jwt';

// T-015: bcrypt.compare cagrilarini gozlemlemek icin gercek implementasyonu saran mock
// (modul ozellikleri yeniden tanimlanamadigi icin jest.spyOn kullanilamiyor).
jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof bcrypt>('bcrypt');
  const compareImpl = (data: string | Buffer, encrypted: string): Promise<boolean> =>
    actual.compare(data, encrypted);
  return { ...actual, compare: jest.fn(compareImpl) };
});
import { ConflictError, UnauthenticatedError } from '../../common/errors/app-error';
import type { UserRecord, UsersRepository } from '../users/users.repository';
import { AuthService, DUMMY_PASSWORD_HASH } from './auth.service';

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

  // T-016: omur yapilandirmadan gelir; imzalanan token omru ogrenmek icin geri
  // decode EDILMEZ (`decode()` null donebilir -> olasi null dereference).
  it('expiresIn degerini yapilandirilan token omrunden uretir, tokeni decode etmez', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const decode = jest.fn();
    const isolatedJwtService = {
      signAsync: jest.fn().mockResolvedValue('imzali.jwt.token'),
      decode,
    } as unknown as JwtService;
    const repository = {
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(userRecord({ passwordHash })),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, isolatedJwtService, 900);

    const result = await service.login({ email: 'selin@ornek.test', password: PASSWORD });

    expect(result.expiresIn).toBe(900);
    expect(decode).not.toHaveBeenCalled();
  });

  it('token omru verilmediginde yapilandirma varsayilanini (7d) kullanir', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const repository = {
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(userRecord({ passwordHash })),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, jwtService);

    const result = await service.login({ email: 'selin@ornek.test', password: PASSWORD });

    expect(result.expiresIn).toBe(604_800);
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

// T-015: sabit-zamanli dogrulama — bcrypt maliyeti her iki basarisizlik dalinda da odenir.
describe('AuthService.login sabit-zamanli dogrulama (T-015)', () => {
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('imzali.jwt.token'),
    decode: jest.fn().mockReturnValue({ iat: 1_000, exp: 605_800 }),
  } as unknown as JwtService;

  // bcrypt.compare overload'lu (callback + promise); mock tipi promise overload'ina sabitlenir.
  const compareMock = bcrypt.compare as jest.MockedFunction<
    (data: string | Buffer, encrypted: string) => Promise<boolean>
  >;

  beforeEach(() => {
    compareMock.mockClear();
  });

  it("kayitli olmayan e-postada da bcrypt.compare dummy hash'e karsi cagrilir (numaralandirma kapali)", async () => {
    const repository = {
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, jwtService);

    await expect(
      service.login({ email: 'yok@ornek.test', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);

    expect(compareMock).toHaveBeenCalledTimes(1);
    expect(compareMock).toHaveBeenCalledWith(PASSWORD, DUMMY_PASSWORD_HASH);
  });

  it("kayitli kullanicida bcrypt.compare kullanicinin gercek hash'ine karsi cagrilir", async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    compareMock.mockClear(); // hazirlik asamasindaki hash cagrisiyla karismasin
    const repository = {
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(userRecord({ passwordHash })),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, jwtService);

    await service.login({ email: 'selin@ornek.test', password: PASSWORD });

    expect(compareMock).toHaveBeenCalledTimes(1);
    expect(compareMock).toHaveBeenCalledWith(PASSWORD, passwordHash);
  });

  it('dummy hash sabiti cost 10 bcrypt onekine sahiptir (maliyet gercek dogrulamayla esit)', () => {
    expect(DUMMY_PASSWORD_HASH.startsWith(BCRYPT_COST_PREFIX)).toBe(true);
    expect(DUMMY_PASSWORD_HASH).toHaveLength(60); // gecerli bir bcrypt hash uzunlugu
  });

  it('dummy compare sonucu atilir: kayitli olmayan e-posta yine INVALID_CREDENTIALS ile reddedilir', async () => {
    // compare true donse bile kullanici yoksa giris ASLA basarili olmamali.
    compareMock.mockResolvedValueOnce(true);
    const repository = {
      create: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
    } as unknown as UsersRepository;
    const service = new AuthService(repository, jwtService);

    await expect(
      service.login({ email: 'yok@ornek.test', password: PASSWORD }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', httpStatus: 401 });
  });
});

// T-025: dummy hash artik kaynak kodda literal DEGIL, modul yuklenirken uretilir.
describe('DUMMY_PASSWORD_HASH uretimi (T-025)', () => {
  /** Modulu izole bir kayit defterinde yeniden yukleyip o yuklemenin dummy hash'ini doner. */
  async function loadFreshDummyPasswordHash(): Promise<string> {
    let loaded = '';
    await jest.isolateModulesAsync(async () => {
      const freshModule = await import('./auth.service');
      loaded = freshModule.DUMMY_PASSWORD_HASH;
    });
    return loaded;
  }

  it('modul yuklenirken uretilir: iki bagimsiz yukleme farkli hash verir (literal degil)', async () => {
    const first = await loadFreshDummyPasswordHash();
    const second = await loadFreshDummyPasswordHash();

    expect(first).not.toBe(second);
    expect(first).not.toBe(DUMMY_PASSWORD_HASH);
  });

  it('gercek parola dogrulamasiyla ayni cost degeriyle (10) uretilir', () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(10);
  });

  it('gecerli bir bcrypt hash tir: rastgele girdisi hicbir bilinen parolayla eslesmez', async () => {
    await expect(bcrypt.compare(PASSWORD, DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});
