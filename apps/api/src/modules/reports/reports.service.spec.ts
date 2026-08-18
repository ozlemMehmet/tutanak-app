import { ForbiddenError, NotFoundError, UnprocessableError } from '../../common/errors/app-error';
import type { ReportPdfService } from '../pdf/report-pdf.service';
import type { PhotosService } from '../photos/photos.service';
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
  approval: null,
};

/** T-010: karsi taraf onayladiktan sonraki tutanak kaydi. */
const APPROVAL = {
  id: '66666666-6666-4666-8666-666666666666',
  approverEmail: 'kiraci@ornek.test',
  approvedAt: new Date('2026-08-15T09:30:00.000Z'),
};

const APPROVED_REPORT: ReportRecord = { ...STORED_REPORT, status: 'approved', approval: APPROVAL };

const PDF_BYTES = Buffer.from('%PDF-1.3 sahte');

function serviceWith(
  repository: Partial<ReportsRepository>,
  photosService: Partial<PhotosService> = { listOwnedPhotos: jest.fn().mockResolvedValue([]) },
  reportPdfService: Partial<ReportPdfService> = {
    renderReport: jest.fn().mockResolvedValue(PDF_BYTES),
  },
): ReportsService {
  return new ReportsService(
    repository as ReportsRepository,
    photosService as PhotosService,
    reportPdfService as ReportPdfService,
  );
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

  it('onaylanmis tutanakta durumu ve onay bilgisini sahibine doner (T-010 kriter 6)', async () => {
    const findById = jest.fn().mockResolvedValue(APPROVED_REPORT);

    const result = await serviceWith({ findById }).getReport(REPORT_ID, OWNER_ID);

    expect(result.status).toBe('approved');
    expect(result.approval).toEqual({
      id: APPROVAL.id,
      approverEmail: APPROVAL.approverEmail,
      approvedAt: APPROVAL.approvedAt.toISOString(),
    });
  });

  it('detay yanitinin fotograf listesini fotograf servisinden doldurur (T-006)', async () => {
    const findById = jest.fn().mockResolvedValue(STORED_REPORT);
    const photo = { id: '55555555-5555-4555-8555-555555555555' };
    const listOwnedPhotos = jest.fn().mockResolvedValue([photo]);

    const result = await serviceWith({ findById }, { listOwnedPhotos }).getReport(
      REPORT_ID,
      OWNER_ID,
    );

    expect(listOwnedPhotos).toHaveBeenCalledWith(REPORT_ID);
    expect(result.photos).toEqual([photo]);
  });

  it('sahiplik dogrulanmadan fotograflari OKUMAZ', async () => {
    const findById = jest.fn().mockResolvedValue(STORED_REPORT);
    const listOwnedPhotos = jest.fn();

    await serviceWith({ findById }, { listOwnedPhotos })
      .getReport(REPORT_ID, OTHER_USER_ID)
      .catch(() => undefined);

    expect(listOwnedPhotos).not.toHaveBeenCalled();
  });

  it('tutanak yoksa NOT_FOUND ile NotFoundError firlatir', async () => {
    const findById = jest.fn().mockResolvedValue(null);

    const promise = serviceWith({ findById }).getReport(REPORT_ID, OWNER_ID);

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('tutanak yoksa donen mesaj duzgun Turkce yazilir (H-002)', async () => {
    const findById = jest.fn().mockResolvedValue(null);

    const promise = serviceWith({ findById }).getReport(REPORT_ID, OWNER_ID);

    await expect(promise).rejects.toMatchObject({ message: 'Tutanak bulunamadı.' });
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

describe('ReportsService.generatePdf', () => {
  const PHOTO_SOURCE = {
    storageKey: `reports/${REPORT_ID}/abc.jpg`,
    capturedAt: new Date('2026-08-14T10:45:12.000Z'),
  };

  function photosServiceWith(sources: unknown[]): Partial<PhotosService> {
    return { listOwnedPhotoSources: jest.fn().mockResolvedValue(sources) };
  }

  it('en az bir fotografi olan tutanak icin PDF baytlarini doner', async () => {
    const findById = jest.fn().mockResolvedValue(STORED_REPORT);
    const renderReport = jest.fn().mockResolvedValue(PDF_BYTES);

    const result = await serviceWith({ findById }, photosServiceWith([PHOTO_SOURCE]), {
      renderReport,
    }).generatePdf(REPORT_ID, OWNER_ID);

    expect(result).toBe(PDF_BYTES);
    expect(renderReport).toHaveBeenCalledWith({
      title: STORED_REPORT.title,
      templateName: STORED_REPORT.templateName,
      note: STORED_REPORT.note,
      photos: [PHOTO_SOURCE],
    });
  });

  it('onaylanmis tutanakta onay bilgisini PDF uretimine gecirir (T-010 kriter 5)', async () => {
    const findById = jest.fn().mockResolvedValue(APPROVED_REPORT);
    const renderReport = jest.fn().mockResolvedValue(PDF_BYTES);

    await serviceWith({ findById }, photosServiceWith([PHOTO_SOURCE]), {
      renderReport,
    }).generatePdf(REPORT_ID, OWNER_ID);

    expect(renderReport).toHaveBeenCalledWith({
      title: APPROVED_REPORT.title,
      templateName: APPROVED_REPORT.templateName,
      note: APPROVED_REPORT.note,
      photos: [PHOTO_SOURCE],
      approval: { approverEmail: APPROVAL.approverEmail, approvedAt: APPROVAL.approvedAt },
    });
  });

  it('hic fotografi olmayan tutanakta REPORT_HAS_NO_PHOTOS ile 400 firlatir', async () => {
    const findById = jest.fn().mockResolvedValue(STORED_REPORT);
    const renderReport = jest.fn();

    const promise = serviceWith({ findById }, photosServiceWith([]), {
      renderReport,
    }).generatePdf(REPORT_ID, OWNER_ID);

    await expect(promise).rejects.toBeInstanceOf(UnprocessableError);
    await expect(promise).rejects.toMatchObject({
      code: 'REPORT_HAS_NO_PHOTOS',
      httpStatus: 400,
    });
    expect(renderReport).not.toHaveBeenCalled();
  });

  it('baska kullaniciya ait tutanakta ForbiddenError firlatir ve PDF URETMEZ', async () => {
    const findById = jest.fn().mockResolvedValue(STORED_REPORT);
    const renderReport = jest.fn();
    const listOwnedPhotoSources = jest.fn();

    const promise = serviceWith(
      { findById },
      { listOwnedPhotoSources },
      {
        renderReport,
      },
    ).generatePdf(REPORT_ID, OTHER_USER_ID);

    await expect(promise).rejects.toBeInstanceOf(ForbiddenError);
    // Sahiplik dogrulanmadan fotograf da PDF de okunmaz (CLAUDE.md §3.8).
    expect(listOwnedPhotoSources).not.toHaveBeenCalled();
    expect(renderReport).not.toHaveBeenCalled();
  });

  it('var olmayan tutanakta NotFoundError firlatir', async () => {
    const findById = jest.fn().mockResolvedValue(null);

    const promise = serviceWith({ findById }, photosServiceWith([])).generatePdf(
      REPORT_ID,
      OWNER_ID,
    );

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
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
