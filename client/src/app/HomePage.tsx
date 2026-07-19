import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../lib/api';

// Phase 0 placeholder page: proves the client ↔ server ↔ shared-schema wiring.
// Replaced by the real app shell in Phase 1+.
export function HomePage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-900">
      <h1 className="text-3xl font-bold">Routine App</h1>
      <p className="text-slate-500">AI-powered routine management — Phase 0 scaffold</p>
      <p className="rounded-md border border-slate-200 bg-white px-4 py-2 font-mono text-sm">
        API:{' '}
        {isLoading
          ? 'checking…'
          : isError
            ? '❌ unreachable (is the server running?)'
            : `✅ ${data?.status} (v${data?.version})`}
      </p>
    </main>
  );
}
