import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { UnauthenticatedError } from '../errors/app-error';
import { JwtAuthGuard } from './jwt-auth.guard';

class TestController {
  handle(): void {
    // Reflector'a verilecek gercekci bir controller sinifi; govdesi testte kullanilmaz.
  }
}

function executionContext(): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => TestController,
  } as unknown as ExecutionContext;
}

function guardWith(isPublic: boolean): JwtAuthGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  return new JwtAuthGuard(reflector);
}

describe('JwtAuthGuard.canActivate', () => {
  it('@Public() isaretli route icin token istemeden gecirir', () => {
    expect(guardWith(true).canActivate(executionContext())).toBe(true);
  });
});

describe('JwtAuthGuard.handleRequest', () => {
  it('token yoksa UNAUTHENTICATED firlatir', () => {
    const guard = guardWith(false);

    expect(() => guard.handleRequest(null, false)).toThrow(UnauthenticatedError);
  });

  it('token gecersiz/suresi dolmussa UNAUTHENTICATED firlatir ve ic detayi sizdirmaz', () => {
    const guard = guardWith(false);

    const error: unknown = (() => {
      try {
        guard.handleRequest(new Error('jwt expired'), false);
        return undefined;
      } catch (caught: unknown) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(UnauthenticatedError);
    expect((error as UnauthenticatedError).code).toBe('UNAUTHENTICATED');
    expect((error as UnauthenticatedError).message).not.toContain('jwt expired');
  });

  it('gecerli tokende dogrulanmis kullaniciyi doner', () => {
    const guard = guardWith(false);
    const user = { userId: '11111111-1111-4111-8111-111111111111', email: 'selin@ornek.test' };

    expect(guard.handleRequest(null, user)).toEqual(user);
  });
});
