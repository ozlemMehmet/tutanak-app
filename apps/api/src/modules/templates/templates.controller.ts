// GET /templates ve GET /templates/{templateId} — hazir sablon listesi ve secim
// dogrulamasi (api-contract.yaml: T-004). Her iki endpoint de global JwtAuthGuard
// altindadir; @Public() KONULMAZ (sozlesme: 401 tanimli).

import { Controller, Get, Param } from '@nestjs/common';
import type { TemplateDto } from './dto/template.dto';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  list(): Promise<TemplateDto[]> {
    return this.templatesService.listTemplates();
  }

  @Get(':templateId')
  getById(@Param('templateId') templateId: string): Promise<TemplateDto> {
    return this.templatesService.getTemplate(templateId);
  }
}
