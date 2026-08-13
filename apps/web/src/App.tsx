import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import type { ApiClient } from './api/client';
import { AppRoutes } from './router';

interface AppProps {
  client: ApiClient;
}

/** Sunucu durumu TanStack Query ile yonetilir; global istemci state kutuphanesi yok (§3.9). */
export function App({ client }: AppProps): React.JSX.Element {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes client={client} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
