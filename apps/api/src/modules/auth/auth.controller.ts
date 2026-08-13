// Kimlik eylem endpoint'leri: /auth/register ve /auth/login sozlesmede tanimli
// bilincli isimlendirme istisnasidir (CLAUDE.md §2).

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { StrictRateLimit } from '../../common/decorators/strict-rate-limit.decorator';
import type { UserDto } from '../users/dto/user.dto';
import { AuthService } from './auth.service';
import type { LoginResponseDto } from './dto/login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// @Public() uclar hiz sinirindan MUAF DEGILDIR (T-014): asil korunmasi gerekenler bunlardir.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @StrictRateLimit()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<UserDto> {
    return this.authService.register(dto);
  }

  @Public()
  @StrictRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
