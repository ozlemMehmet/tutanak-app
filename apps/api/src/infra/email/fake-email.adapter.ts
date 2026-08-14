// Testlerin e-posta sahtesi (CLAUDE.md §7, §8.2): gercek ag cagrisi yapilmaz; birim/e2e
// testleri hem basarili hem basarisiz gonderimi kurgular (T-008 "status yanitta belirtilir").

import type { EmailPort, EmailSendResult, OutgoingEmail } from './email.port';

export class FakeEmailAdapter implements EmailPort {
  readonly sentEmails: OutgoingEmail[] = [];
  private nextFailureMessage: string | null = null;
  private sentCount = 0;

  /** Bir SONRAKI gonderimi verilen mesajla basarisiz kilar (tek seferlik). */
  failNextWith(errorMessage: string): void {
    this.nextFailureMessage = errorMessage;
  }

  sendEmail(email: OutgoingEmail): Promise<EmailSendResult> {
    if (this.nextFailureMessage !== null) {
      const errorMessage = this.nextFailureMessage;
      this.nextFailureMessage = null;
      return Promise.resolve({ status: 'failed', errorMessage });
    }
    this.sentEmails.push(email);
    this.sentCount += 1;
    return Promise.resolve({ status: 'sent', providerMessageId: `fake-${String(this.sentCount)}` });
  }
}
