// T-024 / S-01: hiz siniri sayaci ISTEMCI basina tutulmalidir. Uretimde tum istekler
// Caddy'nin tek IP'sinden geldigi icin izleyici anahtari, `trust proxy` hop sayisi kadar
// geri gidilerek bulunan `req.ip`'tir. Bu dosya anahtarin ISTEMCININ UYDURDUGU zincirden
// (`req.ips[0]`) okunmadigini sabitler: aksi halde saldirgan her istekte yeni bir XFF
// onegi yazip sayaci sifirlar.

import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';

/** `getTracker` korumalidir; test icin dar bir kapi acilir (davranis degismez). */
class TestableThrottlerGuard extends ClientIpThrottlerGuard {
  public resolveTracker(request: Record<string, unknown>): Promise<string> {
    return this.getTracker(request);
  }
}

const createGuard = (): TestableThrottlerGuard => {
  const options: ThrottlerModuleOptions = { throttlers: [] };
  const storage: ThrottlerStorage = {
    increment: jest.fn(),
  };
  return new TestableThrottlerGuard(options, storage, new Reflector());
};

describe('ClientIpThrottlerGuard.getTracker', () => {
  it('vekil arkasindaki gercek istemci adresini (req.ip) sayac anahtari yapar', async () => {
    // Express `trust proxy` acikken req.ip, guvenilen hop sayisi kadar geri gidilerek bulunur.
    await expect(
      createGuard().resolveTracker({ ip: '198.51.100.7', ips: ['198.51.100.7'] }),
    ).resolves.toBe('198.51.100.7');
  });

  it('istemcinin uydurdugu XFF onegini (req.ips[0]) anahtar olarak KULLANMAZ', async () => {
    // Saldirgan `X-Forwarded-For: 203.0.113.9` gonderir; vekil kendi gordugu adresi zincire
    // EKLER. Anahtar oneke bakarsa her istekte degisir ve hiz siniri tamamen atlatilir.
    const request = { ip: '198.51.100.7', ips: ['203.0.113.9', '198.51.100.7'] };

    const tracker = await createGuard().resolveTracker(request);

    expect(tracker).toBe('198.51.100.7');
    expect(tracker).not.toBe('203.0.113.9');
  });

  it('adres cozulemezse sabit bir anahtara duser (istekler sayacsiz kalmaz)', async () => {
    // req.ip yalnizca soket adresi de yokken tanimsiz olabilir; bu durumda istekleri
    // sinirsiz birakmak yerine hepsi ortak sayaci tuketir.
    await expect(createGuard().resolveTracker({ ips: [] })).resolves.toBe('bilinmeyen-istemci');
  });
});
