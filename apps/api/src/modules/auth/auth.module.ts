import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../config/config.tokens';
import type { AppEnv } from '../../config/env.schema';
import { UsersModule } from '../users/users.module';
import { parseAccessTokenTtlSeconds } from './access-token-ttl.parser';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      // Yanittaki `expiresIn`, tokeni imzalayan `signOptions.expiresIn` ile ayni
      // yapilandirma degerinden turer; bicim bozuksa uygulama ACILMAZ (CLAUDE.md §5).
      provide: ACCESS_TOKEN_TTL_SECONDS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>): number =>
        parseAccessTokenTtlSeconds(config.get('JWT_EXPIRES_IN', { infer: true })),
    },
  ],
})
export class AuthModule {}
