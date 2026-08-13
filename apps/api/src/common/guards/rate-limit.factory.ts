// Global hiz siniri yapilandirmasi (T-014; architecture.md §7, api-contract.yaml 429).
// Sayac bellek ictedir: tek instance oldugu icin dogru sonucu verir (architecture.md §4;
// Redis §6.2 geregi KULLANILMAZ). Limit asimi `ThrottlerException` (429) firlatir ve
// `AllExceptionsFilter` bunu `RATE_LIMIT_EXCEEDED` zarfina cevirir (CLAUDE.md §4.2).

import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { IS_STRICT_RATE_LIMIT_KEY } from '../decorators/strict-rate-limit.decorator';

const MS_PER_SECOND = 1000;

/** Istemciye gosterilen Turkce mesaj; framework metni sizdirilmaz (CLAUDE.md §4.3). */
const RATE_LIMIT_MESSAGE = 'Cok fazla istek gonderildi. Lutfen bir sure sonra tekrar deneyin.';

export interface RateLimitSettings {
  /** Sayacin sifirlandigi pencere, saniye (`RATE_LIMIT_WINDOW_SECONDS`). */
  windowSeconds: number;
  /** Pencere basina genel ust sinir (`RATE_LIMIT_MAX_REQUESTS`). */
  defaultMaxRequests: number;
  /** `@StrictRateLimit()` isaretli route'lar icin ust sinir (`AUTH_RATE_LIMIT_MAX_REQUESTS`). */
  strictMaxRequests: number;
}

/**
 * Tek bir throttler tanimi uretir; limit route'a gore COZULUR (throttler'in `Resolvable`
 * limit destegi). Iki ayri throttler yerine tek tanim kullanilir, cunku sayac anahtari
 * zaten endpoint + IP basinadir: isaretli uclar sikilastirilmis, digerleri genel limiti alir.
 */
export function createThrottlerOptions(settings: RateLimitSettings): ThrottlerModuleOptions {
  const reflector = new Reflector();

  const resolveLimit = (context: ExecutionContext): number => {
    const isStrict = reflector.getAllAndOverride<boolean>(IS_STRICT_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isStrict ? settings.strictMaxRequests : settings.defaultMaxRequests;
  };

  return {
    errorMessage: RATE_LIMIT_MESSAGE,
    throttlers: [
      {
        ttl: settings.windowSeconds * MS_PER_SECOND,
        limit: resolveLimit,
      },
    ],
  };
}
