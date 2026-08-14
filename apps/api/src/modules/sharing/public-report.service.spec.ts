// Oturumsuz goruntuleme is kurallari (CLAUDE.md §8.1): token gecerli degilse kayit
// "yok" sayilir (404) ve gecerli token TEK yetkilendirme anahtaridir — kimlik/sahiplik
// sorgusu YAPILMAZ (T-009 kriter 1, 2, 4).
import { NotFoundError } from '../../common/errors/app-error';
import type { PhotoDto } from '../photos/dto/photo.dto';
import type { PhotosService } from '../photos/photos.service';
import { PublicReportService } from './public-report.service';
import type { PublicReportRecord, SharingRepository } from './sharing.repository';

const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'gecerli-token_gecerli-token_gecerli-token_g';

const RECORD: PublicReportRecord = {
  reportId: REPORT_ID,
  title: 'Kadikoy 3+1 teslim tutanagi',
  templateName: 'Kiraci Cikis Teslimi',
  note: 'Salon duvarinda cizik var.',
  status: 'shared',
  createdAt: new Date('2026-08-14T09:00:00.000Z'),
  approval: null,
};

const PHOTO: PhotoDto = {
  id: '55555555-5555-4555-8555-555555555555',
  reportId: REPORT_ID,
  capturedAt: '2026-08-14T09:05:00.000Z',
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  widthPx: 800,
  heightPx: 600,
  url: 'https://depolama.test/reports/abc.jpg?imza=sahte',
};

function serviceWith(
  repository: Partial<SharingRepository>,
  photos: Partial<PhotosService> = { listOwnedPhotos: jest.fn().mockResolvedValue([PHOTO]) },
): PublicReportService {
  return new PublicReportService(repository as SharingRepository, photos as PhotosService);
}

describe('PublicReportService.viewByShareToken', () => {
  it('gecerli token ile tutanak icerigini (baslik, sablon adi, not, fotograflar) doner (kriter 1)', async () => {
    const findReportViewByToken = jest.fn().mockResolvedValue(RECORD);

    const dto = await serviceWith({ findReportViewByToken }).viewByShareToken(TOKEN);

    expect(findReportViewByToken).toHaveBeenCalledWith(TOKEN);
    expect(dto.title).toBe(RECORD.title);
    expect(dto.templateName).toBe(RECORD.templateName);
    expect(dto.note).toBe(RECORD.note);
    expect(dto.createdAt).toBe('2026-08-14T09:00:00.000Z');
    expect(dto.photos).toEqual([{ id: PHOTO.id, capturedAt: PHOTO.capturedAt, url: PHOTO.url }]);
  });

  it('fotograflari yalnizca token cozuldukten sonra, tutanagin kimligiyle okur', async () => {
    const listOwnedPhotos = jest.fn().mockResolvedValue([]);
    const findReportViewByToken = jest.fn().mockResolvedValue(RECORD);

    await serviceWith({ findReportViewByToken }, { listOwnedPhotos }).viewByShareToken(TOKEN);

    expect(listOwnedPhotos).toHaveBeenCalledWith(REPORT_ID);
  });

  it('token bulunamazsa NotFoundError(SHARE_LINK_NOT_FOUND) firlatir (kriter 2)', async () => {
    const findReportViewByToken = jest.fn().mockResolvedValue(null);
    const listOwnedPhotos = jest.fn();

    const promise = serviceWith({ findReportViewByToken }, { listOwnedPhotos }).viewByShareToken(
      'bilinmeyen-token',
    );

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({ code: 'SHARE_LINK_NOT_FOUND', httpStatus: 404 });
    // Kayit yoksa fotograf/depolama yoluna hic girilmez (gereksiz on-imzali URL uretilmez).
    expect(listOwnedPhotos).not.toHaveBeenCalled();
  });

  it('hata mesaji paylasim token degerini SIZDIRMAZ (CLAUDE.md §4.3)', async () => {
    const findReportViewByToken = jest.fn().mockResolvedValue(null);

    const error: unknown = await serviceWith({ findReportViewByToken })
      .viewByShareToken(TOKEN)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).message).not.toContain(TOKEN);
  });

  it('onaylanmis tutanakta isApproved true doner', async () => {
    const findReportViewByToken = jest.fn().mockResolvedValue({
      ...RECORD,
      status: 'approved',
      approval: {
        id: '66666666-6666-4666-8666-666666666666',
        approverEmail: 'kiraci@ornek.test',
        approvedAt: new Date('2026-08-14T10:00:00.000Z'),
      },
    });

    const dto = await serviceWith({ findReportViewByToken }).viewByShareToken(TOKEN);

    expect(dto.isApproved).toBe(true);
    expect(dto.status).toBe('approved');
  });
});
