import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';
import { PhotosModule } from '../photos/photos.module';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

// Bagimlilik yonu tek yonludur: reports -> photos, reports -> pdf. Fotograf modulu
// sahiplik icin tutanak satirini kendi deposundan okur; boylece modul grafi dongusuz kalir.
@Module({
  imports: [PrismaModule, PhotosModule, PdfModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository],
})
export class ReportsModule {}
