// POST/GET /reports/{reportId}/share-link + POST .../share-link/email — api-contract: T-008.
// Controller yalnizca HTTP baglama + servis cagirma yapar (CLAUDE.md §3.1). POST her iki
// durumda da (yeni uretilmis veya mevcut link) 201 doner — sozlesmede boyle tanimlidir.

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ShareDeliveryDto, ShareLinkDto } from './dto/share-link.dto';
import { SendShareEmailDto } from './dto/send-share-email.dto';
import { ShareLinkService } from './share-link.service';

@Controller('reports/:reportId/share-link')
export class SharingController {
  constructor(private readonly shareLinkService: ShareLinkService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
  ): Promise<ShareLinkDto> {
    return this.shareLinkService.issueShareLink(reportId, user.userId);
  }

  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
  ): Promise<ShareLinkDto> {
    return this.shareLinkService.getShareLink(reportId, user.userId);
  }

  @Post('email')
  @HttpCode(HttpStatus.ACCEPTED)
  sendEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
    @Body() body: SendShareEmailDto,
  ): Promise<ShareDeliveryDto> {
    return this.shareLinkService.sendShareEmail(reportId, user.userId, body.recipientEmail);
  }
}
