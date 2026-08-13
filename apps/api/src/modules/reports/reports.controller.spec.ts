import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { CreateReportDto } from './dto/create-report.dto';
import { ReportsController } from './reports.controller';
import type { ReportsService } from './reports.service';

const CURRENT_USER: AuthenticatedUser = {
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'kaan@ornek.test',
};
const REPORT_ID = '22222222-2222-4222-8222-222222222222';

function controllerWith(service: Partial<ReportsService>): ReportsController {
  return new ReportsController(service as ReportsService);
}

describe('ReportsController.create', () => {
  it('sahiplik icin govdeyi degil oturumdaki kullanici kimligini servise gecirir', async () => {
    const createDraft = jest.fn().mockResolvedValue({ id: REPORT_ID });
    const dto: CreateReportDto = {
      templateId: '11111111-1111-4111-8111-111111111111',
      title: 'Bahcelievler 3+1 cikis teslimi',
      note: 'Salon duvarinda cizik var.',
    };

    const result = await controllerWith({ createDraft }).create(CURRENT_USER, dto);

    expect(createDraft).toHaveBeenCalledWith(CURRENT_USER.userId, dto);
    expect(result).toEqual({ id: REPORT_ID });
  });
});

describe('ReportsController.getById', () => {
  it('yol parametresini ve oturum sahibinin kimligini servise gecirir', async () => {
    const getReport = jest.fn().mockResolvedValue({ id: REPORT_ID, photos: [] });

    const result = await controllerWith({ getReport }).getById(CURRENT_USER, REPORT_ID);

    expect(getReport).toHaveBeenCalledWith(REPORT_ID, CURRENT_USER.userId);
    expect(result).toEqual({ id: REPORT_ID, photos: [] });
  });
});
