import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import type { ReportRecord, ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';
const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';

const STORED_REPORT: ReportRecord = {
  id: REPORT_ID,
  ownerId: OWNER_ID,
  templateId: TEMPLATE_ID,
  templateName: 'Giris/Cikis Teslim Tutanagi',
  title: 'Bahcelievler 3+1 cikis teslimi',
  note: 'Salon duvarinda cizik var.',
  status: 'draft',
  photoCount: 0,
  createdAt: new Date('2026-08-13T10:00:00.000Z'),
  updatedAt: new Date('2026-08-13T10:00:00.000Z'),
};

function serviceWith(repository: Partial<ReportsRepository>): ReportsService {
  return new ReportsService(repository as ReportsRepository);
}

describe('ReportsService.createDraft', () => {
  it('taslagi token sahibinin kimligiyle olusturur ve sozlesmedeki Report yanitini doner', async () => {
    const createDraft = jest.fn().mockResolvedValue(STORED_REPORT);

    const result = await serviceWith({ createDraft }).createDraft(OWNER_ID, {
      templateId: TEMPLATE_ID,
      title: 'Bahcelievler 3+1 cikis teslimi',
      note: 'Salon duvarinda cizik var.',
    });

    expect(createDraft).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      templateId: TEMPLATE_ID,
      title: 'Bahcelievler 3+1 cikis teslimi',
      note: 'Salon duvarinda cizik var.',
    });
    expect(result.id).toBe(REPORT_ID);
    expect(result.status).toBe('draft');
  });

  it('not gonderilmediginde bos metin ile kaydeder (sozlesme varsayilani)', async () => {
    const createDraft = jest.fn().mockResolvedValue({ ...STORED_REPORT, note: '' });

    await serviceWith({ createDraft }).createDraft(OWNER_ID, {
      templateId: TEMPLATE_ID,
      title: 'Notsuz tutanak',
    });

    expect(createDraft).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      templateId: TEMPLATE_ID,
      title: 'Notsuz tutanak',
      note: '',
    });
  });

  it('sablon bulunamazsa TEMPLATE_NOT_FOUND ile NotFoundError firlatir', async () => {
    const createDraft = jest.fn().mockResolvedValue(null);

    const promise = serviceWith({ createDraft }).createDraft(OWNER_ID, {
      templateId: TEMPLATE_ID,
      title: 'Sablonsuz tutanak',
    });

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND', httpStatus: 404 });
  });
});

describe('ReportsService.getReport', () => {
  it('kendi tutanaginda 200 icin detay yanitini doner', async () => {
    const findById = jest.fn().mockResolvedValue(STORED_REPORT);

    const result = await serviceWith({ findById }).getReport(REPORT_ID, OWNER_ID);

    expect(findById).toHaveBeenCalledWith(REPORT_ID);
    expect(result.id).toBe(REPORT_ID);
    expect(result.photos).toEqual([]);
  });

  it('tutanak yoksa NOT_FOUND ile NotFoundError firlatir', async () => {
    const findById = jest.fn().mockResolvedValue(null);

    const promise = serviceWith({ findById }).getReport(REPORT_ID, OWNER_ID);

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('tutanak baska kullaniciya aitse ForbiddenError firlatir (icerik sizdirmadan)', async () => {
    const findById = jest.fn().mockResolvedValue(STORED_REPORT);

    const caught: unknown = await serviceWith({ findById })
      .getReport(REPORT_ID, OTHER_USER_ID)
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ForbiddenError);
    expect(caught).toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
    // Yetkisiz istege baskasinin tutanak icerigi sizmaz (CLAUDE.md §4.3).
    expect((caught as Error).message).not.toContain(STORED_REPORT.title);
  });

  it('sahiplik kontrolu icin kaydi tek kez sorgular (ikinci gidis-donus yapmaz)', async () => {
    const findById = jest.fn().mockResolvedValue(STORED_REPORT);

    await serviceWith({ findById }).getReport(REPORT_ID, OWNER_ID);

    expect(findById).toHaveBeenCalledTimes(1);
  });
});

describe('ReportsService.listReports', () => {
  const OTHER_REPORT: ReportRecord = {
    ...STORED_REPORT,
    id: '55555555-5555-4555-8555-555555555555',
  };

  it('sayfa verilmediginde ilk sayfayi varsayilan sayfa boyutuyla ister', async () => {
    const findManyByOwner = jest.fn().mockResolvedValue({ records: [STORED_REPORT], total: 1 });

    const result = await serviceWith({ findManyByOwner }).listReports(OWNER_ID, {});

    expect(findManyByOwner).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      searchTerm: undefined,
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({
      items: [expect.objectContaining({ id: STORED_REPORT.id })],
      page: 1,
      pageSize: 20,
      total: 1,
    });
  });

  it('listeyi yalnizca oturum sahibinin kimligiyle sorgular (istemci sahiplik secemez)', async () => {
    const findManyByOwner = jest.fn().mockResolvedValue({ records: [], total: 0 });

    await serviceWith({ findManyByOwner }).listReports(OTHER_USER_ID, {});

    expect(findManyByOwner).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: OTHER_USER_ID }),
    );
  });

  it('sayfa numarasini ve sayfa boyutunu atlama degerine cevirir', async () => {
    const findManyByOwner = jest.fn().mockResolvedValue({ records: [], total: 45 });

    const result = await serviceWith({ findManyByOwner }).listReports(OWNER_ID, {
      page: 3,
      pageSize: 5,
    });

    expect(findManyByOwner).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(5);
    expect(result.total).toBe(45);
  });

  it('arama terimini depoya oldugu gibi gecirir', async () => {
    const findManyByOwner = jest.fn().mockResolvedValue({ records: [OTHER_REPORT], total: 1 });

    await serviceWith({ findManyByOwner }).listReports(OWNER_ID, { q: 'kiraci' });

    expect(findManyByOwner).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: 'kiraci' }));
  });

  it('eslesen kayit yoksa hata firlatmadan bos liste doner', async () => {
    const findManyByOwner = jest.fn().mockResolvedValue({ records: [], total: 0 });

    const result = await serviceWith({ findManyByOwner }).listReports(OWNER_ID, { q: 'yok' });

    expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });
});
