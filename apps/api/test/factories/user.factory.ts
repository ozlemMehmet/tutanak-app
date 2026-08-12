// Test verisi fabrikasi: kullanici (CLAUDE.md §8.4 — dosya basina bir varlik).

import { randomUUID } from 'node:crypto';
import type { PrismaClient, User } from '@prisma/client';

interface UserOverrides {
  email?: string;
  passwordHash?: string;
}

export function createUser(prisma: PrismaClient, overrides: UserOverrides = {}): Promise<User> {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `kullanici-${randomUUID()}@ornek.test`,
      // Gercek bir sifre hash'i degil, yalnizca sutunu dolduran sabit test degeri.
      passwordHash: overrides.passwordHash ?? '$2b$10$test.hash.degeri.yalnizca.test.icin',
    },
  });
}
