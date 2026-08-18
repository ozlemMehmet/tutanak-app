// Tek tip hata zarfi (CLAUDE.md §4.1, api-contract.yaml → ErrorEnvelope).
// Taninmayan her istisna 500 INTERNAL_ERROR olur ve ic detay istemciye SIZMAZ (§4.2).

import { randomUUID } from 'node:crypto';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ErrorCode, ErrorDetail } from '../errors/app-error';
import { AppError } from '../errors/app-error';

interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    traceId: string;
  };
}

const INTERNAL_ERROR_MESSAGE = 'Beklenmeyen bir hata oluştu.';
const SERVER_ERROR_STATUS_THRESHOLD = 500;

/** Framework kaynakli HttpException'lari sozlesmedeki kodlara esler. */
const HTTP_STATUS_TO_CODE = new Map<number, ErrorCode>([
  [HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR'],
  [HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED'],
  [HttpStatus.FORBIDDEN, 'FORBIDDEN'],
  [HttpStatus.NOT_FOUND, 'NOT_FOUND'],
  [HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED'],
]);

interface HttpResponseLike {
  status(code: number): HttpResponseLike;
  json(body: unknown): unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const traceId = randomUUID();

    if (exception instanceof AppError) {
      response.status(exception.httpStatus).json(this.envelope(exception, traceId));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = HTTP_STATUS_TO_CODE.get(status) ?? 'INTERNAL_ERROR';
      // 5xx'te framework mesaji istemciye gonderilmez (ic detay sizabilir — §4.2).
      const message =
        status >= SERVER_ERROR_STATUS_THRESHOLD ? INTERNAL_ERROR_MESSAGE : exception.message;
      response.status(status).json({ error: { code, message, traceId } } satisfies ErrorEnvelope);
      return;
    }

    // Taninmayan istisna: istemciye sabit mesaj, ayrinti yalnizca sunucu logunda (§4.4).
    this.logger.error(`Islenemeyen istisna (traceId=${traceId})`, exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: INTERNAL_ERROR_MESSAGE, traceId },
    } satisfies ErrorEnvelope);
  }

  private envelope(error: AppError, traceId: string): ErrorEnvelope {
    return {
      error: {
        code: error.code,
        message: error.message,
        // details yalnizca dolu oldugunda gonderilir (CLAUDE.md §4.2.3).
        ...(error.details ? { details: error.details } : {}),
        traceId,
      },
    };
  }
}
