import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConflictError, UnauthenticatedError, ValidationError } from '../errors/app-error';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface CapturedResponse {
  status: number;
  body: unknown;
}

function hostCapturing(captured: Partial<CapturedResponse>): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', url: '/api/v1/auth/register' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter.catch', () => {
  it("AppError'i sozlesmedeki tek tip hata zarfina cevirir", () => {
    const captured: Partial<CapturedResponse> = {};
    new AllExceptionsFilter().catch(
      new ConflictError('EMAIL_ALREADY_REGISTERED', 'Bu e-posta zaten kayitli.', [
        { field: 'email', message: 'bu e-posta zaten kayitli' },
      ]),
      hostCapturing(captured),
    );

    expect(captured.status).toBe(409);
    const envelope = (captured.body as { error: Record<string, unknown> }).error;
    expect(envelope.code).toBe('EMAIL_ALREADY_REGISTERED');
    expect(envelope.message).toBe('Bu e-posta zaten kayitli.');
    expect(envelope.details).toEqual([{ field: 'email', message: 'bu e-posta zaten kayitli' }]);
    expect(typeof envelope.traceId).toBe('string');
    expect(Object.keys(envelope).sort()).toEqual(['code', 'details', 'message', 'traceId']);
  });

  it('details tasimayan hatalarda details alanini govdeye koymaz (CLAUDE.md §4.2.3)', () => {
    const captured: Partial<CapturedResponse> = {};
    new AllExceptionsFilter().catch(
      new UnauthenticatedError('INVALID_CREDENTIALS', 'E-posta veya sifre hatali.'),
      hostCapturing(captured),
    );

    expect(captured.status).toBe(401);
    expect(captured.body).not.toHaveProperty('error.details');
  });

  it('dogrulama hatasinda alan bazli detaylari korur', () => {
    const captured: Partial<CapturedResponse> = {};
    new AllExceptionsFilter().catch(
      new ValidationError('Girdi dogrulanamadi.', [
        { field: 'password', message: 'parola en az 8 karakter olmalidir' },
      ]),
      hostCapturing(captured),
    );

    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', details: [{ field: 'password' }] },
    });
  });

  it('bilinmeyen istisnayi 500 INTERNAL_ERROR yapar ve ic detayi sizdirmaz', () => {
    const captured: Partial<CapturedResponse> = {};
    new AllExceptionsFilter().catch(
      new Error('select * from users failed: connection refused'),
      hostCapturing(captured),
    );

    expect(captured.status).toBe(500);
    expect(JSON.stringify(captured.body)).not.toContain('connection refused');
    expect(captured.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });

  it("framework kaynakli HttpException'i bilinen hata koduna esler", () => {
    const captured: Partial<CapturedResponse> = {};
    new AllExceptionsFilter().catch(
      new HttpException('Not Found', HttpStatus.NOT_FOUND),
      hostCapturing(captured),
    );

    expect(captured.status).toBe(404);
    expect(captured.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('her yanita korelasyon icin traceId koyar', () => {
    const first: Partial<CapturedResponse> = {};
    const second: Partial<CapturedResponse> = {};
    const filter = new AllExceptionsFilter();

    filter.catch(new ValidationError(), hostCapturing(first));
    filter.catch(new ValidationError(), hostCapturing(second));

    const traceIdOf = (body: unknown): string =>
      (body as { error: { traceId: string } }).error.traceId;
    expect(traceIdOf(first.body)).not.toBe(traceIdOf(second.body));
  });
});
