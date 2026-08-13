import { ConflictError, ExternalServiceError } from '../../common/errors/app-error';
import type { BillingConfig } from '../../config/config.tokens';
import type { CheckoutSession } from '../../infra/payment/payment.port';
import type {
  ApplyNotificationInput,
  BillingRepository,
  SubscriptionRecord,
} from './billing.repository';
import { BillingService } from './billing.service';

const USER = { userId: '11111111-1111-4111-8111-111111111111', email: 'selin@ornek.test' };

const CONFIG: BillingConfig = {
  priceAmount: '199.00',
  currency: 'TRY',
  periodDays: 30,
  provider: 'fake',
  checkoutCallbackUrl: 'http://localhost:5173/subscription?checkout=return',
};

const SESSION: CheckoutSession = {
  transactionReference: 'ref-1',
  checkoutUrl: 'https://odeme.example/oturum/1',
};

const MS_PER_DAY = 86_400_000;
// DB/sunucu saatiyle test saatinin karsilastirildigi yerde iki tarafli pay (CLAUDE.md §8.5).
const CLOCK_SKEW_TOLERANCE_MS = 5000;

interface Doubles {
  repository: {
    getOrCreateSubscription: jest.Mock;
    startPayment: jest.Mock;
    applyNotification: jest.Mock;
  };
  payment: {
    createCheckout: jest.Mock;
    verifyAndParseNotification: jest.Mock;
  };
  /** applyNotification'a giden girdiler — tip guvenli dogrulama icin toplanir. */
  notifications: ApplyNotificationInput[];
}

function build(
  overrides: {
    subscription?: SubscriptionRecord;
    createCheckout?: jest.Mock;
    applied?: boolean;
  } = {},
): { service: BillingService } & Doubles {
  const notifications: ApplyNotificationInput[] = [];
  const repository = {
    getOrCreateSubscription: jest
      .fn()
      .mockResolvedValue(overrides.subscription ?? { id: 'sub-1', status: 'inactive' }),
    startPayment: jest.fn().mockResolvedValue(undefined),
    applyNotification: jest.fn((input: ApplyNotificationInput) => {
      notifications.push(input);
      return Promise.resolve({ applied: overrides.applied ?? true });
    }),
  };
  const payment = {
    createCheckout: overrides.createCheckout ?? jest.fn().mockResolvedValue(SESSION),
    verifyAndParseNotification: jest.fn(),
  };
  const service = new BillingService(repository as unknown as BillingRepository, payment, CONFIG);
  return { service, repository, payment, notifications };
}

