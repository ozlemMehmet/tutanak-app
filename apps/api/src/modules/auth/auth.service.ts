import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UnauthenticatedError } from '../../common/errors/app-error';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../config/config.tokens';
import { DEFAULT_JWT_EXPIRES_IN } from '../../config/env.schema';
import type { UserDto } from '../users/dto/user.dto';
import { toUserDto } from '../users/mappers/user.mapper';
import { UsersRepository } from '../users/users.repository';
import { parseAccessTokenTtlSeconds } from './access-token-ttl.parser';
import type { LoginDto, LoginResponseDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

/** CLAUDE.md §6.1: bcrypt cost 10. */
const BCRYPT_COST = 10;

/**
 * Servis DI disinda (birim testlerde) dogrudan kurulabildigi icin omur degeri
 * yapilandirma VARSAYILANINDAN turetilir — sabit sayi gomulmez. Uygulamada deger
 * her zaman `ACCESS_TOKEN_TTL_SECONDS` saglayicisindan gelir (auth.module.ts).
 */
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = parseAccessTokenTtlSeconds(DEFAULT_JWT_EXPIRES_IN);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    @Inject(ACCESS_TOKEN_TTL_SECONDS)
    private readonly accessTokenTtlSeconds: number = DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  ) {}

  /** Parola hicbir zaman duz metin saklanmaz; yalnizca bcrypt hash'i yazilir. */
  async register(input: RegisterDto): Promise<UserDto> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const user = await this.usersRepository.create({ email: input.email, passwordHash });
    return toUserDto(user);
  }

  /**
   * Kullanici bulunamadi ile parola yanlis AYNI hatayi doner (kullanici sizdirma yok);
   * sozlesmede her iki durum da 401 INVALID_CREDENTIALS'tir.
   */
  async login(input: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersRepository.findByEmail(input.email);
    const isPasswordValid =
      user !== null && (await bcrypt.compare(input.password, user.passwordHash));

    if (user === null || !isPasswordValid) {
      throw new UnauthenticatedError('INVALID_CREDENTIALS', 'E-posta veya parola hatali.');
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email });

    // Omur, tokeni imzalayan `signOptions.expiresIn` ile AYNI yapilandirma degerinden
    // turer; imzalanan token geri decode EDILMEZ (T-016).
    return {
      accessToken,
      expiresIn: this.accessTokenTtlSeconds,
      user: toUserDto(user),
    };
  }
}
