// api-contract.yaml → SendShareEmailRequest ile birebir (additionalProperties: false
// karsiligi global ValidationPipe'in forbidNonWhitelisted ayaridir — CLAUDE.md §3.7).

import { IsEmail, MaxLength } from 'class-validator';

/** Sozlesmedeki `maxLength: 254` (RFC uzunluk siniri). */
const RECIPIENT_EMAIL_MAX_LENGTH = 254;

export class SendShareEmailDto {
  @IsEmail({}, { message: 'geçerli bir e-posta adresi giriniz' })
  @MaxLength(RECIPIENT_EMAIL_MAX_LENGTH, {
    message: 'e-posta adresi en fazla 254 karakter olabilir',
  })
  recipientEmail!: string;
}
