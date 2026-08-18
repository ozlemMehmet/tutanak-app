// Resend adapter'i (CLAUDE.md §7 Adapter+Port; architecture.md: islemsel e-posta = Resend).
// SAGLAYICI HATASI ISTISNA DEGILDIR (§4.2.2): bu adapter hicbir kosulda firlatmaz; hata,
// `failed` sonucu olarak doner ve cagiran taraf `share_deliveries` kaydina yazar.
// Hata mesajlari kullaniciya gosterilebilir Turkce OZETLERDIR: saglayicinin ham yaniti
// (anahtar/stack icerebilir) yanita ve kayda SIZMAZ (§4.3; data-model: "ozetlenmis").

import { Logger } from '@nestjs/common';
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

const REJECTED_MESSAGE = 'E-posta sağlayıcısı gönderimi reddetti.';
const UNREACHABLE_MESSAGE = 'E-posta sağlayıcısına ulaşılamadı.';

/** Log kaydinda alici adresi maskelenir (§4.3): `kiraci@ornek.test` -> `k***@ornek.test`. */
function maskEmail(address: string): string {
  const separator = address.lastIndexOf('@');
  if (separator <= 0) {
    return '***';
  }
  return `${address.slice(0, 1)}***${address.slice(separator)}`;
}

export class ResendEmailAdapter implements EmailPort {
  private readonly logger = new Logger(ResendEmailAdapter.name);

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
        // Dis servis basarisizligi error seviyesinde ve hata nesnesiyle loglanir (§4.4);
        // operatorde teshis verisi kalmalidir, ham yanit YALNIZCA logda kalir (§4.3).
        this.logger.error(
          `E-posta saglayicisi gonderimi reddetti (to=${maskEmail(email.to)})`,
          error,
        );
        return { status: 'failed', errorMessage: REJECTED_MESSAGE };
      }
      return { status: 'sent', providerMessageId: data?.id ?? null };
    } catch (error: unknown) {
      this.logger.error(`E-posta saglayicisina ulasilamadi (to=${maskEmail(email.to)})`, error);
      return { status: 'failed', errorMessage: UNREACHABLE_MESSAGE };
    }
  }
}
