// Gercek odeme saglayicisi adapter'i (CLAUDE.md §7 Adapter + Port, architecture.md §8.5).
// SORUMLULUKLARI: (1) odeme oturumu acmak, (2) bildirim imzasini HAM govde uzerinde
// dogrulamak ve saglayici alan adlarini KANONIK sekle cevirmek. Saglayiciya ozgu hicbir
// alan adi bu dosyanin disina cikmaz.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ExternalServiceError, UnauthenticatedError } from '../../common/errors/app-error';
import { parseJsonBody, parsePaymentNotification, readString } from './payment-notification.parser';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentNotification,
  PaymentNotificationStatus,
  PaymentPort,
} from './payment.port';

/** iyzipay istemcisinin bu urunde kullanilan tek yuzeyi (v2 tip tanimi sunmuyor). */
export interface IyzipayCheckoutClient {
  checkoutFormInitialize: {
    create(
      request: Record<string, unknown>,
      callback: (error: unknown, result: unknown) => void,
    ): void;
  };
}

export interface IyzicoAdapterOptions {
  /** Bildirim imzasinin (HMAC) dogrulandigi sir; API anahtarlari istemcinin icindedir. */
  webhookSecret: string;
}

const PROVIDER_ERROR_MESSAGE = 'Ödeme sağlayıcısına ulaşılamadı, lütfen tekrar deneyin.';
const LOCALE_TR = 'tr';
const PAYMENT_GROUP_SUBSCRIPTION = 'SUBSCRIPTION';
const BASKET_ITEM_TYPE_VIRTUAL = 'VIRTUAL';
const SUBSCRIPTION_BASKET_ITEM_ID = 'aylik-abonelik';
/** Saglayicinin odeme sayfasinda KULLANICIYA gorunen kalem adi (H-002: duzgun Turkce). */
const SUBSCRIPTION_BASKET_ITEM_NAME = 'Aylık abonelik';
const SUBSCRIPTION_BASKET_CATEGORY = 'Abonelik';

// Saglayici bildirimindeki durum degerleri -> kanonik durum (architecture.md §8.5).
const PROVIDER_STATUS_MAP = new Map<string, PaymentNotificationStatus>([
  ['SUCCESS', 'succeeded'],
  ['FAILURE', 'failed'],
]);

/**
 * SOZLESME BOSLUGU (design.md §6.2): urun ad/soyad, kimlik numarasi, telefon ve adres
 * TOPLAMIYOR; iyzico ise bu alanlari zorunlu tutuyor. Kimlik iddiasi tasimayan sabit yer
 * tutucular gonderilir — gercek kart/kimlik dogrulamasi saglayici tarafinda yapilir.
 * Sema bu alanlarla genisletilirse burasi gercek degerlerle degistirilmelidir.
 */
const BUYER_PLACEHOLDER = {
  name: 'Tutanak',
  surname: 'Kullanicisi',
  identityNumber: '11111111111',
  registrationAddress: 'Bilgi toplanmadi',
  city: 'Istanbul',
  country: 'Turkey',
  ip: '0.0.0.0',
} as const;

@Injectable()
export class IyzicoPaymentAdapter implements PaymentPort {
  constructor(
    private readonly options: IyzicoAdapterOptions,
    private readonly client: IyzipayCheckoutClient,
  ) {}

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const result = await this.initializeCheckoutForm(request);

    const status = readString(result, 'status');
    const token = readString(result, 'token');
    const paymentPageUrl = readString(result, 'paymentPageUrl');

    if (status !== 'success' || token === undefined || paymentPageUrl === undefined) {
      // Saglayicinin ham hata metni istemciye SIZDIRILMAZ (CLAUDE.md §4.3).
      throw new ExternalServiceError('PAYMENT_PROVIDER_ERROR', PROVIDER_ERROR_MESSAGE);
    }

    return { transactionReference: token, checkoutUrl: paymentPageUrl };
  }

  verifyAndParseNotification(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): PaymentNotification {
    // Govde, imza dogrulanmadan HICBIR sekilde ayristirilmaz (architecture.md §7).
    this.assertValidSignature(rawBody, signature);

    const body = parseJsonBody(rawBody);
    const providerStatus = readString(body, 'status');
    return parsePaymentNotification({
      providerReference: readString(body, 'token'),
      status:
        providerStatus === undefined
          ? undefined
          : PROVIDER_STATUS_MAP.get(providerStatus.toUpperCase()),
      failureReason: readString(body, 'errorMessage'),
    });
  }

  /** HMAC-SHA256, ham govde uzerinde ve sabit zamanda karsilastirilir (architecture.md §7). */
  private assertValidSignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    const invalid = new UnauthenticatedError(
      'INVALID_WEBHOOK_SIGNATURE',
      'Bildirim imzası doğrulanamadı.',
    );
    if (rawBody === undefined || signature === undefined || signature.length === 0) {
      throw invalid;
    }

    const expected = Buffer.from(
      createHmac('sha256', this.options.webhookSecret).update(rawBody).digest('hex'),
      'utf8',
    );
    const received = Buffer.from(signature, 'utf8');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw invalid;
    }
  }

  private initializeCheckoutForm(request: CheckoutRequest): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      this.client.checkoutFormInitialize.create(
        this.toProviderRequest(request),
        (error: unknown, result: unknown) => {
          if (error !== null && error !== undefined) {
            reject(new ExternalServiceError('PAYMENT_PROVIDER_ERROR', PROVIDER_ERROR_MESSAGE));
            return;
          }
          if (typeof result !== 'object' || result === null) {
            reject(new ExternalServiceError('PAYMENT_PROVIDER_ERROR', PROVIDER_ERROR_MESSAGE));
            return;
          }
          resolve(result as Record<string, unknown>);
        },
      );
    });
  }

  /** Tutar METIN olarak gonderilir; para hicbir asamada float'a cevrilmez (CLAUDE.md §5.1). */
  private toProviderRequest(request: CheckoutRequest): Record<string, unknown> {
    return {
      locale: LOCALE_TR,
      conversationId: request.userId,
      price: request.amount,
      paidPrice: request.amount,
      currency: request.currency,
      basketId: SUBSCRIPTION_BASKET_ITEM_ID,
      paymentGroup: PAYMENT_GROUP_SUBSCRIPTION,
      callbackUrl: request.callbackUrl,
      buyer: {
        id: request.userId,
        email: request.email,
        ...BUYER_PLACEHOLDER,
      },
      billingAddress: {
        contactName: `${BUYER_PLACEHOLDER.name} ${BUYER_PLACEHOLDER.surname}`,
        city: BUYER_PLACEHOLDER.city,
        country: BUYER_PLACEHOLDER.country,
        address: BUYER_PLACEHOLDER.registrationAddress,
      },
      basketItems: [
        {
          id: SUBSCRIPTION_BASKET_ITEM_ID,
          name: SUBSCRIPTION_BASKET_ITEM_NAME,
          category1: SUBSCRIPTION_BASKET_CATEGORY,
          itemType: BASKET_ITEM_TYPE_VIRTUAL,
          price: request.amount,
        },
      ],
    };
  }
}