describe('BillingService.startCheckout', () => {
  it('abonelik satirini get-or-create ile alir ve yapilandirmadaki saglayici adiyla etiketler', async () => {
    const { service, repository } = build();

    await service.startCheckout(USER);

    expect(repository.getOrCreateSubscription).toHaveBeenCalledWith({
      userId: USER.userId,
      currency: 'TRY',
      provider: 'fake',
    });
  });

  it('tutari ve para birimini yapilandirmadan alir, donus adresini saglayiciya iletir', async () => {
    const { service, payment } = build();

    await service.startCheckout(USER);

    expect(payment.createCheckout).toHaveBeenCalledWith({
      userId: USER.userId,
      email: USER.email,
      amount: '199.00',
      currency: 'TRY',
      callbackUrl: CONFIG.checkoutCallbackUrl,
    });
  });

  it('sozlesmedeki CheckoutResponse alanlarini doner (tutar METIN olarak)', async () => {
    const { service } = build();

    const result = await service.startCheckout(USER);

    expect(result).toEqual({
      transactionReference: 'ref-1',
      checkoutUrl: 'https://odeme.example/oturum/1',
      amount: '199.00',
      currency: 'TRY',
    });
  });

  it('saglayici referansini ödeme satirina yazar ve aboneligi pending yapar (§3.12, §3.13)', async () => {
    const { service, repository } = build();

    await service.startCheckout(USER);

    expect(repository.startPayment).toHaveBeenCalledWith({
      subscriptionId: 'sub-1',
      providerReference: 'ref-1',
      amount: '199.00',
      currency: 'TRY',
    });
  });

  it('abonelik zaten aktifse SUBSCRIPTION_ALREADY_ACTIVE firlatir ve saglayiciya CIKMAZ', async () => {
    const { service, payment, repository } = build({
      subscription: { id: 'sub-1', status: 'active' },
    });

    await expect(service.startCheckout(USER)).rejects.toBeInstanceOf(ConflictError);
    expect(payment.createCheckout).not.toHaveBeenCalled();
    expect(repository.startPayment).not.toHaveBeenCalled();
  });

  it('abonelik pending iken yeni bir odeme baslatilabilir (terk edilmis odeme, §8.4)', async () => {
    const { service, repository } = build({ subscription: { id: 'sub-1', status: 'pending' } });

    await service.startCheckout(USER);

    expect(repository.startPayment).toHaveBeenCalledTimes(1);
  });

  it('saglayici cagrisi basarisizsa odeme satiri YAZILMAZ (§3.13)', async () => {
    const { service, repository } = build({
      createCheckout: jest
        .fn()
        .mockRejectedValue(
          new ExternalServiceError('PAYMENT_PROVIDER_ERROR', 'Odeme saglayicisina ulasilamadi.'),
        ),
    });

    await expect(service.startCheckout(USER)).rejects.toBeInstanceOf(ExternalServiceError);
    expect(repository.startPayment).not.toHaveBeenCalled();
  });
});

describe('BillingService.handleNotification', () => {
  it('succeeded bildiriminde aboneligi aktife tasir ve donem sonunu SUNUCUDA hesaplar', async () => {
    const { service, notifications } = build();
    const before = Date.now();

    await service.handleNotification({
      providerReference: 'ref-1',
      status: 'succeeded',
      failureReason: null,
    });

    const after = Date.now();
    const call = notifications[0];
    expect(call?.providerReference).toBe('ref-1');
    expect(call?.paymentStatus).toBe('succeeded');
    expect(call?.failureReason).toBeNull();
    expect(call?.subscription.status).toBe('active');
    expect(call?.subscription.skipWhenActive).toBe(false);
    const periodEnd = call?.subscription.currentPeriodEnd?.getTime() ?? 0;
    expect(periodEnd).toBeGreaterThanOrEqual(
      before + CONFIG.periodDays * MS_PER_DAY - CLOCK_SKEW_TOLERANCE_MS,
    );
    expect(periodEnd).toBeLessThanOrEqual(
      after + CONFIG.periodDays * MS_PER_DAY + CLOCK_SKEW_TOLERANCE_MS,
    );
  });

  it('failed bildiriminde aboneligi pasife tasir ve donem sonunu NULL birakir', async () => {
    const { service, repository } = build();

    await service.handleNotification({
      providerReference: 'ref-2',
      status: 'failed',
      failureReason: 'kart reddedildi',
    });

    expect(repository.applyNotification).toHaveBeenCalledWith({
      providerReference: 'ref-2',
      paymentStatus: 'failed',
      failureReason: 'kart reddedildi',
      subscription: { status: 'inactive', currentPeriodEnd: null, skipWhenActive: true },
    });
  });

  it('saglayici neden bildirmediyse sabit Turkce varsayilan neden yazilir (DB CHECK geregi)', async () => {
    const { service, notifications } = build();

    await service.handleNotification({
      providerReference: 'ref-3',
      status: 'failed',
      failureReason: null,
    });

    expect(notifications[0]?.failureReason?.length ?? 0).toBeGreaterThan(0);
  });

  it('etkilenen satir 0 iken (tekrar/taninmayan referans) hata firlatmaz', async () => {
    const { service } = build({ applied: false });

    await expect(
      service.handleNotification({
        providerReference: 'bilinmeyen',
        status: 'succeeded',
        failureReason: null,
      }),
    ).resolves.toBeUndefined();
  });
});
