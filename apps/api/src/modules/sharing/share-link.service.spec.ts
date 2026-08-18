// ShareLinkService is kurallari (CLAUDE.md §8.1): sahiplik guard clause'u, paylasim linki
// idempotansi, e-posta on kosulu (link URETMEZ) ve "gonderim hatasi istisna DEGILDIR" kurali.
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { FakeEmailAdapter } from '../../infra/email/fake-email.adapter';
import type { EmailPort } from '../../infra/email/email.port';
import { ShareLinkService } from './share-link.service';
import type {
  ReportAccessRecord,
  ShareDeliveryRecord,
  ShareLinkRecord,
  SharingRepository,
} from './sharing.repository';

const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const PUBLIC_APP_URL = 'https://app.example.com';
const RECIPIENT = 'kiraci@ornek.test';

const DRAFT_REPORT: ReportAccessRecord = { ownerId: OWNER_ID, status: 'draft' };

const STORED_LINK: ShareLinkRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  reportId: REPORT_ID,
  token: 'sabit-test-tokeni_sabit-test-tokeni_sabit-t',
  createdAt: new Date('2026-08-14T09:00:00.000Z'),
};

function deliveryRecord(overrides: Partial<ShareDeliveryRecord> = {}): ShareDeliveryRecord {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    shareLinkId: STORED_LINK.id,
    channel: 'email',
    recipientEmail: RECIPIENT,
    status: 'sent',
    errorMessage: null,
    createdAt: new Date('2026-08-14T09:05:00.000Z'),
    ...overrides,
  };
}

function serviceWith(
  repository: Partial<SharingRepository>,
  email: EmailPort = new FakeEmailAdapter(),
): ShareLinkService {
  return new ShareLinkService(repository as SharingRepository, email, {
    publicAppUrl: PUBLIC_APP_URL,
  });
}

describe('ShareLinkService.issueShareLink', () => {
  it('sahip olunan tutanak icin linki uretir ve sozlesmedeki ShareLink alanlarini doner', async () => {
    const findReportForAccess = jest.fn().mockResolvedValue(DRAFT_REPORT);
    const getOrCreateShareLink = jest.fn().mockResolvedValue(STORED_LINK);

    const dto = await serviceWith({ findReportForAccess, getOrCreateShareLink }).issueShareLink(
      REPORT_ID,
      OWNER_ID,
    );

    expect(dto.token).toBe(STORED_LINK.token);
    expect(dto.url).toBe(`${PUBLIC_APP_URL}/t/${STORED_LINK.token}`);
    expect(new URL(dto.whatsAppUrl).origin).toBe('https://wa.me');
  });

  it('depoya her cagrida YENI uretilmis bir aday token verir; kalicilik karari depodadir', async () => {
    const getOrCreateShareLink = jest.fn().mockResolvedValue(STORED_LINK);
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      getOrCreateShareLink,
    });

    await service.issueShareLink(REPORT_ID, OWNER_ID);
    await service.issueShareLink(REPORT_ID, OWNER_ID);

    const calls = getOrCreateShareLink.mock.calls as [string, string][];
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]).toBe(REPORT_ID);
    // Aday tokenlar farklidir; AYNI token'in donmesi DB unique kisitinin isidir (§7).
    expect(calls[0]?.[1]).not.toBe(calls[1]?.[1]);
  });

  it('tutanak yoksa NotFoundError firlatir (kriter 6)', async () => {
    const service = serviceWith({ findReportForAccess: jest.fn().mockResolvedValue(null) });

    await expect(service.issueShareLink(REPORT_ID, OWNER_ID)).rejects.toThrow(NotFoundError);
  });

  it('baska kullaniciya ait tutanakta ForbiddenError firlatir (kriter 6)', async () => {
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
    });

    await expect(service.issueShareLink(REPORT_ID, OTHER_USER_ID)).rejects.toThrow(ForbiddenError);
  });
});

