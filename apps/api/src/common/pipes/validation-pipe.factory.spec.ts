import type { ValidationError as ClassValidatorError } from 'class-validator';
import { ValidationError } from '../errors/app-error';
import { toValidationError } from './validation-pipe.factory';

function classValidatorError(
  property: string,
  constraints: Record<string, string>,
): ClassValidatorError {
  return { property, constraints };
}

describe('toValidationError', () => {
  it('class-validator hatalarini alan bazli hata zarfi detaylarina cevirir', () => {
    const error = toValidationError([
      classValidatorError('email', { isEmail: 'gecerli bir e-posta adresi giriniz' }),
      classValidatorError('password', { minLength: 'parola en az 8 karakter olmalidir' }),
    ]);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([
      { field: 'email', message: 'gecerli bir e-posta adresi giriniz' },
      { field: 'password', message: 'parola en az 8 karakter olmalidir' },
    ]);
  });

  it('ayni alanin birden fazla kuralinda ilk mesaji kullanir', () => {
    const error = toValidationError([
      classValidatorError('password', {
        minLength: 'parola en az 8 karakter olmalidir',
        isString: 'parola metin olmalidir',
      }),
    ]);

    expect(error.details).toEqual([
      { field: 'password', message: 'parola en az 8 karakter olmalidir' },
    ]);
  });

  it('kisit bilgisi olmayan hatada alan adini yine de bildirir', () => {
    const error = toValidationError([{ property: 'email' }]);

    expect(error.details).toEqual([{ field: 'email', message: 'geçersiz değer' }]);
  });
});
