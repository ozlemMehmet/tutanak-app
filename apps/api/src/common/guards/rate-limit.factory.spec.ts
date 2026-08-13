import type { ExecutionContext } from '@nestjs/common';
import { StrictRateLimit } from '../decorators/strict-rate-limit.decorator';
import type { RateLimitSettings } from './rate-limit.factory';
import { createThrottlerOptions } from './rate-limit.factory';

const SETTINGS: RateLimitSettings = {
  windowSeconds: 60,
  defaultMaxRequests: 300,
  strictMaxRequests: 5,
};

// Guard, route handler'ini sinifindan AYRI (unbound) alir; testte de handler'lar duz fonksiyon
// olarak temsil edilir ve isaretleme dekoratorun yazdigi metadata ile birebir ayni sekilde
// konur. Gercek controller uzerindeki isaretleme e2e testinde dogrulanir.
function strictRoute(): void {
  // Govde gerekmez; yalnizca metadata tasiyicisi.
}

function looseRoute(): void {
  // Govde gerekmez.
}

StrictRateLimit()(strictRoute);

/** Isaretsiz controller sinifi: sinif seviyesinde de isaretleme yoktur. */
class DemoController {
  readonly path = 'demo';
}

function contextFor(handler: () => void): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => DemoController,
  } as unknown as ExecutionContext;
}

interface ResolvedOptions {
  errorMessage: string;
  throttlers: { ttl: number; limit: (context: ExecutionContext) => number }[];
}

function resolvedOptions(settings: RateLimitSettings = SETTINGS): ResolvedOptions {
  return createThrottlerOptions(settings) as unknown as ResolvedOptions;
}

describe('createThrottlerOptions', () => {
  it('pencereyi saniyeden milisaniyeye cevirir (throttler ttl ms bekler)', () => {
    expect(resolvedOptions().throttlers[0]?.ttl).toBe(60_000);
  });

  it('@StrictRateLimit() ile isaretli route icin sikilastirilmis limiti uygular', () => {
    const limit = resolvedOptions().throttlers[0]?.limit;

    expect(limit?.(contextFor(strictRoute))).toBe(SETTINGS.strictMaxRequests);
  });

  it('isaretsiz route icin genel limiti uygular', () => {
    const limit = resolvedOptions().throttlers[0]?.limit;

    expect(limit?.(contextFor(looseRoute))).toBe(SETTINGS.defaultMaxRequests);
  });

  it('limit degerleri yapilandirmadan gelir, koda gomulmez (CLAUDE.md §5.1)', () => {
    const throttler = resolvedOptions({
      windowSeconds: 30,
      defaultMaxRequests: 7,
      strictMaxRequests: 2,
    }).throttlers[0];

    expect(throttler?.ttl).toBe(30_000);
    expect(throttler?.limit(contextFor(strictRoute))).toBe(2);
    expect(throttler?.limit(contextFor(looseRoute))).toBe(7);
  });

  it('istemciye gosterilecek mesaj Turkce cumledir, framework metni sizmaz (CLAUDE.md §4.3)', () => {
    const { errorMessage } = resolvedOptions();

    expect(errorMessage).toMatch(/istek/i);
    expect(errorMessage).not.toMatch(/throttler|too many/i);
  });
});
