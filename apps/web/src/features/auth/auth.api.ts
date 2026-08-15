import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

/** Sozlesmeden URETILEN tipler (CLAUDE.md §3.6); elle yazilmis kopya tutulmaz. */
export type MeResponse = components['schemas']['MeResponse'];
export type LoginResponse = components['schemas']['LoginResponse'];
export type User = components['schemas']['User'];

/** Iki formun da topladigi girdi; `LoginRequest`/`RegisterRequest` ile ayni alanlar. */
export interface Credentials {
  email: string;
  password: string;
}

/**
 * Oturum sahibinin profilini ceker (T-003 sozlesmesi). AppShell yalnizca `email` alanini
 * gosterir — sozlesmede ad/soyad alani yoktur (design.md §6.2).
 */
export function fetchCurrentUser(client: ApiClient): Promise<MeResponse> {
  return client.request<MeResponse>('/me');
}

/**
 * Giris (T-003 sozlesmesi): 200 yaniti erisim token'i tasir, 401 INVALID_CREDENTIALS
 * hangi alanin hatali oldugunu BELIRTMEZ (design.md §3 LoginPage).
 */
export function login(client: ApiClient, credentials: Credentials): Promise<LoginResponse> {
  return client.request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
}

/**
 * Kayit (T-003 sozlesmesi): 201 yaniti YALNIZCA `User` doner — token yoktur, bu yuzden
 * otomatik giris yapilamaz (design.md §3 RegisterPage success durumu).
 *
 * Govde alanlari tek tek yazilir (`...credentials` ile yayilmaz): sifre-tekrar gibi
 * istemci tarafi alanlarin `RegisterRequest`e sizmasi yapisal olarak imkansiz olsun —
 * sunucu govde katiligi geregi beyaz liste disi alanda 400 doner (CLAUDE.md §3.7).
 */
export function registerUser(client: ApiClient, credentials: Credentials): Promise<User> {
  return client.request<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
}
