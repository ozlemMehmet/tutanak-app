// Veri katmani siniri (CLAUDE.md §3.4, §7 Repository): Prisma cagrilari ve Prisma tipleri
// bu dosyanin disina cikmaz. Abonelik/odeme satirlarinin yasam dongusu §3.12 + §3.13'tedir;
// bu dosya o kurallarin SQL karsiligidir, kurali kendisi belirlemez.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Prisma unique kisit ihlali (subscriptions_user_id_key → SQLSTATE 23505). */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

export interface SubscriptionRecord {
  id: string;
  status: 'inactive' | 'pending' | 'active';
}

interface GetOrCreateSubscriptionInput {
  userId: string;
  currency: string;
  provider: string;
}

interface StartPaymentInput {
  subscriptionId: string;
  providerReference: string;
  /** numeric(12,2) — METIN olarak yazilir, float'a cevrilmez (CLAUDE.md §5.1). */
  amount: string;
  currency: string;
}

export interface ApplyNotificationInput {
  providerReference: string;
  paymentStatus: 'succeeded' | 'failed';
  failureReason: string | null;
  subscription: {
    status: 'active' | 'inactive';
    currentPeriodEnd: Date | null;
    /** true iken abonelik `active` ise DOKUNULMAZ (§3.12: failed durumu dusurmez). */
    skipWhenActive: boolean;
  };
}

export interface ApplyNotificationResult {
  /** Kosullu guncelleme 1 satir etkiledi mi (§3.13: 0 ise hicbir alan degismez). */
  applied: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_VIOLATION
  );
}

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Abonelik satiri kullanici basina TEKTIR (subscriptions_user_id_key) ve ilk kez BURADA
   * dogar (CLAUDE.md §3.11). Once INSERT denenir, kisit ihlalinde mevcut satir okunur —
   * "once oku sonra yaz" yarisi bu sayede yapisal olarak imkansizdir (§7 get-or-create).
   */
  async getOrCreateSubscription(input: GetOrCreateSubscriptionInput): Promise<SubscriptionRecord> {
    try {
      const created = await this.prisma.subscription.create({
        data: { userId: input.userId, currency: input.currency, provider: input.provider },
      });
      return { id: created.id, status: created.status };
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const existing = await this.prisma.subscription.findUniqueOrThrow({
        where: { userId: input.userId },
      });
      return { id: existing.id, status: existing.status };
    }
  }

  /**
   * Odeme satirini yazar ve aboneligi AYNI transaction icinde `pending`e tasir
   * (CLAUDE.md §3.12, §3.13). Tutar/para birimi yapilandirmadan gelir.
   */
  async startPayment(input: StartPaymentInput): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.paymentTransaction.create({
        data: {
          subscriptionId: input.subscriptionId,
          providerReference: input.providerReference,
          amount: input.amount,
          currency: input.currency,
        },
      }),
      this.prisma.subscription.update({
        where: { id: input.subscriptionId },
        data: { status: 'pending', priceAmount: input.amount, currency: input.currency },
      }),
    ]);
  }

  /**
   * Bildirimi TEK kosullu guncellemeyle isler (CLAUDE.md §3.13): satir yalnizca
   * `processed_at IS NULL` iken guncellenir. Etkilenen satir 1 ise abonelik gecisi AYNI
   * transaction icinde uygulanir; 0 ise (mukerrer bildirim veya taninmayan referans)
   * hicbir abonelik/odeme alani degismez. Yeni odeme satiri YAZILMAZ.
   */
  async applyNotification(input: ApplyNotificationInput): Promise<ApplyNotificationResult> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentTransaction.updateMany({
        where: { providerReference: input.providerReference, processedAt: null },
        data: {
          status: input.paymentStatus,
          failureReason: input.failureReason,
          processedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return { applied: false };
      }

      const payment = await tx.paymentTransaction.findUniqueOrThrow({
        where: { providerReference: input.providerReference },
        select: { subscriptionId: true },
      });

      // Abonelik, bildirim govdesinden DEGIL, guncellenen odeme satirindan turetilir (§3.13).
      await tx.subscription.updateMany({
        where: {
          id: payment.subscriptionId,
          ...(input.subscription.skipWhenActive ? { status: { not: 'active' } } : {}),
        },
        data: {
          status: input.subscription.status,
          currentPeriodEnd: input.subscription.currentPeriodEnd,
        },
      });

      return { applied: true };
    });
  }
}
