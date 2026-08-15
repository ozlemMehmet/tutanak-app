// Kayit mutation'i (T-018). Bilincli olarak `session.signIn` CAGIRMAZ: `POST /auth/register`
// yaniti token tasimaz (sozlesme: 201 -> `User`), bu yuzden otomatik giris YAPILMAZ ve
// kullanici `/login`'e yonlendirilir (design.md §3 RegisterPage success durumu).
import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ApiClient } from '../../api/client';
import type { Credentials, User } from './auth.api';
import { registerUser } from './auth.api';

export function useRegister(client: ApiClient): UseMutationResult<User, unknown, Credentials> {
  return useMutation({
    mutationFn: (credentials: Credentials) => registerUser(client, credentials),
  });
}
