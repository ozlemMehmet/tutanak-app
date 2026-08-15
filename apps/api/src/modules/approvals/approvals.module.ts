import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsRepository } from './approvals.repository';
import { ApprovalsService } from './approvals.service';

// Modul disariya bagimli degildir: paylasim linkinin cozumu ve onay yazimi tek bir
// transaction sinirinda oldugu icin sharing/reports modullerine RUNTIME bagimlilik
// kurulmaz (yalnizca DTO tipleri diger modullerce buradan okunur).
@Module({
  imports: [PrismaModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalsRepository],
})
export class ApprovalsModule {}
