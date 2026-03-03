import { useState, useCallback, useEffect, useRef } from 'react';
import { PhotoCapture } from '../components/PhotoCapture';
import { InsightResult } from '../components/InsightResult';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { api } from '../lib/api';

interface MainScreenProps {
  showStreak: boolean;
}

export function MainScreen({ showStreak }: MainScreenProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ verdict: string; correction: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!showStreak) {
      setStreak(0);
      return;
    }

    api
      .getStats()
      .then((stats) => setStreak(stats.streak))
      .catch(() => {});
  }, [showStreak]);

  const runAnalysis = useCallback(async (nextFile: File) => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.getInsight(nextFile);
      if (requestId !== requestIdRef.current) return;

      setResult({ verdict: data.verdict, correction: data.correction });
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;

      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      const message = err instanceof Error ? err.message : '';

      if (status === 429) {
        setError('Too many requests. Wait a minute and retry.');
      } else {
        setError(message || 'Could not analyze photo. Check internet and retry.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleCapture = useCallback(
    (nextFile: File, preview: string) => {
      setFile(nextFile);
      setPhoto(preview);
      void runAnalysis(nextFile);
    },
    [runAnalysis]
  );

  const handleRetry = useCallback(() => {
    if (!file || loading) return;
    void runAnalysis(file);
  }, [file, loading, runAnalysis]);

  const handleReset = useCallback(() => {
    requestIdRef.current += 1;
    setPhoto(null);
    setFile(null);
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">FoodMirror</h1>
        {showStreak && streak > 0 && (
          <div className="flex items-center gap-1.5 bg-[var(--color-bg-secondary)] rounded-full px-3 py-1.5 animate-bounce-in">
            <span className="font-bold text-sm text-[var(--color-streak)]">{streak}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">days</span>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 px-4 flex flex-col gap-3 overflow-y-auto pb-5">
        <PhotoCapture photo={photo} onCapture={handleCapture} className="flex-1 min-h-[240px]" />

        {loading && (
          <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-4">
            <Loader text="Analyzing photo..." />
          </div>
        )}

        {error && !loading && (
          <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-4 flex items-center gap-2">
            <p className="flex-1 text-sm text-[var(--color-danger)]">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleRetry} disabled={!file}>
              Retry
            </Button>
          </div>
        )}

        {result && !loading && (
          <InsightResult verdict={result.verdict} correction={result.correction} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
