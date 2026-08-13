// Yanit tipleri — api-contract.yaml → CheckoutResponse ile birebir.

export interface CheckoutDto {
  transactionReference: string;
  checkoutUrl: string;
  /** Ondalikli para degeri METIN olarak; kayan noktali sayi KULLANILMAZ (CLAUDE.md §5.1). */
  amount: string;
  currency: string;
}
