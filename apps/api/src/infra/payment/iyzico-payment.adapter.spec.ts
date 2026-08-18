import { createHmac } from 'node:crypto';
import {
  ExternalServiceError,
  UnauthenticatedError,
  ValidationError,
} from '../../common/errors/app-error';
import type { IyzipayCheckoutClient } from './iyzico-payment.adapter';
import { IyzicoPaymentAdapter } from './iyzico-payment.adapter';

const OPTIONS = { webhookSecret: 'test-webhook-sirri' };

const CHECKOUT_REQUEST = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'selin@ornek.test',
  amount: '199.00',
  currency: 'TRY',
  callbackUrl: 'https://app.example.com/subscription?checkout=return',
};

interface ClientCall {
  request: Record<string, unknown>;
}

/** iyzipay istemcisinin yerine gecen sahte: gercek ag cagrisi birim testte YAPILMAZ (§8.1). */
function fakeClient(
  outcome: { error?: unknown; result?: unknown },
  calls: ClientCall[] = [],
): IyzipayCheckoutClient {
  return {
    checkoutFormInitialize: {
      create(request, callback): void {
        calls.push({ request });
        callback(outcome.error ?? null, outcome.result);
      },
    },
  };
}

function sign(rawBody: Buffer): string {
  return createHmac('sha256', OPTIONS.webhookSecret).update(rawBody).digest('hex');
}

function body(payload: unknown): Buffer {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

describe('IyzicoPaymentAdapter.createCheckout', () => {
  it('saglayici basariliyken islem referansi ve odeme sayfasi adresini doner', async () => {
    const adapter = new IyzicoPaymentAdapter(
      OPTIONS,
      fakeClient({
        result: {
          status: 'success',
          token: 'iyz-token-1',
          paymentPageUrl: 'https://sandbox-cpp.iyzipay.com/?token=iyz-token-1',
        },
      }),
    );

    const session = await adapter.createCheckout(CHECKOUT_REQUEST);

    expect(session).toEqual({
      transactionReference: 'iyz-token-1',
      checkoutUrl: 'https://sandbox-cpp.iyzipay.com/?token=iyz-token-1',
    });
  });

  it('tutari METIN olarak gonderir ve donus adresini istekten alir (float parse YOK)', async () => {
    const calls: ClientCall[] = [];
    const adapter = new IyzicoPaymentAdapter(
      OPTIONS,
      fakeClient(
        { result: { status: 'success', token: 't', paymentPageUrl: 'https://odeme.example/t' } },
        calls,
      ),
    );

    await adapter.createCheckout(CHECKOUT_REQUEST);

    const request = calls[0]?.request ?? {};
    expect(request.price).toBe('199.00');
    expect(request.paidPrice).toBe('199.00');
    expect(request.currency).toBe('TRY');
    expect(request.callbackUrl).toBe(CHECKOUT_REQUEST.callbackUrl);
  });

  it('saglayici hata dondurdugunde PAYMENT_PROVIDER_ERROR firlatir', async () => {
    const adapter = new IyzicoPaymentAdapter(
      OPTIONS,
      fakeClient({ error: new Error('baglanti yok') }),
    );

    await expect(adapter.createCheckout(CHECKOUT_REQUEST)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('saglayici hatasinda kullaniciya donen mesaj duzgun Turkce yazilir (H-002)', async () => {
    const adapter = new IyzicoPaymentAdapter(
      OPTIONS,
      fakeClient({ error: new Error('baglanti koptu') }),
    );

    await expect(adapter.createCheckout(CHECKOUT_REQUEST)).rejects.toMatchObject({
      message: 'Ödeme sağlayıcısına ulaşılamadı, lütfen tekrar deneyin.',
    });
  });

  it('saglayici yaniti basarisiz durumdayken PAYMENT_PROVIDER_ERROR firlatir', async () => {
    const adapter = new IyzicoPaymentAdapter(
      OPTIONS,
      fakeClient({ result: { status: 'failure', errorMessage: 'gecersiz istek' } }),
    );

    await expect(adapter.createCheckout(CHECKOUT_REQUEST)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('saglayici yanitinda odeme adresi yoksa PAYMENT_PROVIDER_ERROR firlatir', async () => {
    const adapter = new IyzicoPaymentAdapter(
      OPTIONS,
      fakeClient({ result: { status: 'success', token: 'iyz-token-2' } }),
    );

    await expect(adapter.createCheckout(CHECKOUT_REQUEST)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('saglayici hata mesajini istemciye sizdirmaz (CLAUDE.md §4.3)', async () => {
    const adapter = new IyzicoPaymentAdapter(
      OPTIONS,
      fakeClient({ result: { status: 'failure', errorMessage: 'merchant 42 icin kart limiti' } }),
    );

    await expect(adapter.createCheckout(CHECKOUT_REQUEST)).rejects.toThrow(/^(?!.*merchant 42).*$/);
  });
});

describe('IyzicoPaymentAdapter.verifyAndParseNotification', () => {
  const adapter = new IyzicoPaymentAdapter(OPTIONS, fakeClient({}));

  it('gecerli imzali SUCCESS bildirimini kanonik sekle cevirir', () => {
    const raw = body({
      iyziEventType: 'CHECKOUTFORM_AUTH',
      token: 'iyz-token-1',
      status: 'SUCCESS',
    });

    const notification = adapter.verifyAndParseNotification(raw, sign(raw));

    expect(notification).toEqual({
      providerReference: 'iyz-token-1',
      status: 'succeeded',
      failureReason: null,
    });
  });

  it('FAILURE bildirimini failed olarak cevirir ve saglayicinin nedenini tasir', () => {
    const raw = body({ token: 'iyz-token-2', status: 'FAILURE', errorMessage: 'kart reddedildi' });

    const notification = adapter.verifyAndParseNotification(raw, sign(raw));

    expect(notification).toEqual({
      providerReference: 'iyz-token-2',
      status: 'failed',
      failureReason: 'kart reddedildi',
    });
  });

  it('imza gecersizse INVALID_WEBHOOK_SIGNATURE firlatir ve govde AYRISTIRILMAZ', () => {
    const raw = body({ token: 'iyz-token-3', status: 'SUCCESS' });

    expect(() => adapter.verifyAndParseNotification(raw, 'gecersiz-imza')).toThrow(
      UnauthenticatedError,
    );
  });

  it('imza basligi yoksa INVALID_WEBHOOK_SIGNATURE firlatir', () => {
    const raw = body({ token: 'iyz-token-4', status: 'SUCCESS' });

    expect(() => adapter.verifyAndParseNotification(raw, undefined)).toThrow(UnauthenticatedError);
  });

  it('imza gecerliyken sema disi ek alanlar 400 URETMEZ (CLAUDE.md §3.7 istisna 2)', () => {
    const raw = body({
      token: 'iyz-token-5',
      status: 'SUCCESS',
      iyziPaymentId: 987,
      merchantId: 12345,
      beklenmeyenAlan: { derin: true },
    });

    expect(adapter.verifyAndParseNotification(raw, sign(raw)).providerReference).toBe(
      'iyz-token-5',
    );
  });

  it('zorunlu alan (token) eksikse ValidationError firlatir', () => {
    const raw = body({ status: 'SUCCESS' });

    expect(() => adapter.verifyAndParseNotification(raw, sign(raw))).toThrow(ValidationError);
  });

  it('taninmayan status degerinde ValidationError firlatir', () => {
    const raw = body({ token: 'iyz-token-6', status: 'INIT_THREEDS' });

    expect(() => adapter.verifyAndParseNotification(raw, sign(raw))).toThrow(ValidationError);
  });
});
