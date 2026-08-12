// api-contract.yaml → LoginRequest ile birebir.

import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { UserDto } from '../../users/dto/user.dto';

const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

export class LoginDto {
  @IsEmail({}, { message: 'gecerli bir e-posta adresi giriniz' })
  @MaxLength(EMAIL_MAX_LENGTH, { message: 'e-posta en fazla 254 karakter olabilir' })
  email!: string;

  @IsString({ message: 'parola metin olmalidir' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: 'parola en az 8 karakter olmalidir' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: 'parola en fazla 128 karakter olabilir' })
  password!: string;
}

/** api-contract.yaml → LoginResponse. */
export interface LoginResponseDto {
  accessToken: string;
  /** Saniye cinsinden gecerlilik; token'in kendi iat/exp degerlerinden hesaplanir. */
  expiresIn: number;
  user: UserDto;
}
