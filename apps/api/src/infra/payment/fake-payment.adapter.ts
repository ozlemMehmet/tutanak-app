// Yerel calistirma ve testler icin sahte odeme saglayicisi (CLAUDE.md §7, §10):
// `docker compose up` ve QA kosumu dis hesap/anahtar GEREKTIRMEZ (PAYMENT_PROVIDER=fake).
// Kanonik bildirim govdesini BIREBIR kabul eder (architecture.md §8.5).

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { UnauthenticatedError } from '../../common/errors/app-error';
import { parseJsonBody, parsePaymentNotification } from './payment-notification.parser';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentNotification,
  PaymentPort,
} from './payment.port';

const FAKE_REFERENCE_PREFIX = 'fake';

@Injectable()
export class FakePaymentAdapter implements PaymentPort {
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const transactionReference = `${FAKE_REFERENCE_PREFIX}-${randomUUID()}`;
    // Sahte saglayici, kullaniciyi dogrudan yapilandirilmis donus adresine gonderir;
    // adres koda gomulmez, cagirandan (yapilandirmadan) gelir.
    const checkoutUrl = new URL(request.callbackUrl);
    checkoutUrl.searchParams.set('ref', transactionReference);
    return Promise.resolve({ transactionReference, checkoutUrl: checkoutUrl.toString() });
  }

  /**
   * Yerelde dogrulanacak bir HMAC sirri yoktur (IYZICO_* yalnizca gercek saglayicida
   * zorunludur); bu yuzden yalnizca imza basliginin VARLIGI aranir. Uretimde bu adapter
   * kullanilmaz — PAYMENT_PROVIDER=iyzico ile gercek imza dogrulamasi devrededir.
   */
  verifyAndParseNotification(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): PaymentNotification {
    if (signature === undefined || signature.trim() === '') {
      throw new UnauthenticatedError('INVALID_WEBHOOK_SIGNATURE', 'Bildirim imzası doğrulanamadı.');
    }
    return parsePaymentNotification(parseJsonBody(rawBody));
  }
}
