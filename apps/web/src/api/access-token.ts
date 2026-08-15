// Erisim token'i tarayici deposunda (`localStorage`) tutulur — architecture.md §"Kimlik
// dogrulama (T-003)" bu saklama yerini acikca belirler: refresh token yoktur, XSS riski
// kati CSP (`script-src 'self'`), React'in varsayilan kacisi ve `dangerouslySetInnerHTML`
// yasagi ile karsilanir. Okuma/yazma/silme TEK yerde toplanir ki tum taraflar ayni
// anahtari kullansin; oturum durumunun tepkisel (reactive) hali `features/auth/session.ts`.
export const ACCESS_TOKEN_STORAGE_KEY = 'tutanak.accessToken';

export function readAccessToken(storage: Storage): string | null {
  return storage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function writeAccessToken(storage: Storage, accessToken: string): void {
  storage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
}

export function clearAccessToken(storage: Storage): void {
  storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}
