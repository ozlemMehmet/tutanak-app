// Entity -> DTO donusumu (CLAUDE.md §3.5): yanit govdeleri YALNIZCA burada kurulur,
// boylece password_hash gibi alanlarin sizmasi yapisal olarak engellenir.

import type { MeDto, SubscriptionDto, UserDto } from '../dto/user.dto';
import type { UserProfileRecord, UserRecord } from '../users.repository';

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Abonelik satiri yoksa sozlesmedeki varsayilan pasif abonelik doner (CLAUDE.md §3.11);
 * bu fonksiyon hicbir kosulda abonelik satiri OLUSTURMAZ.
 */
export function toMeDto(profile: UserProfileRecord, defaultCurrency: string): MeDto {
  const subscription: SubscriptionDto =
    profile.subscription === null
      ? { status: 'inactive', priceAmount: null, currency: defaultCurrency, currentPeriodEnd: null }
      : {
          status: profile.subscription.status,
          priceAmount: profile.subscription.priceAmount,
          currency: profile.subscription.currency,
          currentPeriodEnd: profile.subscription.currentPeriodEnd?.toISOString() ?? null,
        };

  return { ...toUserDto(profile), subscription };
}
