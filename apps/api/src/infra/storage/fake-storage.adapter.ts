// Testler icin sahte depolama (CLAUDE.md §7, §8.1-§8.2): gercek ag cagrisi yapmaz,
// objeleri bellekte tutar. Uretim kod yolunda KULLANILMAZ; e2e testinde STORAGE_PORT
// saglayicisi bu sinifla degistirilir.

import { Injectable } from '@nestjs/common';
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

  /** Testlerin "depolamaya gercekten yazildi mi" sorusunu sorabilmesi icin. */
  read(key: string): StorageObjectInput | undefined {
    return this.objects.get(key);
  }

  get storedCount(): number {
    return this.objects.size;
  }
}
