import type { TemplateDto } from './dto/template.dto';
import { TemplatesController } from './templates.controller';
import type { TemplatesService } from './templates.service';

const TEMPLATE: TemplateDto = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'move_in_out',
  name: 'Giris/Cikis Teslim Tutanagi',
  description: 'Kiraci giris veya cikis teslimi sirasinda mulkun genel durumu.',
};

describe('TemplatesController.list', () => {
  it('sablon listesini servise devreder', async () => {
    const listTemplates = jest.fn().mockResolvedValue([TEMPLATE]);
    const controller = new TemplatesController({ listTemplates } as unknown as TemplatesService);

    const result = await controller.list();

    expect(listTemplates).toHaveBeenCalledTimes(1);
    expect(result).toEqual([TEMPLATE]);
  });
});

describe('TemplatesController.getById', () => {
  it('yol parametresindeki sablon kimligini servise iletir', async () => {
    const getTemplate = jest.fn().mockResolvedValue(TEMPLATE);
    const controller = new TemplatesController({ getTemplate } as unknown as TemplatesService);

    const result = await controller.getById(TEMPLATE.id);

    expect(getTemplate).toHaveBeenCalledWith(TEMPLATE.id);
    expect(result).toEqual(TEMPLATE);
  });
});
