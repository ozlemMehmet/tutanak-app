import { NotFoundError } from '../../common/errors/app-error';
import type { TemplateRecord } from './templates.repository';
import type { TemplatesRepository } from './templates.repository';
import { TemplatesService } from './templates.service';

const MOVE_IN_OUT: TemplateRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'move_in_out',
  name: 'Giris/Cikis Teslim Tutanagi',
  description: 'Kiraci giris veya cikis teslimi sirasinda mulkun genel durumu.',
};

const METER_FIXTURE: TemplateRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'meter_fixture',
  name: 'Sayac/Demirbas Tespiti',
  description: 'Sayac degerleri ve demirbaslarin tespiti.',
};

function serviceWith(repository: Partial<TemplatesRepository>): TemplatesService {
  return new TemplatesService(repository as TemplatesRepository);
}

describe('TemplatesService.listTemplates', () => {
  it('deponun dondugu sablonlari sozlesmedeki alanlarla listeler', async () => {
    const findAll = jest.fn().mockResolvedValue([MOVE_IN_OUT, METER_FIXTURE]);

    const result = await serviceWith({ findAll }).listTemplates();

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: MOVE_IN_OUT.id,
        code: 'move_in_out',
        name: 'Giris/Cikis Teslim Tutanagi',
        description: MOVE_IN_OUT.description,
      },
      {
        id: METER_FIXTURE.id,
        code: 'meter_fixture',
        name: 'Sayac/Demirbas Tespiti',
        description: METER_FIXTURE.description,
      },
    ]);
  });

  it('deponun verdigi sirayi korur (sablon sirasi sunucuda belirlenir)', async () => {
    const findAll = jest.fn().mockResolvedValue([METER_FIXTURE, MOVE_IN_OUT]);

    const result = await serviceWith({ findAll }).listTemplates();

    expect(result.map((template) => template.id)).toEqual([METER_FIXTURE.id, MOVE_IN_OUT.id]);
  });
});

describe('TemplatesService.getTemplate', () => {
  it('gecerli kimlikle secilen sablonun kimligini ve adini doner', async () => {
    const findById = jest.fn().mockResolvedValue(METER_FIXTURE);

    const result = await serviceWith({ findById }).getTemplate(METER_FIXTURE.id);

    expect(findById).toHaveBeenCalledWith(METER_FIXTURE.id);
    expect(result).toEqual({
      id: METER_FIXTURE.id,
      code: 'meter_fixture',
      name: 'Sayac/Demirbas Tespiti',
      description: METER_FIXTURE.description,
    });
  });

  it('sablon bulunamazsa 404 TEMPLATE_NOT_FOUND firlatir', async () => {
    const findById = jest.fn().mockResolvedValue(null);

    const error: unknown = await serviceWith({ findById })
      .getTemplate('33333333-3333-4333-8333-333333333333')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ code: 'TEMPLATE_NOT_FOUND', httpStatus: 404 });
    // 404 yaniti alan bazli detay tasimaz (CLAUDE.md §4.2.3).
    expect((error as NotFoundError).details).toBeUndefined();
  });
});
