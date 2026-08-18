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

/** Ikili (binary) yanit: govde + sunucunun onerdigi dosya adi (`Content-Disposition`). */
export interface FileResponse {
  blob: Blob;
  /** Baslik yoksa `null`; dosya adini cagiran taraf belirler. */
  fileName: string | null;
}

export interface ApiClient {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  /**
   * JSON degil ikili govde okuyan istek (T-020: `GET /reports/{id}/pdf` → `application/pdf`).
   * Oturum basligi, 401 kancasi ve hata zarfi cozumlemesi `request` ile AYNI yoldan gecer:
   * bilesenler ciplak `fetch` kullanmadan dosya indirebilsin diye burada durur (CLAUDE.md §3.9).
   */
  requestFile: (path: string, init?: RequestInit) => Promise<FileResponse>;
}

export interface ApiClientOptions {
  /** Ornegin `/api/v1` (ayni kaynak) — deger `main.tsx`'te ortam degiskeninden gelir. */
  baseUrl: string;
  readAccessToken: () => string | null;
  fetchImpl?: typeof fetch;
  /**
   * Oturumlu bir istek 401 aldiginda cagrilir (T-017 kriter 5): saklanan oturum burada
   * temizlenir, yonlendirmeyi rota guard'i yapar. YALNIZCA Authorization basligi gonderilmis
   * isteklerde tetiklenir — `POST /auth/login` 401 INVALID_CREDENTIALS yaniti bir oturum
   * sonlanmasi degildir ve mevcut oturumu silmemelidir.
   */
  onUnauthorized?: () => void;
}

const GENERIC_ERROR_MESSAGE = 'Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.';
const UNAUTHORIZED_STATUS = 401;

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

/**
 * `attachment; filename="tutanak-r-1.pdf"` → `tutanak-r-1.pdf`. Baslik yoksa/cozulemezse
 * `null` doner: dosya adi uydurulmaz, karari cagiran taraf verir.
 */
function fileNameFromDisposition(disposition: string | null): string | null {
  if (disposition === null) {
    return null;
  }
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1] === undefined ? null : decodeURIComponent(match[1]);
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch: typeof fetch =
    options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));

  /** Ortak istek yolu: token eklenir, 401 kancasi tetiklenir, hata zarfi ApiError'a cevrilir. */
  const send = async (path: string, init: RequestInit): Promise<Response> => {
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
      if (response.status === UNAUTHORIZED_STATUS && token !== null) {
        options.onUnauthorized?.();
      }
      throw await toApiError(response);
    }
    return response;
  };

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const response = await send(path, init);
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    },

    async requestFile(path: string, init: RequestInit = {}): Promise<FileResponse> {
      // Hata yolunda govde JSON hata zarfidir (sozlesme): `send` bunu zaten cozer,
      // blob'a yalnizca basarili yanitta dokunulur.
      const response = await send(path, init);
      return {
        blob: await response.blob(),
        fileName: fileNameFromDisposition(response.headers.get('Content-Disposition')),
      };
    },
  };
}
