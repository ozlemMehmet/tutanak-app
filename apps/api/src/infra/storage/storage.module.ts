import { Module } from '@nestjs/common';
import { R2StorageAdapter } from './r2-storage.adapter';
import { STORAGE_PORT } from './storage.port';

/**
 * Uretim ve yerel calistirma ayni adapter'i kullanir; yerelde adres MinIO'yu gosterir
 * (CLAUDE.md §10). Testler bu saglayiciyi `FakeStorageAdapter` ile degistirir —
 * bunun icin ayri bir env anahtari UYDURULMAZ (§5.1 tablosunda boyle bir anahtar yok).
 */
@Module({
  providers: [{ provide: STORAGE_PORT, useClass: R2StorageAdapter }],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
