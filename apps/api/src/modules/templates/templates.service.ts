import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/app-error';
import type { TemplateDto } from './dto/template.dto';
import { toTemplateDto } from './mappers/template.mapper';
import { TemplatesRepository } from './templates.repository';

@Injectable()
export class TemplatesService {
  constructor(private readonly templatesRepository: TemplatesRepository) {}

  /** Hazir sablonlarin tam listesi (MVP'de sabit 3 kayit — PRD kapsam ici madde 3). */
  async listTemplates(): Promise<TemplateDto[]> {
    const templates = await this.templatesRepository.findAll();
    return templates.map(toTemplateDto);
  }

  /**
   * Sablon secimini dogrular: secilen kayit bulunamazsa secim gecerli degildir
   * (CLAUDE.md §7 Guard Clause — erken cikis).
   */
  async getTemplate(templateId: string): Promise<TemplateDto> {
    const template = await this.templatesRepository.findById(templateId);
    if (template === null) {
      throw new NotFoundError('TEMPLATE_NOT_FOUND', 'Seçilen şablon bulunamadı.');
    }
    return toTemplateDto(template);
  }
}
