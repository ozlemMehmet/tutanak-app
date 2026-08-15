import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import type { ApiClient } from './api/client';
import { SessionProvider } from './features/auth/SessionProvider';
import type { SessionStore } from './features/auth/session';
import { AppRoutes } from './router';

interface AppProps {
  client: ApiClient;
  session: SessionStore;
}

/** Sunucu durumu TanStack Query ile yonetilir; global istemci state kutuphanesi yok (§3.9). */
export function App({ client, session }: AppProps): React.JSX.Element {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider store={session}>
        <BrowserRouter>
          <AppRoutes client={client} />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
