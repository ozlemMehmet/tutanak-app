// Dogrulanmis token'dan gelen kullaniciyi controller imzasina tasir (CLAUDE.md §1).
// Kullanici kimligi istemci govdesinden DEGIL, yalnizca token'dan okunur.

import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
