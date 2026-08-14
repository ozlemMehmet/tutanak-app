// Depo katmani (CLAUDE.md §3.4): get-or-create idempotansi "unique kisit + 23505 yakalama"
// desenidir (§7) — SELECT-sonra-INSERT yarisi YAPILMAZ. Gercek DB davranisi e2e'de dogrulanir;
// burada P2002 dali ve transaction butunlugu dogrulanir.
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { SharingRepository } from './sharing.repository';

const CLIENT_VERSION = '6.19.3';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'yeni-aday-token_yeni-aday-token_yeni-aday-t';

const STORED_LINK = {
  id: '11111111-1111-4111-8111-111111111111',
  reportId: REPORT_ID,
  token: 'mevcut-token_mevcut-token_mevcut-token_mevc',
  createdAt: new Date('2026-08-14T09:00:00.000Z'),
  updatedAt: new Date('2026-08-14T09:00:00.000Z'),
};

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: CLIENT_VERSION,
    meta: { target: 'share_links_report_id_key' },
  });
}

interface PrismaStub {
  shareLink?: { create?: jest.Mock; findUnique?: jest.Mock };
  shareDelivery?: { create?: jest.Mock };
  report?: { findUnique?: jest.Mock; updateMany?: jest.Mock };
  $transaction?: jest.Mock;
}

function repositoryWith(stub: PrismaStub): SharingRepository {
  const prisma = {
    ...stub,
    // Interaktif transaction geri cagrisi ayni stub delegate'leriyle calisir: link INSERT'i
    // ve draft->shared gecisinin AYNI transaction icinde oldugu boyle dogrulanir (§3.10).
    $transaction:
      stub.$transaction ??
      jest.fn((callback: (tx: unknown) => unknown) => Promise.resolve(callback(prisma))),
  } as unknown as PrismaService;
  return new SharingRepository(prisma);
}

describe('SharingRepository.getOrCreateShareLink', () => {
  it('linki yazar ve AYNI transaction icinde draft -> shared gecisini yapar (§3.10)', async () => {
    const create = jest.fn().mockResolvedValue({ ...STORED_LINK, token: TOKEN });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });

    const record = await repositoryWith({
      shareLink: { create },
      report: { updateMany },
    }).getOrCreateShareLink(REPORT_ID, TOKEN);

    expect(record.token).toBe(TOKEN);
    expect(create).toHaveBeenCalledWith({ data: { reportId: REPORT_ID, token: TOKEN } });
    // Gecis KOSULLUDUR: yalnizca draft satiri shared olur; shared/approved korunur.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: REPORT_ID, status: 'draft' },
      data: { status: 'shared' },
    });
  });

  it('unique kisit ihlalinde (P2002) mevcut linki okuyup doner — yeni token URETILMEZ (kriter 3)', async () => {
    const create = jest.fn().mockRejectedValue(uniqueViolation());
    const updateMany = jest.fn();
    const findUnique = jest.fn().mockResolvedValue(STORED_LINK);

    const record = await repositoryWith({
      shareLink: { create, findUnique },
      report: { updateMany },
    }).getOrCreateShareLink(REPORT_ID, TOKEN);

    expect(record.token).toBe(STORED_LINK.token);
    expect(findUnique).toHaveBeenCalledWith({ where: { reportId: REPORT_ID } });
    // Link zaten vardi: durum gecisi calismamis olmalidir (link INSERT'i ile ayni tx kurali).
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('P2002 disindaki hatalari aynen yukari tasir', async () => {
    const create = jest.fn().mockRejectedValue(new Error('baglanti koptu'));

    await expect(
      repositoryWith({ shareLink: { create } }).getOrCreateShareLink(REPORT_ID, TOKEN),
    ).rejects.toThrow('baglanti koptu');
  });
});

describe('SharingRepository.findReportForAccess', () => {
  it('tutanagin sahiplik/durum alanlarini doner', async () => {
    const findUnique = jest.fn().mockResolvedValue({ ownerId: OWNER_ID, status: 'draft' });

    const record = await repositoryWith({ report: { findUnique } }).findReportForAccess(REPORT_ID);

    expect(record).toEqual({ ownerId: OWNER_ID, status: 'draft' });
  });

  it('uuid bicimine uymayan kimlikte (P2023) null doner — kayit yok ile ayni anlam (T-005 karari)', async () => {
    const findUnique = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Inconsistent column data', {
        code: 'P2023',
        clientVersion: CLIENT_VERSION,
      }),
    );

    await expect(
      repositoryWith({ report: { findUnique } }).findReportForAccess('tutanak-42'),
    ).resolves.toBeNull();
  });
});

describe('SharingRepository.createDelivery', () => {
  it('teslim kaydini durum + hata nedeni + saglayici kimligi ile yazar', async () => {
    const create = jest.fn().mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      shareLinkId: STORED_LINK.id,
      channel: 'email',
      recipientEmail: 'kiraci@ornek.test',
      status: 'failed',
      providerMessageId: null,
      errorMessage: 'E-posta saglayicisina ulasilamadi.',
      createdAt: new Date('2026-08-14T09:05:00.000Z'),
    });

    const record = await repositoryWith({ shareDelivery: { create } }).createDelivery({
      shareLinkId: STORED_LINK.id,
      recipientEmail: 'kiraci@ornek.test',
      status: 'failed',
      providerMessageId: null,
      errorMessage: 'E-posta saglayicisina ulasilamadi.',
    });

    expect(record.status).toBe('failed');
    expect(record.errorMessage).toBe('E-posta saglayicisina ulasilamadi.');
    expect(create).toHaveBeenCalledWith({
      data: {
        shareLinkId: STORED_LINK.id,
        recipientEmail: 'kiraci@ornek.test',
        status: 'failed',
        providerMessageId: null,
        errorMessage: 'E-posta saglayicisina ulasilamadi.',
      },
    });
  });
});
