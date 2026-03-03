import type { StatsResponse } from '@foodmirror/shared';

interface StatsCardProps {
  stats: StatsResponse;
}

function getDayWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}

export function StatsCard({ stats }: StatsCardProps) {
  return (
    <div className="flex flex-col items-center py-14 gap-2 animate-bounce-in">
      <span className="text-6xl mb-2">🔥</span>
      <p className="text-7xl font-black text-[var(--color-streak)] leading-none">
        {stats.streak}
      </p>
      <p className="text-lg text-[var(--color-text-secondary)] font-medium">
        {getDayWord(stats.streak)} подряд
      </p>

      {stats.thisWeek > 0 && (
        <p className="text-sm text-[var(--color-text-secondary)] mt-4">
          {stats.thisWeek} фото на этой неделе
        </p>
      )}

      <p className="text-xs text-[var(--color-text-secondary)] mt-6 text-center max-w-[220px] leading-relaxed opacity-60">
        Чем длиннее стрик — тем крепче привычка
      </p>
    </div>
  );
}
