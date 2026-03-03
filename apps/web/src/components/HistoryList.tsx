import type { InsightResponse } from '@foodmirror/shared';

interface HistoryListProps {
  entries: InsightResponse[];
}

function getVerdictDot(verdict: string): string {
  const v = verdict.toLowerCase().trim();
  if (v === 'норма' || v === 'хорошо') return 'bg-[var(--color-success)]';
  if (v === 'риск') return 'bg-[var(--color-warning)]';
  return 'bg-[var(--color-text-secondary)]';
}

function getVerdictColor(verdict: string): string {
  const v = verdict.toLowerCase().trim();
  if (v === 'норма' || v === 'хорошо') return 'text-[var(--color-success)]';
  if (v === 'риск') return 'text-[var(--color-warning)]';
  return 'text-[var(--color-text)]';
}

export function HistoryList({ entries }: HistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-5xl">🍽️</span>
        <p className="text-[var(--color-text-secondary)] text-center text-[15px] leading-relaxed max-w-[240px]">
          Сделай первое фото перед едой — привычка начнётся здесь
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="bg-[var(--color-bg-card)] rounded-2xl px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${getVerdictDot(entry.verdict)}`} />
            <p className={`font-semibold text-sm ${getVerdictColor(entry.verdict)}`}>
              {entry.verdict}
            </p>
            <time className="ml-auto text-xs text-[var(--color-text-secondary)]">
              {new Date(entry.createdAt).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pl-4">
            {entry.correction}
          </p>
        </li>
      ))}
    </ul>
  );
}
