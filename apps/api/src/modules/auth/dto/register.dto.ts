// api-contract.yaml → RegisterRequest ile birebir (additionalProperties: false karsiligi
// global ValidationPipe'in forbidNonWhitelisted ayaridir — CLAUDE.md §3.7).

import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export class RegisterDto {
  @IsEmail({}, { message: 'geçerli bir e-posta adresi giriniz' })
  @MaxLength(EMAIL_MAX_LENGTH, { message: 'e-posta en fazla 254 karakter olabilir' })
  email!: string;

  @IsString({ message: 'parola metin olmalıdır' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: 'parola en az 8 karakter olmalıdır' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: 'parola en fazla 128 karakter olabilir' })
  password!: string;
}
