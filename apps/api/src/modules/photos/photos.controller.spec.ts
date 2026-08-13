import { ValidationError } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PhotosController } from './photos.controller';
import type { PhotosService } from './photos.service';

const CURRENT_USER: AuthenticatedUser = {
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'kaan@ornek.test',
};
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const PHOTO_ID = '55555555-5555-4555-8555-555555555555';

function controllerWith(service: Partial<PhotosService>): PhotosController {
  return new PhotosController(service as PhotosService);
}

/** Multer'in urettigi nesnenin testte kullanilan alt kumesi. */
function uploadedFile(buffer: Buffer): Express.Multer.File {
  return { buffer, originalname: 'kamera.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;
}

describe('PhotosController.upload', () => {
  it('yol parametresini, oturum sahibini ve YALNIZCA dosya icerigini servise gecirir', async () => {
    const addPhoto = jest.fn().mockResolvedValue({ id: PHOTO_ID });
    const buffer = Buffer.from('jpeg-baytlari');

    const result = await controllerWith({ addPhoto }).upload(
      CURRENT_USER,
      REPORT_ID,
      uploadedFile(buffer),
    );

    expect(addPhoto).toHaveBeenCalledWith(REPORT_ID, CURRENT_USER.userId, { buffer });
    expect(result).toEqual({ id: PHOTO_ID });
  });

  it('dosya alani hic gonderilmediginde 400 VALIDATION_ERROR uretir', () => {
    const addPhoto = jest.fn();

    expect(() => controllerWith({ addPhoto }).upload(CURRENT_USER, REPORT_ID, undefined)).toThrow(
      ValidationError,
    );
    expect(addPhoto).not.toHaveBeenCalled();
  });
});

describe('PhotosController.list', () => {
  it('yol parametresini ve oturum sahibinin kimligini servise gecirir', async () => {
    const listPhotos = jest.fn().mockResolvedValue([{ id: PHOTO_ID }]);

    const result = await controllerWith({ listPhotos }).list(CURRENT_USER, REPORT_ID);

    expect(listPhotos).toHaveBeenCalledWith(REPORT_ID, CURRENT_USER.userId);
    expect(result).toEqual([{ id: PHOTO_ID }]);
  });
});
