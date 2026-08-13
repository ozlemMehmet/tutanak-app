import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { BillingRepository } from './billing.repository';

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const CLIENT_VERSION = '6.19.3';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBSCRIPTION_ID = '22222222-2222-4222-8222-222222222222';
const PERIOD_END = new Date('2026-09-12T10:00:00.000Z');

interface SubscriptionDelegate {
  create?: jest.Mock;
  findUnique?: jest.Mock;
  findUniqueOrThrow?: jest.Mock;
  update?: jest.Mock;
  updateMany?: jest.Mock;
}

interface PaymentDelegate {
  create?: jest.Mock;
  updateMany?: jest.Mock;
  findUniqueOrThrow?: jest.Mock;
}

/**
 * Prisma yerine sahte delegeler baglanir; birim testte gercek veritabani KULLANILMAZ
 * (§8.1). Kisitlarin kendisi e2e testinde gercek Postgres'e karsi dogrulanir (§8.2).
 */
function repositoryWith(
  subscription: SubscriptionDelegate,
  paymentTransaction: PaymentDelegate = {},
): BillingRepository {
  // Dizi bicimi (startPayment) ve geri cagirim bicimi (applyNotification) ayni sahtede.
  const runTransaction = async (arg: unknown): Promise<unknown> =>
    typeof arg === 'function'
      ? await (arg as (tx: unknown) => Promise<unknown>)(client)
      : await Promise.all(arg as Promise<unknown>[]);
  const client: Record<string, unknown> = {
    subscription,
    paymentTransaction,
    $transaction: jest.fn(runTransaction),
  };
  return new BillingRepository(client as unknown as PrismaService);
}

describe('BillingRepository.getOrCreateSubscription', () => {
  it('satir yokken yapilandirmadaki saglayici adi ve para birimiyle olusturur', async () => {
    const create = jest.fn().mockResolvedValue({ id: SUBSCRIPTION_ID, status: 'inactive' });
    const repository = repositoryWith({ create });

    const result = await repository.getOrCreateSubscription({
      userId: USER_ID,
      currency: 'TRY',
      provider: 'fake',
    });

    expect(create).toHaveBeenCalledWith({
      data: { userId: USER_ID, currency: 'TRY', provider: 'fake' },
    });
    expect(result).toEqual({ id: SUBSCRIPTION_ID, status: 'inactive' });
  });

  it('kullanici basina tek satir kisiti ihlal edilirse mevcut satiri doner (get-or-create)', async () => {
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: PRISMA_UNIQUE_VIOLATION,
      clientVersion: CLIENT_VERSION,
    });
    const findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: SUBSCRIPTION_ID, status: 'active' });
    const repository = repositoryWith({
      create: jest.fn().mockRejectedValue(uniqueViolation),
      findUniqueOrThrow,
    });

    const result = await repository.getOrCreateSubscription({
      userId: USER_ID,
      currency: 'TRY',
      provider: 'fake',
    });

    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(result).toEqual({ id: SUBSCRIPTION_ID, status: 'active' });
  });

  it('kisit disi veritabani hatalarini oldugu gibi yukari birakir', async () => {
    const repository = repositoryWith({
      create: jest.fn().mockRejectedValue(new Error('baglanti')),
    });

    await expect(
      repository.getOrCreateSubscription({ userId: USER_ID, currency: 'TRY', provider: 'fake' }),
    ).rejects.toThrow('baglanti');
  });
});

describe('BillingRepository.startPayment', () => {
  it('odeme satirini yazar ve aboneligi ayni transaction icinde pending yapar', async () => {
    const create = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({});
    const repository = repositoryWith({ update }, { create });

    await repository.startPayment({
      subscriptionId: SUBSCRIPTION_ID,
      providerReference: 'ref-1',
      amount: '199.00',
      currency: 'TRY',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        subscriptionId: SUBSCRIPTION_ID,
        providerReference: 'ref-1',
        // Tutar METIN olarak yazilir (numeric(12,2)); float'a cevrilmez.
        amount: '199.00',
        currency: 'TRY',
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: SUBSCRIPTION_ID },
      data: { status: 'pending', priceAmount: '199.00', currency: 'TRY' },
    });
  });
});

describe('BillingRepository.applyNotification', () => {
  const succeededInput = {
    providerReference: 'ref-1',
    paymentStatus: 'succeeded' as const,
    failureReason: null,
    subscription: {
      status: 'active' as const,
      currentPeriodEnd: PERIOD_END,
      skipWhenActive: false,
    },
  };

  it('odeme satirini YALNIZCA processed_at NULL iken gunceller (idempotans kosulu)', async () => {
    const paymentUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = repositoryWith(
      { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      {
        updateMany: paymentUpdateMany,
        findUniqueOrThrow: jest.fn().mockResolvedValue({ subscriptionId: SUBSCRIPTION_ID }),
      },
    );

    await repository.applyNotification(succeededInput);

    expect(paymentUpdateMany).toHaveBeenCalledWith({
      // processed_at IS NULL kosulu idempotansin mekanizmasidir (§3.13).
      where: { providerReference: 'ref-1', processedAt: null },
      data: { status: 'succeeded', failureReason: null, processedAt: expect.any(Date) as Date },
    });
  });

  it('succeeded bildiriminde aboneligi guncellenen ODEME SATIRINDAN turetip aktife alir', async () => {
    const subscriptionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = repositoryWith(
      { updateMany: subscriptionUpdateMany },
      {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ subscriptionId: SUBSCRIPTION_ID }),
      },
    );

    const result = await repository.applyNotification(succeededInput);

    expect(subscriptionUpdateMany).toHaveBeenCalledWith({
      where: { id: SUBSCRIPTION_ID },
      data: { status: 'active', currentPeriodEnd: PERIOD_END },
    });
    expect(result).toEqual({ applied: true });
  });

  it('failed bildiriminde aktif aboneligi disarida birakan kosulu uygular (§3.12)', async () => {
    const subscriptionUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const repository = repositoryWith(
      { updateMany: subscriptionUpdateMany },
      {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ subscriptionId: SUBSCRIPTION_ID }),
      },
    );

    await repository.applyNotification({
      providerReference: 'ref-2',
      paymentStatus: 'failed',
      failureReason: 'kart reddedildi',
      subscription: { status: 'inactive', currentPeriodEnd: null, skipWhenActive: true },
    });

    expect(subscriptionUpdateMany).toHaveBeenCalledWith({
      where: { id: SUBSCRIPTION_ID, status: { not: 'active' } },
      data: { status: 'inactive', currentPeriodEnd: null },
    });
  });

  it('etkilenen satir 0 iken abonelik tablosuna HIC dokunmaz ve applied=false doner', async () => {
    const subscriptionUpdateMany = jest.fn();
    const findUniqueOrThrow = jest.fn();
    const repository = repositoryWith(
      { updateMany: subscriptionUpdateMany },
      { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow },
    );

    const result = await repository.applyNotification(succeededInput);

    expect(result).toEqual({ applied: false });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(subscriptionUpdateMany).not.toHaveBeenCalled();
  });
});
