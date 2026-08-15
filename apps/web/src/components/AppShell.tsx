// AppShell — design.md §1 "Ekran disi ortak yapi": bagimsiz bir rota DEGIL, kimlikli 4
// ekranin (ReportList/ReportCreate/ReportDetail/Subscription) paylastigi duzen bilesenidir.
// Ust bar: uygulama adi + oturum acmis kullanicinin e-postasi + cikis; altinda gezinme.
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import type { ApiClient } from '../api/client';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { useSessionStore } from '../features/auth/SessionProvider';

interface AppShellProps {
  client: ApiClient;
}

const APP_NAME = 'Emlak Teslim Tutanagi';

const NAV_ITEMS: { to: string; label: string; end: boolean }[] = [
  // `/reports` icin `end`: aksi halde `/reports/new` ve `/reports/:id` ustunde de aktif gorunurdu.
  { to: '/reports', label: 'Tutanaklarim', end: true },
  { to: '/reports/new', label: 'Yeni Tutanak', end: false },
  { to: '/subscription', label: 'Abonelik', end: false },
];

const navLinkClassName = ({ isActive }: { isActive: boolean }): string =>
  isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link';

export function AppShell({ client }: AppShellProps): React.JSX.Element {
  const session = useSessionStore();
  const queryClient = useQueryClient();
  // Sozlesmede ad/soyad alani yok; kimlik gosterimi yalnizca e-postadir (design.md §6.2).
  const currentUser = useCurrentUser(client);

  const handleSignOut = (): void => {
    // Onbellek once temizlenir: oturum kapaninca onceki kullanicinin verisi ekranda kalmaz.
    queryClient.clear();
    session.signOut();
  };

  return (
    <div className="app-shell">
      {/* design.md §5: AppShell ustunde "Icerige gec" skip-link'i bulunur. */}
      <a className="skip-link" href="#main-content">
        Icerige gec
      </a>

      <header className="app-shell__header">
        <span className="app-shell__brand">{APP_NAME}</span>
        <div className="app-shell__session">
          {currentUser.data !== undefined && (
            <span className="app-shell__user">{currentUser.data.email}</span>
          )}
          <button
            type="button"
            className="button button--on-primary app-shell__signout"
            onClick={handleSignOut}
          >
            Cikis
          </button>
        </div>
      </header>

      <nav className="app-shell__nav" aria-label="Ana gezinme">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClassName}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div id="main-content">
        <Outlet />
      </div>
    </div>
  );
}
