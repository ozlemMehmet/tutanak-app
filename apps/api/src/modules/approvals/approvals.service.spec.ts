// ApprovalsService is kurallari (CLAUDE.md §8.1): gecersiz token guard clause'u, onay
// kaydinin olusumu ve mukerrer onay reddi. Servis HTTP'yi bilmez; durum kodlari AppError
// alt siniflarindan gelir (§4.2).
import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import { ApprovalsService } from './approvals.service';
import type { ApprovalsRepository } from './approvals.repository';

const TOKEN = 'gecerli-token_gecerli-token_gecerli-token_g';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const SHARE_LINK_ID = '11111111-1111-4111-8111-111111111111';
const APPROVER_EMAIL = 'kiraci@ornek.test';

const LINK = { shareLinkId: SHARE_LINK_ID, reportId: REPORT_ID };
const APPROVAL = {
  id: '66666666-6666-4666-8666-666666666666',
  approverEmail: APPROVER_EMAIL,
  approvedAt: new Date('2026-08-15T09:30:00.000Z'),
};

function serviceWith(repository: Partial<ApprovalsRepository>): ApprovalsService {
  return new ApprovalsService(repository as ApprovalsRepository);
}

describe('ApprovalsService.approveByShareToken', () => {
  it('gecerli link icin onay kaydini olusturur ve sozlesmedeki Approval yanitini doner', async () => {
    const createApproval = jest.fn().mockResolvedValue(APPROVAL);

    const dto = await serviceWith({
      findLinkByToken: jest.fn().mockResolvedValue(LINK),
      createApproval,
    }).approveByShareToken(TOKEN, APPROVER_EMAIL);

    expect(dto).toEqual({
      id: APPROVAL.id,
      approverEmail: APPROVER_EMAIL,
      approvedAt: APPROVAL.approvedAt.toISOString(),
    });
    // Depoya YALNIZCA bu uc alan gider: istemciden gelen hicbir tarih degeri okunmaz,
    // `approved_at` veritabaninda dogar (CLAUDE.md §3.7).
    expect(createApproval).toHaveBeenCalledWith({
      reportId: REPORT_ID,
      shareLinkId: SHARE_LINK_ID,
      approverEmail: APPROVER_EMAIL,
    });
  });

  it('gecersiz/bilinmeyen token icin SHARE_LINK_NOT_FOUND ile 404 firlatir', async () => {
    const createApproval = jest.fn();

    const promise = serviceWith({
      findLinkByToken: jest.fn().mockResolvedValue(null),
      createApproval,
    }).approveByShareToken(TOKEN, APPROVER_EMAIL);

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({ code: 'SHARE_LINK_NOT_FOUND', httpStatus: 404 });
    // Token cozulemeden hicbir yazma denenmez (guard clause — §7).
    expect(createApproval).not.toHaveBeenCalled();
  });

  it('tutanak zaten onayliysa REPORT_ALREADY_APPROVED ile 409 firlatir (mukerrer onay yok)', async () => {
    const promise = serviceWith({
      findLinkByToken: jest.fn().mockResolvedValue(LINK),
      // Depo, unique kisit ihlalini null ile bildirir (§7 unique kisit).
      createApproval: jest.fn().mockResolvedValue(null),
    }).approveByShareToken(TOKEN, APPROVER_EMAIL);

    await expect(promise).rejects.toBeInstanceOf(ConflictError);
    await expect(promise).rejects.toMatchObject({
      code: 'REPORT_ALREADY_APPROVED',
      httpStatus: 409,
    });
  });

  it('404 mesaji paylasim tokenini sizdirmaz (§4.3)', async () => {
    const caught: unknown = await serviceWith({
      findLinkByToken: jest.fn().mockResolvedValue(null),
    })
      .approveByShareToken(TOKEN, APPROVER_EMAIL)
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as Error).message).not.toContain(TOKEN);
  });
});
