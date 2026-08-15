// api-contract.yaml → CreateApprovalRequest ile birebir (additionalProperties: false
// karsiligi global ValidationPipe'in forbidNonWhitelisted ayaridir — CLAUDE.md §3.7).
//
// Govdede TARIH ALANI YOKTUR: onay damgasi veritabaninda `DEFAULT now()` ile dogar (§3.7).

import { IsEmail, MaxLength } from 'class-validator';

/** Sozlesmedeki `maxLength: 254` (RFC uzunluk siniri). */
const APPROVER_EMAIL_MAX_LENGTH = 254;

export class CreateApprovalDto {
  @IsEmail({}, { message: 'gecerli bir e-posta adresi giriniz' })
  @MaxLength(APPROVER_EMAIL_MAX_LENGTH, {
    message: 'e-posta adresi en fazla 254 karakter olabilir',
  })
  approverEmail!: string;
}
