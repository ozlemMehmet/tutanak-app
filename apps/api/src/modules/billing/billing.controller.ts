// Odeme eylem endpoint'leri: /billing/checkout ve /billing/webhook sozlesmede tanimli
// bilincli isimlendirme istisnasidir (CLAUDE.md §2).

import type { RawBodyRequest } from '@nestjs/common';
import { Controller, Headers, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { PaymentPort } from '../../infra/payment/payment.port';
import { PAYMENT_PORT } from '../../infra/payment/payment.port';
import { BillingService } from './billing.service';
import type { CheckoutDto } from './dto/billing.dto';

/** api-contract.yaml → /billing/webhook parametresi. */
const SIGNATURE_HEADER = 'X-Iyzico-Signature';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    @Inject(PAYMENT_PORT) private readonly payment: PaymentPort,
  ) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  startCheckout(@CurrentUser() user: AuthenticatedUser): Promise<CheckoutDto> {
    return this.billingService.startCheckout({ userId: user.userId, email: user.email });
  }

  /**
   * Govde BIZE degil saglayiciya aittir: bu route'ta DTO TANIMLANMAZ, dolayisiyla
   * `forbidNonWhitelisted` devreye girmez ve sema disi alanlar 400 URETMEZ
   * (CLAUDE.md §3.7 istisna 2). Imza dogrulama + kanonik sekle cevirme port'un isidir
   * (§3.13); servis yalnizca kanonik bildirimi gorur.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleNotification(
    @Req() request: RawBodyRequest<Request>,
    @Headers(SIGNATURE_HEADER) signature?: string,
  ): Promise<void> {
    const notification = this.payment.verifyAndParseNotification(request.rawBody, signature);
    return this.billingService.handleNotification(notification);
  }
}
