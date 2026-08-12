// Veri katmani siniri (CLAUDE.md §3.4, §7 Repository): Prisma cagrilari ve Prisma
// tipleri bu dosyanin disina cikmaz; kisit ihlalleri burada domain hatasina cevrilir.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConflictError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Prisma unique kisit ihlali (users_email_key → SQLSTATE 23505). */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface SubscriptionRecord {
  status: 'inactive' | 'pending' | 'active';
  /** numeric(12,2) — para degeri metin olarak tasinir, float'a cevrilmez (CLAUDE.md §5.1). */
  priceAmount: string | null;
  currency: string;
  currentPeriodEnd: Date | null;
}

export interface UserProfileRecord extends UserRecord {
  subscription: SubscriptionRecord | null;
}

interface CreateUserInput {
  email: string;
  passwordHash: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_VIOLATION
  );
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kullaniciyi yazar. Mukerrer e-posta korumasi UYGULAMADA DEGIL, DB unique index'inde:
   * once INSERT denenir, kisit ihlali yakalanip alan bazli 409'a cevrilir (CLAUDE.md §7)
   * — "once oku sonra yaz" yarisi bu sayede yapisal olarak imkansizdir.
   */
  async create(input: CreateUserInput): Promise<UserRecord> {
    try {
      const created = await this.prisma.user.create({
        data: { email: input.email, passwordHash: input.passwordHash },
      });
      return toUserRecord(created);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('EMAIL_ALREADY_REGISTERED', 'Bu e-posta zaten kayitli.', [
          { field: 'email', message: 'bu e-posta zaten kayitli' },
        ]);
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const found = await this.prisma.user.findUnique({ where: { email } });
    return found === null ? null : toUserRecord(found);
  }

  /** Profil + (varsa) abonelik satiri; satir YOKSA olusturulmaz (CLAUDE.md §3.11). */
  async findProfileById(id: string): Promise<UserProfileRecord | null> {
    const found = await this.prisma.user.findUnique({
      where: { id },
      include: { subscriptions: true },
    });
    if (found === null) {
      return null;
    }
    return { ...toUserRecord(found), subscription: toSubscriptionRecord(found.subscriptions) };
  }
}

interface PrismaUserLike {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

function toUserRecord(user: PrismaUserLike): UserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
  };
}

interface PrismaSubscriptionLike {
  status: string;
  priceAmount: Prisma.Decimal | null;
  currency: string;
  currentPeriodEnd: Date | null;
}

/** Kullanici basina en fazla bir abonelik vardir (subscriptions_user_id_key). */
function toSubscriptionRecord(subscriptions: PrismaSubscriptionLike[]): SubscriptionRecord | null {
  const subscription = subscriptions[0];
  if (subscription === undefined) {
    return null;
  }
  return {
    status: subscription.status as SubscriptionRecord['status'],
    priceAmount: subscription.priceAmount === null ? null : subscription.priceAmount.toFixed(2),
    currency: subscription.currency,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}
