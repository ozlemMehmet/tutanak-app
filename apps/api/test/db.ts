// Entegrasyon testleri icin veritabani ALTYAPI yardimcilari (CLAUDE.md §8.4):
// baglanti, gecici veritabani yonetimi, npm script kosumu ve SQLSTATE kontrolu.
// Bu dosya varlik/entity URETMEZ — test verisi fabrikalari `test/factories/` altindadir.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

// Postgres hata kodlari (SQLSTATE) — testlerde cikplak string yazilmaz.
export const NOT_NULL_VIOLATION = '23502';
export const FOREIGN_KEY_VIOLATION = '23503';
export const UNIQUE_VIOLATION = '23505';
export const CHECK_VIOLATION = '23514';

const API_ROOT = join(__dirname, '..');

/** Testlerin baglanacagi temel veritabani adresi; yoksa test anlamli bir hata ile durur. */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL tanimli degil: entegrasyon testleri gercek bir Postgres gerektirir (CLAUDE.md §8.2).',
    );
  }
  return url;
}

/** Temel adresin veritabani adini degistirerek yeni bir baglanti adresi uretir. */
export function withDatabaseName(baseUrl: string, databaseName: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/**
 * Testin kendi izole ve BOS veritabanini olusturur (varsa once dusurulur), adresini doner.
 * Boylece "temiz veritabaninda migration" senaryosu gelistiricinin veritabanini bozmadan kosar.
 */
export async function createEmptyDatabase(databaseName: string): Promise<string> {
  const adminUrl = requireDatabaseUrl();
  const admin = createTestPrisma(adminUrl);
  try {
    // Veritabani adi kod icinde sabit (test tarafindan verilir), disaridan gelen veri degildir.
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.$disconnect();
  }
  return withDatabaseName(adminUrl, databaseName);
}

/** Testin izole veritabanini kaldirir (acik baglantilar zorla kesilir). */
export async function dropDatabase(databaseName: string): Promise<void> {
  const admin = createTestPrisma(requireDatabaseUrl());
  try {
    await admin.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}'`,
    );
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await admin.$disconnect();
  }
}

export function createTestPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: databaseUrl });
}

/**
 * apps/api icindeki bir npm script'ini verilen veritabanina karsi kosar
 * (migration/seed komutlari testte de belgelenen komutlarla ayni olsun diye).
 */
export function runApiScript(script: string, databaseUrl: string): string {
  return execFileSync('npm', ['run', script], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

interface SqlErrorMeta {
  code?: string;
}

/** Prisma ham sorgu hatasindan Postgres SQLSTATE kodunu cikarir. */
export function sqlStateOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('meta' in error)) {
    return undefined;
  }
  const meta = (error as { meta?: SqlErrorMeta }).meta;
  return meta?.code;
}

/**
 * Verilen veritabani isleminin BELIRTILEN SQLSTATE ile reddedildigini dogrular.
 * Islem beklenmedik sekilde basarili olursa test kirmizi olur (sessiz gecis yok).
 */
export async function expectSqlState(operation: Promise<unknown>, sqlState: string): Promise<void> {
  let caught: unknown;
  try {
    await operation;
  } catch (error: unknown) {
    caught = error;
  }

  if (caught === undefined) {
    throw new Error(`Islem ${sqlState} hatasiyla reddedilmeliydi, ancak basarili oldu.`);
  }

  const actual = sqlStateOf(caught);
  if (actual !== sqlState) {
    const detail = caught instanceof Error ? caught.message : JSON.stringify(caught);
    throw new Error(`Beklenen SQLSTATE ${sqlState}, alinan ${actual ?? 'bilinmiyor'}: ${detail}`);
  }
}
