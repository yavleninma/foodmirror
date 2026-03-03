import { useState, useEffect, useCallback } from 'react';
import type { StatsResponse } from '@foodmirror/shared';
import { StatsCard } from '../components/StatsCard';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { api } from '../lib/api';

export function StatsScreen() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить статистику. Попробуй ещё раз.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold">Статистика</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {loading && <Loader text="Загружаю статистику…" />}

        {error && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleRetry} aria-label="Повторить попытку">
              Повторить
            </Button>
          </div>
        )}

        {!loading && !error && stats && <StatsCard stats={stats} />}
      </div>
    </div>
  );
}
