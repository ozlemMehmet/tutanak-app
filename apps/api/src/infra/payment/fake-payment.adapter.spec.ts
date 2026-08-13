import { UnauthenticatedError, ValidationError } from '../../common/errors/app-error';
import { FakePaymentAdapter } from './fake-payment.adapter';

const CHECKOUT_REQUEST = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'selin@ornek.test',
  amount: '199.00',
  currency: 'TRY',
  callbackUrl: 'http://localhost:5173/subscription?checkout=return',
};

const ANY_SIGNATURE = 'yerel-sahte-imza';

function body(payload: unknown): Buffer {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

describe('FakePaymentAdapter.createCheckout', () => {
  it('islem referansi ve donus adresini iceren bir odeme adresi doner', async () => {
    const adapter = new FakePaymentAdapter();

    const session = await adapter.createCheckout(CHECKOUT_REQUEST);

    expect(session.transactionReference.length).toBeGreaterThan(0);
    const url = new URL(session.checkoutUrl);
    // Donus adresi yapilandirmadan gelir (ticket sozlesme boslugu notu): koda gomulmez.
    expect(url.origin).toBe('http://localhost:5173');
    expect(url.pathname).toBe('/subscription');
    expect(url.searchParams.get('checkout')).toBe('return');
  });

  it('her cagrida farkli bir islem referansi uretir (idempotans anahtari tekildir)', async () => {
    const adapter = new FakePaymentAdapter();

    const first = await adapter.createCheckout(CHECKOUT_REQUEST);
    const second = await adapter.createCheckout(CHECKOUT_REQUEST);

    expect(first.transactionReference).not.toBe(second.transactionReference);
  });
});

describe('FakePaymentAdapter.verifyAndParseNotification', () => {
  const adapter = new FakePaymentAdapter();

  it('imza basligi yoksa INVALID_WEBHOOK_SIGNATURE firlatir', () => {
    expect(() =>
      adapter.verifyAndParseNotification(
        body({ providerReference: 'ref-1', status: 'succeeded' }),
        undefined,
      ),
    ).toThrow(UnauthenticatedError);
  });

  it('imza basligi bossa INVALID_WEBHOOK_SIGNATURE firlatir', () => {
    expect(() =>
      adapter.verifyAndParseNotification(
        body({ providerReference: 'ref-1', status: 'succeeded' }),
        '   ',
      ),
    ).toThrow(UnauthenticatedError);
  });

  it('kanonik govdeyi birebir kabul eder (QA ve yerel kosum bu govdeyi gonderir)', () => {
    const notification = adapter.verifyAndParseNotification(
      body({ providerReference: 'ref-1', status: 'succeeded' }),
      ANY_SIGNATURE,
    );

    expect(notification).toEqual({
      providerReference: 'ref-1',
      status: 'succeeded',
      failureReason: null,
    });
  });

  it('failed bildiriminde saglayicinin nedenini tasir', () => {
    const notification = adapter.verifyAndParseNotification(
      body({ providerReference: 'ref-2', status: 'failed', failureReason: 'karti reddedildi' }),
      ANY_SIGNATURE,
    );

    expect(notification).toEqual({
      providerReference: 'ref-2',
      status: 'failed',
      failureReason: 'karti reddedildi',
    });
  });

  it('sema disi ek alanlari sessizce ayiklar (CLAUDE.md §3.7 istisna 2)', () => {
    const notification = adapter.verifyAndParseNotification(
      body({
        providerReference: 'ref-3',
        status: 'succeeded',
        iyziEventType: 'CHECKOUTFORM_AUTH',
        merchantId: 12345,
      }),
      ANY_SIGNATURE,
    );

    expect(notification).toEqual({
      providerReference: 'ref-3',
      status: 'succeeded',
      failureReason: null,
    });
  });

  it('providerReference eksikse ValidationError firlatir', () => {
    expect(() =>
      adapter.verifyAndParseNotification(body({ status: 'succeeded' }), ANY_SIGNATURE),
    ).toThrow(ValidationError);
  });

  it('status taninmayan bir degerse ValidationError firlatir', () => {
    expect(() =>
      adapter.verifyAndParseNotification(
        body({ providerReference: 'ref-4', status: 'pending' }),
        ANY_SIGNATURE,
      ),
    ).toThrow(ValidationError);
  });

  it('govde gecerli JSON degilse ValidationError firlatir', () => {
    expect(() =>
      adapter.verifyAndParseNotification(Buffer.from('bu json degil', 'utf8'), ANY_SIGNATURE),
    ).toThrow(ValidationError);
  });

  it('ham govde hic yoksa ValidationError firlatir', () => {
    expect(() => adapter.verifyAndParseNotification(undefined, ANY_SIGNATURE)).toThrow(
      ValidationError,
    );
  });
});
