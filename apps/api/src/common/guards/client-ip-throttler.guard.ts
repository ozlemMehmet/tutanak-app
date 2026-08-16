// T-024 / guvenlik denetimi S-01: hiz siniri sayaci GLOBAL degil, ISTEMCI basina.
// Uretimde API portu disari acilmaz; tum istekler ters vekilin (Caddy) tek IP'sinden gelir.
// `main.ts` Express `trust proxy` degerini tek hop olarak ayarlar; boylece `req.ip`
// GUVENILEN hop sayisi kadar geri gidilerek bulunan gercek istemci adresi olur.
//
// Sayac anahtari bu yuzden acikca `req.ip`'e sabitlenir: kutuphanenin varsayilani surumler
// arasinda `req.ips[0]`'a (ISTEMCININ gonderdigi zincirin ilk halkasi — tamamen sahte
// olabilir) donebilir ve bu, hiz sinirini sessizce etkisiz kilardi.

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Adres hic cozulemezse istekler sayacsiz kalmasin diye ortak anahtar (CLAUDE.md §4.3). */
const UNKNOWN_CLIENT_TRACKER = 'bilinmeyen-istemci';

@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const clientIp = request.ip;
    return Promise.resolve(typeof clientIp === 'string' ? clientIp : UNKNOWN_CLIENT_TRACKER);
  }
}
