// `iyzipay` (v2) TypeScript tip tanimi sunmuyor (CLAUDE.md §9'daki ornek notun konusu).
// Bu bildirim, urunun FIILEN kullandigi tek yuzeyi tanimlar; kullanilmayan kaynaklar
// bilincli olarak tanimlanmamistir (tanimlanan yuzey ne kadar dar olursa, `any` sizintisi
// o kadar az olur).

declare module 'iyzipay' {
  interface IyzipayOptions {
    apiKey: string;
    secretKey: string;
    uri: string;
  }

  class Iyzipay {
    constructor(options: IyzipayOptions);
    checkoutFormInitialize: {
      create(
        request: Record<string, unknown>,
        callback: (error: unknown, result: unknown) => void,
      ): void;
    };
  }

  export = Iyzipay;
}
