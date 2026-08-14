// Yanit tipleri — api-contract.yaml → ShareLink / ShareDelivery ile birebir.

export interface ShareLinkDto {
  token: string;
  url: string;
  whatsAppUrl: string;
  createdAt: string;
}

export type ShareDeliveryStatusDto = 'sent' | 'failed';

export interface ShareDeliveryDto {
  id: string;
  /** MVP'de tek kanal (sozlesme enum'u). */
  channel: 'email';
  recipientEmail: string;
  status: ShareDeliveryStatusDto;
  /** Skaler nullable alan: `sent` iken null GONDERILIR (CLAUDE.md §3.5). */
  errorMessage: string | null;
  createdAt: string;
}
