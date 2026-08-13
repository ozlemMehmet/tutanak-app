import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { PayloadTooLargeException } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { UnprocessableError } from '../../common/errors/app-error';
import { PhotoUploadLimitInterceptor } from './photo-upload-limit.interceptor';

const CONTEXT = {} as ExecutionContext;

function handlerThatThrows(error: unknown): CallHandler {
  return { handle: () => throwError(() => error) };
}

describe('PhotoUploadLimitInterceptor', () => {
  it('boyut sinirini asan yuklemeyi 400 FILE_TOO_LARGE hatasina cevirir', async () => {
    const interceptor = new PhotoUploadLimitInterceptor();

    const error = await firstValueFrom(
      interceptor.intercept(CONTEXT, handlerThatThrows(new PayloadTooLargeException())),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnprocessableError);
    expect((error as UnprocessableError).code).toBe('FILE_TOO_LARGE');
    expect((error as UnprocessableError).httpStatus).toBe(400);
  });

  it('diger hatalari oldugu gibi birakir', async () => {
    const original = new Error('baska bir hata');
    const interceptor = new PhotoUploadLimitInterceptor();

    const error = await firstValueFrom(
      interceptor.intercept(CONTEXT, handlerThatThrows(original)),
    ).catch((caught: unknown) => caught);

    expect(error).toBe(original);
  });

  it('basarili yaniti degistirmeden gecirir', async () => {
    const interceptor = new PhotoUploadLimitInterceptor();

    await expect(
      firstValueFrom(interceptor.intercept(CONTEXT, { handle: () => of({ id: 'foto' }) })),
    ).resolves.toEqual({ id: 'foto' });
  });
});
