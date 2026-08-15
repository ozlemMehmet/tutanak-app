// Giris sonrasi nereye gidilecegi (T-018 kriter 2). `redirectTo` degerini RequireAuth
// uretir (T-017) ama adres cubugundan da gelebilir: bu yuzden deger DOGRULANIR.
export const DEFAULT_SIGNED_IN_ROUTE = '/reports';

/**
 * Yalnizca uygulama ici mutlak yollar kabul edilir. `//host` ve `/\host` tarayicida
 * protokol-goreli DIS adrese cozulur; boyle bir deger acik yonlendirme (open redirect)
 * acigi olurdu — kabul edilmeyen her deger varsayilan rotaya duser.
 */
export function safeRedirectTarget(redirectTo: string | null): string {
  if (redirectTo?.startsWith('/') !== true) {
    return DEFAULT_SIGNED_IN_ROUTE;
  }
  if (redirectTo.startsWith('//') || redirectTo.startsWith('/\\')) {
    return DEFAULT_SIGNED_IN_ROUTE;
  }
  return redirectTo;
}
