// Resend adapter'i (CLAUDE.md §7 Adapter+Port; architecture.md: islemsel e-posta = Resend).
// SAGLAYICI HATASI ISTISNA DEGILDIR (§4.2.2): bu adapter hicbir kosulda firlatmaz; hata,
// `failed` sonucu olarak doner ve cagiran taraf `share_deliveries` kaydina yazar.
// Hata mesajlari kullaniciya gosterilebilir Turkce OZETLERDIR: saglayicinin ham yaniti
// (anahtar/stack icerebilir) yanita ve kayda SIZMAZ (§4.3; data-model: "ozetlenmis").

import type { EmailPort, EmailSendResult, OutgoingEmail } from './email.port';

/** Resend SDK'sinin bu adapterin kullandigi dar yuzeyi (testte sahtelenir, §8.1). */
export interface ResendLikeClient {
  emails: {
    send(payload: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
  };
}

export interface ResendEmailConfig {
  /** EMAIL_FROM (CLAUDE.md §5.1) — gonderen adres koda gomulmez. */
  from: string;
}

const REJECTED_MESSAGE = 'E-posta saglayicisi gonderimi reddetti.';
const UNREACHABLE_MESSAGE = 'E-posta saglayicisina ulasilamadi.';

export class ResendEmailAdapter implements EmailPort {
  constructor(
    private readonly config: ResendEmailConfig,
    private readonly client: ResendLikeClient,
  ) {}

  async sendEmail(email: OutgoingEmail): Promise<EmailSendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.config.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
      if (error !== null) {
        return { status: 'failed', errorMessage: REJECTED_MESSAGE };
      }
      return { status: 'sent', providerMessageId: data?.id ?? null };
    } catch {
      return { status: 'failed', errorMessage: UNREACHABLE_MESSAGE };
    }
  }
}
