import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { PaymentNotification, PaymentPort } from '../../infra/payment/payment.port';
import { BillingController } from './billing.controller';
import type { BillingService } from './billing.service';

const CHECKOUT_DTO = {
  transactionReference: 'ref-1',
  checkoutUrl: 'https://odeme.example/oturum/1',
  amount: '199.00',
  currency: 'TRY',
};

const NOTIFICATION: PaymentNotification = {
  providerReference: 'ref-1',
  status: 'succeeded',
  failureReason: null,
};

function rawRequest(rawBody: Buffer | undefined): RawBodyRequest<Request> {
  return { rawBody } as RawBodyRequest<Request>;
}

describe('BillingController.startCheckout', () => {
  it("odemeyi yalnizca token'daki kullanici kimligi ile baslatir", async () => {
    const startCheckout = jest.fn().mockResolvedValue(CHECKOUT_DTO);
    const controller = new BillingController({ startCheckout } as unknown as BillingService, {
      createCheckout: jest.fn(),
      verifyAndParseNotification: jest.fn(),
    });

    const result = await controller.startCheckout({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'selin@ornek.test',
    });

    expect(startCheckout).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'selin@ornek.test',
    });
    expect(result).toEqual(CHECKOUT_DTO);
  });
});

describe('BillingController.handleNotification', () => {
  it('ham govdeyi ve imzayi port a verir, servise yalnizca kanonik bildirimi tasir (§3.13)', async () => {
    const verifyAndParseNotification = jest.fn().mockReturnValue(NOTIFICATION);
    const handleNotification = jest.fn().mockResolvedValue(undefined);
    const payment = {
      createCheckout: jest.fn(),
      verifyAndParseNotification,
    } as unknown as PaymentPort;
    const controller = new BillingController(
      { handleNotification } as unknown as BillingService,
      payment,
    );
    const rawBody = Buffer.from('{"providerReference":"ref-1","status":"succeeded"}', 'utf8');

    await controller.handleNotification(rawRequest(rawBody), 'imza-degeri');

    expect(verifyAndParseNotification).toHaveBeenCalledWith(rawBody, 'imza-degeri');
    expect(handleNotification).toHaveBeenCalledWith(NOTIFICATION);
  });

  it('imza dogrulanamazsa servis HIC cagrilmaz (durum degismez)', () => {
    const verifyAndParseNotification = jest.fn().mockImplementation(() => {
      throw new Error('imza gecersiz');
    });
    const handleNotification = jest.fn();
    const controller = new BillingController({ handleNotification } as unknown as BillingService, {
      createCheckout: jest.fn(),
      verifyAndParseNotification,
    });

    // Imza hatasi SENKRON firlatilir: servis cagrisina hic ulasilmaz.
    expect(() => controller.handleNotification(rawRequest(undefined), undefined)).toThrow();
    expect(handleNotification).not.toHaveBeenCalled();
  });
});
