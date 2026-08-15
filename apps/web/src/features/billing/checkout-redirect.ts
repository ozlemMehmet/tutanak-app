// Saglayicinin odeme sayfasina gecis TAM SAYFA yonlendirmedir; yeni sekme (window.open /
// target="_blank") KULLANILMAZ — design.md SubscriptionPage: mobilde pop-up engelleme
// riskini azaltir ve donuste ayni sekme `?checkout=return` ile geri gelir.

/** Yonlendirmeyi yapan hedef; testte sahte nesne verilebilsin diye disaridan alinir. */
export interface RedirectTarget {
  assign: (url: string) => void;
}

export function redirectToCheckout(url: string, target: RedirectTarget = window.location): void {
  target.assign(url);
}
