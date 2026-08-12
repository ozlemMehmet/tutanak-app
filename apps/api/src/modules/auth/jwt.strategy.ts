// Bearer token dogrulamasi (api-contract.yaml → securitySchemes.bearerAuth, HS256).

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { AppEnv } from '../../config/env.schema';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppEnv, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  /** Passport dogrulanmis payload'i verir; istek boyunca kullanilacak kimlik budur. */
  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, email: payload.email };
  }
}
