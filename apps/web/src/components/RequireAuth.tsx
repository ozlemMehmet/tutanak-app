// Korumali rotalarin oturum guard'i (T-017 kriter 2). Guard Clause deseni (CLAUDE.md §7):
// token yoksa erken cikilir, korumali icerik hic render edilmez.
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAccessToken } from '../features/auth/SessionProvider';

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps): React.JSX.Element {
  const accessToken = useAccessToken();
  const location = useLocation();

  if (accessToken === null) {
    // Hedef rota `redirectTo` ile korunur: giris basarili olunca LoginPage kullaniciyi
    // buraya geri getirir (design.md → LoginPage success durumu, T-018).
    const target = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(target)}`} replace />;
  }

  return <>{children}</>;
}
