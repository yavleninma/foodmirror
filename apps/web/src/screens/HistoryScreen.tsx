import { useState, useEffect, useCallback } from 'react';
import type { InsightResponse } from '@foodmirror/shared';
import { HistoryList } from '../components/HistoryList';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { api } from '../lib/api';

export function HistoryScreen() {
  const [entries, setEntries] = useState<InsightResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchHistory = useCallback(async (cursor?: string) => {
    try {
      const data = await api.getHistory(20, cursor);
      if (cursor) {
        setEntries(prev => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }
      setNextCursor(data.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить историю. Попробуй ещё раз.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchHistory().finally(() => setLoading(false));
  }, [fetchHistory]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchHistory(nextCursor);
    setLoadingMore(false);
  }, [nextCursor, fetchHistory]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    fetchHistory().finally(() => setLoading(false));
  }, [fetchHistory]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold">История</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {loading && <Loader text="Загружаю историю…" />}

        {error && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleRetry} aria-label="Повторить попытку">
              Повторить
            </Button>
          </div>
        )}

        {!loading && !error && <HistoryList entries={entries} />}

        {nextCursor && !loadingMore && (
          <div className="mt-4 text-center">
            <Button variant="secondary" size="sm" onClick={handleLoadMore}>
              Загрузить ещё
            </Button>
          </div>
        )}

        {loadingMore && <Loader text="Загружаю…" />}
      </div>
    </div>
  );
}
