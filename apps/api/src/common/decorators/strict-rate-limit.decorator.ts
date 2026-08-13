// Kaba kuvvet saldirisinin birincil hedefi olan uclar (T-014: /auth/register, /auth/login)
// genel hiz siniri yerine SIKILASTIRILMIS limitle korunur (architecture.md §7 tablosu).
// Isaretlemenin route uzerinde durmasi, limitin degerini yapilandirmada birakir
// (deger dekoratore yazilmaz — CLAUDE.md §5.1); esleme `common/guards/rate-limit.factory.ts`.

import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

export const IS_STRICT_RATE_LIMIT_KEY = 'isStrictRateLimitRoute';

export const StrictRateLimit = (): CustomDecorator => SetMetadata(IS_STRICT_RATE_LIMIT_KEY, true);
