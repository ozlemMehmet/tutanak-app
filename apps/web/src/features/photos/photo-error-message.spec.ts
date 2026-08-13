import { ApiError } from '../../api/client';
import { isPhotoLimitReached, photoUploadErrorMessage } from './photo-error-message';

describe('photoUploadErrorMessage', () => {
  const apiError = (code: string, status = 400): ApiError =>
    new ApiError(code, 'sunucu metni', status);

  it('desteklenmeyen format hatasinda tasarim sartnamesindeki mesaji doner', () => {
    expect(photoUploadErrorMessage(apiError('UNSUPPORTED_MEDIA_FORMAT'))).toBe(
      'Desteklenmeyen dosya turu',
    );
  });

  it('boyut asiminda tasarim sartnamesindeki mesaji doner', () => {
    expect(photoUploadErrorMessage(apiError('FILE_TOO_LARGE'))).toBe(
      'Dosya cok buyuk, en fazla 10 MB',
    );
  });

  it('depolama arizasinda tekrar denemeye yonlendirir', () => {
    expect(photoUploadErrorMessage(apiError('STORAGE_UNAVAILABLE', 502))).toBe(
      'Yukleme basarisiz, tekrar deneyin',
    );
  });

  it('fotograf ust siniri asildiginda sunucunun mesajini gosterir', () => {
    expect(photoUploadErrorMessage(apiError('PHOTO_LIMIT_REACHED', 409))).toBe('sunucu metni');
  });

  it('taninmayan hatada genel bir mesaj doner', () => {
    expect(photoUploadErrorMessage(new Error('ag koptu'))).toBe(
      'Yukleme basarisiz, tekrar deneyin',
    );
  });
});

describe('isPhotoLimitReached', () => {
  it('PHOTO_LIMIT_REACHED kodunda true doner', () => {
    expect(isPhotoLimitReached(new ApiError('PHOTO_LIMIT_REACHED', 'dolu', 409))).toBe(true);
  });

  it('diger hatalarda false doner', () => {
    expect(isPhotoLimitReached(new ApiError('FILE_TOO_LARGE', 'buyuk', 400))).toBe(false);
    expect(isPhotoLimitReached(new Error('ag koptu'))).toBe(false);
  });
});
