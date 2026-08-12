import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UnauthenticatedError } from '../../common/errors/app-error';
import type { UserDto } from '../users/dto/user.dto';
import { toUserDto } from '../users/mappers/user.mapper';
import { UsersRepository } from '../users/users.repository';
import type { LoginDto, LoginResponseDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

/** CLAUDE.md §6.1: bcrypt cost 10. */
const BCRYPT_COST = 10;

interface AccessTokenClaims {
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
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
    const claims = this.jwtService.decode<AccessTokenClaims>(accessToken);

    return {
      accessToken,
      expiresIn: claims.exp - claims.iat,
      user: toUserDto(user),
    };
  }
}
