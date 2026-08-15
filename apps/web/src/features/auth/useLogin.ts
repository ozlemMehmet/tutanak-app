// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); LoginPage yazma islemini
// bu hook'a devreder. Oturumun SAKLANMASI burada olur (T-017 deposu), YONLENDIRME ise
// sayfanin isidir — rota bilgisi mutation'a sizmaz.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ApiClient } from '../../api/client';
import type { Credentials, LoginResponse } from './auth.api';
import { login } from './auth.api';
import { useSessionStore } from './SessionProvider';

export function useLogin(
  client: ApiClient,
): UseMutationResult<LoginResponse, unknown, Credentials> {
  const session = useSessionStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: Credentials) => login(client, credentials),
    onSuccess: (response) => {
      // Onbellek ONCE temizlenir: sona ermis bir oturumdan (401 -> signOut) kalan sorgu
      // verisi, yeni giren kullaniciya ait degildir. AppShell cikista ayni sey yapar.
      queryClient.clear();
      session.signIn(response.accessToken);
    },
  });
}
