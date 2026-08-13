import { Module } from '@nestjs/common';
import { StorageModule } from '../../infra/storage/storage.module';
import { ReportPdfService } from './report-pdf.service';

// PDF uretimi tek yonlu bir bagimliliktir: reports -> pdf -> infra/storage
// (architecture.md §2 modul grafi). PDF modulu veri katmanina dokunmaz.
@Module({
  imports: [StorageModule],
  providers: [ReportPdfService],
  exports: [ReportPdfService],
})
export class PdfModule {}
