// T-008 kabul kriteri 1: token benzersiz ve tahmin edilemez olmalidir.
// Uzunluk / alfabe / benzersizlik testleri CLAUDE.md §8.1 geregi ZORUNLUDUR.
import { generateShareToken, SHARE_TOKEN_ENTROPY_BYTES } from './share-token.generator';

/** 32 bayt entropi base64url'de 43 karakter uretir (data-model CHECK: 32..128). */
const EXPECTED_TOKEN_LENGTH = Math.ceil((SHARE_TOKEN_ENTROPY_BYTES * 4) / 3);
const BASE64URL_ALPHABET = /^[A-Za-z0-9_-]+$/;
const SAMPLE_SIZE = 1000;

describe('generateShareToken', () => {
  it('32 bayt entropiden sabit uzunlukta token uretir (DDL CHECK 32..128 araliginda)', () => {
    const token = generateShareToken();

    expect(token).toHaveLength(EXPECTED_TOKEN_LENGTH);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token.length).toBeLessThanOrEqual(128);
  });

  it('yalnizca base64url alfabesini kullanir (URL yoluna kacissiz gomulebilir)', () => {
    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      expect(generateShareToken()).toMatch(BASE64URL_ALPHABET);
    }
  });

  it('ard arda uretimlerde tekrar etmez (tahmin edilemezlik icin asgari kanit)', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      tokens.add(generateShareToken());
    }

    expect(tokens.size).toBe(SAMPLE_SIZE);
  });
});
