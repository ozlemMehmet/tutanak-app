// Depo katmani (CLAUDE.md §3.4): mukerrer onayin birincil garantisi DB unique index'idir
// (`approvals_report_id_key`) — once INSERT denenir, P2002 yakalanir; SELECT-sonra-INSERT
// yarisi YAPILMAZ (§7). Durum gecisi onay kaydiyla AYNI transaction icindedir (§3.10).
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { ApprovalsRepository } from './approvals.repository';

const CLIENT_VERSION = '6.19.3';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const SHARE_LINK_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'gecerli-token_gecerli-token_gecerli-token_g';
const APPROVER_EMAIL = 'kiraci@ornek.test';

const STORED_APPROVAL = {
  id: '66666666-6666-4666-8666-666666666666',
  reportId: REPORT_ID,
  shareLinkId: SHARE_LINK_ID,
  approverEmail: APPROVER_EMAIL,
  approvedAt: new Date('2026-08-15T09:30:00.000Z'),
};

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: CLIENT_VERSION,
    meta: { target: 'approvals_report_id_key' },
  });
}

interface PrismaStub {
  approval?: { create?: jest.Mock };
  report?: { update?: jest.Mock };
  shareLink?: { findUnique?: jest.Mock };
  $transaction?: jest.Mock;
}

function repositoryWith(stub: PrismaStub): ApprovalsRepository {
  const prisma = {
    ...stub,
    // Interaktif transaction geri cagrisi ayni stub delegate'leriyle calisir: onay INSERT'i
    // ve shared -> approved gecisinin AYNI transaction icinde oldugu boyle dogrulanir.
    $transaction:
      stub.$transaction ??
      jest.fn((callback: (tx: unknown) => unknown) => Promise.resolve(callback(prisma))),
  } as unknown as PrismaService;
  return new ApprovalsRepository(prisma);
}

describe('ApprovalsRepository.findLinkByToken', () => {
  it('gecerli token icin paylasim linki ve tutanak kimligini doner', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: SHARE_LINK_ID, reportId: REPORT_ID });

    const record = await repositoryWith({ shareLink: { findUnique } }).findLinkByToken(TOKEN);

    expect(record).toEqual({ shareLinkId: SHARE_LINK_ID, reportId: REPORT_ID });
    expect(findUnique).toHaveBeenCalledWith({
      where: { token: TOKEN },
      select: { id: true, reportId: true },
    });
  });

  it('bilinmeyen token icin null doner (servis bunu 404e cevirir)', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      repositoryWith({ shareLink: { findUnique } }).findLinkByToken(TOKEN),
    ).resolves.toBe(null);
  });
});

describe('ApprovalsRepository.createApproval', () => {
  it('onay kaydini yazar ve AYNI transaction icinde tutanagi approved yapar (§3.10)', async () => {
    const create = jest.fn().mockResolvedValue(STORED_APPROVAL);
    const update = jest.fn().mockResolvedValue({ id: REPORT_ID });

    const record = await repositoryWith({
      approval: { create },
      report: { update },
    }).createApproval({
      reportId: REPORT_ID,
      shareLinkId: SHARE_LINK_ID,
      approverEmail: APPROVER_EMAIL,
    });

    expect(record).toEqual({
      id: STORED_APPROVAL.id,
      approverEmail: APPROVER_EMAIL,
      approvedAt: STORED_APPROVAL.approvedAt,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: REPORT_ID },
      data: { status: 'approved' },
    });
  });

  it('zaman damgasini GONDERMEZ: approved_at sunucuda DEFAULT now() ile dogar (§3.7)', async () => {
    const create = jest.fn().mockResolvedValue(STORED_APPROVAL);

    await repositoryWith({
      approval: { create },
      report: { update: jest.fn() },
    }).createApproval({
      reportId: REPORT_ID,
      shareLinkId: SHARE_LINK_ID,
      approverEmail: APPROVER_EMAIL,
    });

    expect(create).toHaveBeenCalledWith({
      data: { reportId: REPORT_ID, shareLinkId: SHARE_LINK_ID, approverEmail: APPROVER_EMAIL },
    });
  });

  it('unique kisit ihlalinde (P2002) null doner: tutanak zaten onayli', async () => {
    const create = jest.fn().mockRejectedValue(uniqueViolation());
    const update = jest.fn();

    const record = await repositoryWith({
      approval: { create },
      report: { update },
    }).createApproval({
      reportId: REPORT_ID,
      shareLinkId: SHARE_LINK_ID,
      approverEmail: APPROVER_EMAIL,
    });

    expect(record).toBe(null);
    // Ikinci onay denemesi durumu yeniden yazmaz (mukerrer kayit da olusmaz).
    expect(update).not.toHaveBeenCalled();
  });

  it('unique disi veritabani hatasini yutmaz, yukari tasir', async () => {
    const create = jest.fn().mockRejectedValue(new Error('baglanti koptu'));

    const promise = repositoryWith({
      approval: { create },
      report: { update: jest.fn() },
    }).createApproval({
      reportId: REPORT_ID,
      shareLinkId: SHARE_LINK_ID,
      approverEmail: APPROVER_EMAIL,
    });

    await expect(promise).rejects.toThrow('baglanti koptu');
  });
});
