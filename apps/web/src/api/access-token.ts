// Erisim token'i tarayici deposunda tutulur; okuma tek yerde yapilir ki giris ekrani
// (henuz yazilmadi) eklendiginde yazma tarafi da ayni anahtari kullansin.
export const ACCESS_TOKEN_STORAGE_KEY = 'tutanak.accessToken';

export function readAccessToken(storage: Storage): string | null {
  return storage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}
