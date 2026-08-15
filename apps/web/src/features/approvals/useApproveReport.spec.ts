// Onay sonrasi gorunum tazeleme karari saf bir fonksiyona ayrildi: 409 (tutanak zaten
// onayli) kullaniciya HATA gibi gosterilmez, sonuc zaten istenen durumdur (design.md).
import { ApiError } from '../../api/client';
import { isAlreadyApprovedError } from './useApproveReport';

describe('isAlreadyApprovedError', () => {
  it('409 REPORT_ALREADY_APPROVED yanitini tanir', () => {
    const error = new ApiError('REPORT_ALREADY_APPROVED', 'Tutanak zaten onayli.', 409);

    expect(isAlreadyApprovedError(error)).toBe(true);
  });

  it('gecersiz link (404) hatasini onay sayilmaz', () => {
    const error = new ApiError('SHARE_LINK_NOT_FOUND', 'Baglanti gecersiz.', 404);

    expect(isAlreadyApprovedError(error)).toBe(false);
  });

  it('dogrulama hatasini onay saymaz', () => {
    const error = new ApiError('VALIDATION_ERROR', 'Girdi dogrulanamadi.', 400);

    expect(isAlreadyApprovedError(error)).toBe(false);
  });

  it('API disi hatalarda ve null degerde false doner', () => {
    expect(isAlreadyApprovedError(new Error('ag hatasi'))).toBe(false);
    expect(isAlreadyApprovedError(null)).toBe(false);
  });
});
