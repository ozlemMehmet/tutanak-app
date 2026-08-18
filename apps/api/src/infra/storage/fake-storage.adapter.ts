// Testler icin sahte depolama (CLAUDE.md §7, §8.1-§8.2): gercek ag cagrisi yapmaz,
// objeleri bellekte tutar. Uretim kod yolunda KULLANILMAZ; e2e testinde STORAGE_PORT
// saglayicisi bu sinifla degistirilir.

import { Injectable } from '@nestjs/common';
import { ExternalServiceError } from '../../common/errors/app-error';
import type { StorageObjectInput, StoragePort } from './storage.port';

/** Gercek bir adres degildir; testler yalnizca anahtarin URL'ye tasindigini dogrular. */
const FAKE_URL_PREFIX = 'https://depolama.test/';
const FAKE_SIGNATURE_QUERY = '?imza=sahte';

@Injectable()
export class FakeStorageAdapter implements StoragePort {
  private readonly objects = new Map<string, StorageObjectInput>();

  putObject(input: StorageObjectInput): Promise<void> {
    this.objects.set(input.key, input);
    return Promise.resolve();
  }

  createReadUrl(key: string): Promise<string> {
    return Promise.resolve(`${FAKE_URL_PREFIX}${key}${FAKE_SIGNATURE_QUERY}`);
  }

  /** Yazilmamis anahtar, gercek depolamadaki erisilemezlik ile ayni hatayi uretir (§4.2.1). */
  getObject(key: string): Promise<Buffer> {
    const stored = this.objects.get(key);
    if (stored === undefined) {
      throw new ExternalServiceError(
        'STORAGE_UNAVAILABLE',
        'Fotoğraf deposuna şu anda erişilemiyor, tekrar deneyin.',
      );
    }
    return Promise.resolve(stored.body);
  }

  /** Testlerin "depolamaya gercekten yazildi mi" sorusunu sorabilmesi icin. */
  read(key: string): StorageObjectInput | undefined {
    return this.objects.get(key);
  }

  get storedCount(): number {
    return this.objects.size;
  }
}
