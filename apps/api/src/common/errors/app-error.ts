// Uygulama hata hiyerarsisi (CLAUDE.md §4.2). Servisler yalnizca bu siniflari firlatir;
// `throw new Error(...)` ve Nest HttpException dogrudan kullanilmaz. Kod listesi
// api-contract.yaml → ErrorEnvelope.code enum'undan gelir, yeni kod uydurulmaz.

/** api-contract.yaml → ErrorEnvelope.code enum'u ile birebir. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'TEMPLATE_NOT_FOUND'
  | 'REPORT_HAS_NO_PHOTOS'
  | 'UNSUPPORTED_MEDIA_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'PHOTO_LIMIT_REACHED'
  | 'SHARE_LINK_NOT_FOUND'
  | 'REPORT_ALREADY_APPROVED'
  | 'SUBSCRIPTION_ALREADY_ACTIVE'
  | 'INVALID_WEBHOOK_SIGNATURE'
  | 'STORAGE_UNAVAILABLE'
  | 'PAYMENT_PROVIDER_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

/** Alan bazli hata; yalnizca VALIDATION_ERROR ve EMAIL_ALREADY_REGISTERED doldurur (§4.2.3). */
export interface ErrorDetail {
  field: string;
  message: string;
}

export abstract class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: ErrorDetail[];

  protected constructor(
    code: ErrorCode,
    httpStatus: number,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Girdi dogrulanamadi.', details?: ErrorDetail[]) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

type UnauthenticatedCode = Extract<
  ErrorCode,
  'UNAUTHENTICATED' | 'INVALID_CREDENTIALS' | 'INVALID_WEBHOOK_SIGNATURE'
>;

export class UnauthenticatedError extends AppError {
  constructor(
    code: UnauthenticatedCode = 'UNAUTHENTICATED',
    message = 'Bu islem icin oturum acmaniz gerekiyor.',
  ) {
    super(code, 401, message);
  }
}

type NotFoundCode = Extract<ErrorCode, 'NOT_FOUND' | 'TEMPLATE_NOT_FOUND' | 'SHARE_LINK_NOT_FOUND'>;

export class NotFoundError extends AppError {
  constructor(code: NotFoundCode = 'NOT_FOUND', message = 'Kaynak bulunamadi.') {
    // 404 yanitlari alan bazli `details` tasimaz (CLAUDE.md §4.2.3).
    super(code, 404, message);
  }
}

type ConflictCode = Extract<
  ErrorCode,
  | 'EMAIL_ALREADY_REGISTERED'
  | 'REPORT_ALREADY_APPROVED'
  | 'PHOTO_LIMIT_REACHED'
  | 'SUBSCRIPTION_ALREADY_ACTIVE'
>;

export class ConflictError extends AppError {
  constructor(code: ConflictCode, message: string, details?: ErrorDetail[]) {
    super(code, 409, message, details);
  }
}
