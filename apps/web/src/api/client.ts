// Tek fetch sarmalayici (CLAUDE.md §3.9): token eklemek ve hata zarfini cozmek YALNIZCA
// burada yapilir; bilesen icinde ciplak `fetch` yasaktir.
//
// Taban adres ve token okuyucu disaridan verilir (kurulum `main.tsx`'te yapilir): boylece
// modul `import.meta.env`'e bagimli olmaz ve testte sahte fetch ile calisir.

/** Sunucunun tek tip hata zarfi (api-contract.yaml → ErrorEnvelope, CLAUDE.md §4.1). */
interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
    traceId: string;
  };
}

/** Istemci tarafinda hata kodu ile dallanilir, mesaj metnine gore DEGIL (CLAUDE.md §4.3). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}

export interface ApiClientOptions {
  /** Ornegin `/api/v1` (ayni kaynak) — deger `main.tsx`'te ortam degiskeninden gelir. */
  baseUrl: string;
  readAccessToken: () => string | null;
  fetchImpl?: typeof fetch;
}

const GENERIC_ERROR_MESSAGE = 'Beklenmeyen bir hata olustu, lutfen tekrar deneyin.';

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false;
  }
  const { error } = body;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Zarf cozulemedi (ornegin ters vekil sunucudan gelen HTML): genel hataya dusulur.
  }
  if (isErrorEnvelope(body)) {
    return new ApiError(body.error.code, body.error.message, response.status, body.error.details);
  }
  return new ApiError('INTERNAL_ERROR', GENERIC_ERROR_MESSAGE, response.status);
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch: typeof fetch =
    options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
      const token = options.readAccessToken();
      if (token !== null) {
        headers.Authorization = `Bearer ${token}`;
      }
      // FormData'da sinir degerini (boundary) tarayici uretir; Content-Type ELLE ayarlanmaz.
      if (typeof init.body === 'string' && headers['Content-Type'] === undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await doFetch(`${options.baseUrl}${path}`, { ...init, headers });
      if (!response.ok) {
        throw await toApiError(response);
      }
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    },
  };
}
