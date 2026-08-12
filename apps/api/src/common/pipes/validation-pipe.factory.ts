// Global ValidationPipe yapilandirmasi (CLAUDE.md §1, §3.7).
// Govde katidir: beyaz liste disi alan 400 VALIDATION_ERROR uretir.

import { ValidationPipe } from '@nestjs/common';
import type { ValidationError as ClassValidatorError } from 'class-validator';
import type { ErrorDetail } from '../errors/app-error';
import { ValidationError } from '../errors/app-error';

const FALLBACK_DETAIL_MESSAGE = 'gecersiz deger';

function firstConstraintMessage(error: ClassValidatorError): string {
  const messages = Object.values(error.constraints ?? {});
  return messages[0] ?? FALLBACK_DETAIL_MESSAGE;
}

/** class-validator ciktisini sozlesmedeki alan bazli `details` listesine cevirir. */
export function toValidationError(errors: ClassValidatorError[]): ValidationError {
  const details: ErrorDetail[] = errors.map((error) => ({
    field: error.property,
    message: firstConstraintMessage(error),
  }));
  return new ValidationError('Girdi dogrulanamadi.', details);
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: toValidationError,
  });
}