describe('ShareLinkService.getShareLink', () => {
  it('mevcut linki doner', async () => {
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      findByReport: jest.fn().mockResolvedValue(STORED_LINK),
    });

    const dto = await service.getShareLink(REPORT_ID, OWNER_ID);

    expect(dto.token).toBe(STORED_LINK.token);
  });

  it('tutanak yoksa donen mesaj duzgun Turkce yazilir (H-002)', async () => {
    const service = serviceWith({ findReportForAccess: jest.fn().mockResolvedValue(null) });

    await expect(service.issueShareLink(REPORT_ID, OWNER_ID)).rejects.toMatchObject({
      message: 'Tutanak bulunamadı.',
    });
  });

  it('link henuz uretilmemisse SHARE_LINK_NOT_FOUND kodlu NotFoundError firlatir', async () => {
    const service = serviceWith({
      findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
      findByReport: jest.fn().mockResolvedValue(null),
    });

    await expect(service.getShareLink(REPORT_ID, OWNER_ID)).rejects.toMatchObject({
      code: 'SHARE_LINK_NOT_FOUND',
    });
  });
});

describe('ShareLinkService.sendShareEmail', () => {
  it('linki e-posta ile gonderir, sent teslim kaydini yazar ve yanitta doner (kriter 4)', async () => {
    const email = new FakeEmailAdapter();
    const createDelivery = jest.fn().mockResolvedValue(deliveryRecord());
    const service = serviceWith(
      {
        findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
        findByReport: jest.fn().mockResolvedValue(STORED_LINK),
        createDelivery,
      },
      email,
    );

    const dto = await service.sendShareEmail(REPORT_ID, OWNER_ID, RECIPIENT);

    expect(dto.status).toBe('sent');
    expect(dto.recipientEmail).toBe(RECIPIENT);
    expect(email.sentEmails).toHaveLength(1);
    expect(email.sentEmails[0]?.to).toBe(RECIPIENT);
    // Govde paylasim linkini icermelidir; aksi halde alici tutanaga ulasamaz.
    expect(email.sentEmails[0]?.text).toContain(`${PUBLIC_APP_URL}/t/${STORED_LINK.token}`);
    expect(createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ shareLinkId: STORED_LINK.id, status: 'sent' }),
    );
  });

  it('saglayici hatasinda ISTISNA FIRLATMAZ; failed kaydini yazar ve yanitta doner (§4.2.2)', async () => {
    const email = new FakeEmailAdapter();
    email.failNextWith('E-posta sağlayıcısına ulaşılamadı.');
    const createDelivery = jest
      .fn()
      .mockResolvedValue(
        deliveryRecord({ status: 'failed', errorMessage: 'E-posta sağlayıcısına ulaşılamadı.' }),
      );
    const service = serviceWith(
      {
        findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
        findByReport: jest.fn().mockResolvedValue(STORED_LINK),
        createDelivery,
      },
      email,
    );

    const dto = await service.sendShareEmail(REPORT_ID, OWNER_ID, RECIPIENT);

    expect(dto.status).toBe('failed');
    expect(dto.errorMessage).toBe('E-posta sağlayıcısına ulaşılamadı.');
    expect(createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'E-posta sağlayıcısına ulaşılamadı.',
      }),
    );
  });

  it('link yoksa SHARE_LINK_NOT_FOUND firlatir ve e-posta GONDERMEZ (link uretmez, §3.10)', async () => {
    const email = new FakeEmailAdapter();
    const getOrCreateShareLink = jest.fn();
    const service = serviceWith(
      {
        findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT),
        findByReport: jest.fn().mockResolvedValue(null),
        getOrCreateShareLink,
      },
      email,
    );

    await expect(service.sendShareEmail(REPORT_ID, OWNER_ID, RECIPIENT)).rejects.toMatchObject({
      code: 'SHARE_LINK_NOT_FOUND',
    });
    expect(email.sentEmails).toHaveLength(0);
    expect(getOrCreateShareLink).not.toHaveBeenCalled();
  });

  it('baska kullaniciya ait tutanakta ForbiddenError firlatir ve e-posta gondermez', async () => {
    const email = new FakeEmailAdapter();
    const service = serviceWith(
      { findReportForAccess: jest.fn().mockResolvedValue(DRAFT_REPORT) },
      email,
    );

    await expect(service.sendShareEmail(REPORT_ID, OTHER_USER_ID, RECIPIENT)).rejects.toThrow(
      ForbiddenError,
    );
    expect(email.sentEmails).toHaveLength(0);
  });
});
