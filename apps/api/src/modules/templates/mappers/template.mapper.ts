// Entity -> DTO donusumu (CLAUDE.md §3.5): yanit govdesi YALNIZCA burada kurulur,
// boylece sort_order/created_at gibi ic alanlarin sizmasi yapisal olarak engellenir.

import type { TemplateDto } from '../dto/template.dto';
import type { TemplateRecord } from '../templates.repository';

export function toTemplateDto(template: TemplateRecord): TemplateDto {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    description: template.description,
  };
}
