import { KNOWN_VERDICTS } from '@foodmirror/shared';

interface InsightResultProps {
  verdict: string;
  correction: string;
  onReset: () => void;
}

function getLegend(verdict: string): string {
  const v = verdict?.toLowerCase().trim();
  return KNOWN_VERDICTS[v] || 'Результат анализа поведения перед едой';
}

function getVerdictStyle(verdict: string): { emoji: string; colorClass: string } {
  const v = verdict?.toLowerCase().trim();
  if (v === 'норма' || v === 'хорошо') {
    return { emoji: '✅', colorClass: 'text-[var(--color-success)]' };
  }
  if (v === 'риск') {
    return { emoji: '⚠️', colorClass: 'text-[var(--color-warning)]' };
  }
  return { emoji: '🔍', colorClass: 'text-[var(--color-text)]' };
}

export function InsightResult({ verdict, correction, onReset }: InsightResultProps) {
  const { emoji, colorClass } = getVerdictStyle(verdict);

  return (
    <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-lg p-5 animate-slide-up">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl leading-none mt-0.5">{emoji}</span>
        <div>
          <p className={`text-lg font-bold leading-tight ${colorClass}`}>{verdict}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{getLegend(verdict)}</p>
        </div>
      </div>
      <p className="text-[15px] leading-relaxed text-[var(--color-text)] mb-4">{correction}</p>
      <button
        onClick={onReset}
        className="text-[var(--color-primary)] text-sm font-semibold"
        aria-label="Сделать ещё одно фото"
      >
        ← Ещё фото
      </button>
    </div>
  );
}
