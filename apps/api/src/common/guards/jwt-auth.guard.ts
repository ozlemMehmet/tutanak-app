// Global kimlik dogrulama guard'i (CLAUDE.md §1): sozlesme geregi HER endpoint
// varsayilan olarak kapalidir; yalnizca @Public() isaretli route'lar acikta kalir.

import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthenticatedError } from '../errors/app-error';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  /**
   * Token yok, bozuk veya suresi dolmus — hepsi ayni yanittir: 401 UNAUTHENTICATED.
   * Passport'un ic hata metni (ornegin "jwt expired") istemciye SIZDIRILMAZ (CLAUDE.md §4.3).
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- taban sinif IAuthGuard.handleRequest generic imzali; generic kaldirilirsa override uyumsuz olur
  override handleRequest<TUser = AuthenticatedUser>(error: unknown, user: unknown): TUser {
    if (error !== null && error !== undefined) {
      throw new UnauthenticatedError();
    }
    if (user === undefined || user === null || user === false) {
      throw new UnauthenticatedError();
    }
    return user as TUser;
  }
}
