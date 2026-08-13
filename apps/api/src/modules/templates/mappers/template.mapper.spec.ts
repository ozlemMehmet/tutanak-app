import type { TemplateRecord } from '../templates.repository';
import { toTemplateDto } from './template.mapper';

const RECORD: TemplateRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'periodic_check',
  name: 'Periyodik Durum Kontrolu',
  description: 'Kira donemi icinde yapilan periyodik mulk durum kontrolu.',
};

describe('toTemplateDto', () => {
  it('sozlesmedeki Template alanlarini birebir kurar', () => {
    expect(toTemplateDto(RECORD)).toEqual({
      id: RECORD.id,
      code: 'periodic_check',
      name: 'Periyodik Durum Kontrolu',
      description: RECORD.description,
    });
  });

  it('yanit govdesine yalnizca sozlesmedeki dort alani koyar', () => {
    expect(Object.keys(toTemplateDto(RECORD)).sort()).toEqual([
      'code',
      'description',
      'id',
      'name',
    ]);
  });
});
