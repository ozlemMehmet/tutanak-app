// Multer'in boyut siniri asildiginda urettigi 413 yanitini, sozlesmedeki
// 400 FILE_TOO_LARGE hatasina cevirir (api-contract.yaml: bu endpoint 413 TANIMLAMAZ).
// Sinir degeri multer'da (photos.module.ts) PHOTO_MAX_BYTES ile kurulur; boylece
// istek govdesi bellekte sinirsiz buyuyemez.

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { catchError, throwError } from 'rxjs';
import { UnprocessableError } from '../../common/errors/app-error';

// Sinir degeri yapilandirmadan geldigi icin mesaja SAYI GOMULMEZ (CLAUDE.md §5.1).
const FILE_TOO_LARGE_MESSAGE = 'Fotograf izin verilen boyut sinirini asiyor.';

@Injectable()
export class PhotoUploadLimitInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() =>
            error instanceof PayloadTooLargeException
              ? new UnprocessableError('FILE_TOO_LARGE', FILE_TOO_LARGE_MESSAGE)
              : error,
          ),
        ),
      );
  }
}
