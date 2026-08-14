// Paylasim token ureteci (CLAUDE.md §7 Factory satiri: rastgelelik iceren uretim).
// Token bir yetenek (capability) kimligidir: 32 bayt kriptografik entropi, base64url
// (data-model.sql share_links yorumu + api-contract ShareLink.token aciklamasi).

import { randomBytes } from 'node:crypto';

export const SHARE_TOKEN_ENTROPY_BYTES = 32;

/** Tahmin edilemez, URL yoluna kacissiz gomulebilen paylasim token'i uretir. */
export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_ENTROPY_BYTES).toString('base64url');
}
