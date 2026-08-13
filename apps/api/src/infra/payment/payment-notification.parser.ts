// Bildirim govdesinin ayristirilmasi ve KANONIK sekle dogrulanmasi (saf fonksiyonlar).
// Her iki adapter de ayni dogrulamayi kullanir: zorunlu alanlar (providerReference, status)
// eksik/gecersizse 400, sema disi alanlar sessizce AYIKLANIR (CLAUDE.md §3.7 istisna 2).

import { ValidationError } from '../../common/errors/app-error';
import type { PaymentNotification, PaymentNotificationStatus } from './payment.port';

const CANONICAL_STATUSES: PaymentNotificationStatus[] = ['succeeded', 'failed'];

/** Ham govdeyi JSON nesnesine cevirir; govde yoksa/bozuksa 400 uretir. */
export function parseJsonBody(rawBody: Buffer | undefined): Record<string, unknown> {
  if (rawBody === undefined || rawBody.length === 0) {
    throw new ValidationError('Bildirim govdesi bos.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch {
    // Saglayicinin ham govdesi hata mesajina KONULMAZ (CLAUDE.md §4.3).
    throw new ValidationError('Bildirim govdesi gecerli JSON degil.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError('Bildirim govdesi bir nesne olmalidir.');
  }
  return parsed as Record<string, unknown>;
}

/** Nesnedeki alani yalnizca metin ise doner; aksi halde undefined (ayiklama). */
export function readString(source: Record<string, unknown>, field: string): string | undefined {
  const value = source[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isCanonicalStatus(value: unknown): value is PaymentNotificationStatus {
  return CANONICAL_STATUSES.some((status) => status === value);
}

/**
 * Kanonik alanlari dogrular. Beyaz liste disindaki alanlar okunmaz — bu yuzden
 * ek alan tasiyan bildirim 400 URETMEZ, alanlar sessizce dusurulur.
 */
export function parsePaymentNotification(source: Record<string, unknown>): PaymentNotification {
  const providerReference = readString(source, 'providerReference');
  const status = source.status;

  if (providerReference === undefined) {
    throw new ValidationError('Bildirim dogrulanamadi.', [
      { field: 'providerReference', message: 'zorunlu alan' },
    ]);
  }
  if (!isCanonicalStatus(status)) {
    throw new ValidationError('Bildirim dogrulanamadi.', [
      { field: 'status', message: 'succeeded veya failed olmalidir' },
    ]);
  }

  return {
    providerReference,
    status,
    failureReason: readString(source, 'failureReason') ?? null,
  };
}
