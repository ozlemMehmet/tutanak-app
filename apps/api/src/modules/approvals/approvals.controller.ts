// POST /public/reports/{shareToken}/approval — api-contract: T-010 (tag: public, security: []).
// Controller yalnizca HTTP baglama + servis cagirma yapar (CLAUDE.md §3.1).

import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import type { ApprovalDto } from './dto/approval.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ApprovalsService } from './approvals.service';

@Controller('public/reports/:shareToken/approval')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  /**
   * Kimlik dogrulamasi GEREKTIRMEZ: kiraci hesap acmadan tek tikla onaylar (@Public ile
   * global JwtAuthGuard atlanir). Token bir yol parametresidir ve DTO dogrulamasindan
   * gecmez: gecersiz her deger 400 degil, 404'tur (sozlesme bu endpoint icin token
   * bicimine dair 400 tanimlamaz).
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  approve(
    @Param('shareToken') shareToken: string,
    @Body() body: CreateApprovalDto,
  ): Promise<ApprovalDto> {
    return this.approvalsService.approveByShareToken(shareToken, body.approverEmail);
  }
}
