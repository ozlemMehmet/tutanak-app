import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

/** Sozlesmeden URETILEN tipler (CLAUDE.md §3.6); elle yazilmis kopya tutulmaz. */
export type MeResponse = components['schemas']['MeResponse'];

/**
 * Oturum sahibinin profilini ceker (T-003 sozlesmesi). AppShell yalnizca `email` alanini
 * gosterir — sozlesmede ad/soyad alani yoktur (design.md §6.2).
 */
export function fetchCurrentUser(client: ApiClient): Promise<MeResponse> {
  return client.request<MeResponse>('/me');
}
