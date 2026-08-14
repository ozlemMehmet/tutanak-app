// E-posta sinirinin portu (CLAUDE.md §7 Adapter+Port): dis dunyaya cikan tek e-posta
// arayuzu budur. SAGLAYICI HATASI ISTISNA DEGILDIR (§4.2.2): gonderim sonucu deger olarak
// doner, adapter hicbir kosulda firlatmaz — cagiran taraf sonucu teslim kaydina yazar.

export const EMAIL_PORT = 'EmailPort';

/** Giden e-posta; gonderen adres adapter yapilandirmasindan gelir (EMAIL_FROM, §5.1). */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

export type EmailSendResult =
  { status: 'sent'; providerMessageId: string | null } | { status: 'failed'; errorMessage: string };

export interface EmailPort {
  sendEmail(email: OutgoingEmail): Promise<EmailSendResult>;
}
