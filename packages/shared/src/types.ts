export interface InsightResponse {
  id: string;
  verdict: string;
  correction: string;
  createdAt: string;
}

export interface HistoryResponse {
  entries: InsightResponse[];
  nextCursor?: string;
}

export interface StatsResponse {
  thisWeek: number;
  lastWeek: number;
  streak: number;
}

export interface UserGoalResponse {
  goal: string;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}

export interface ApiError {
  error: string;
  code?: string;
}

export type Verdict = 'норма' | 'риск' | 'хорошо';

export const KNOWN_VERDICTS: Record<string, string> = {
  'норма': 'всё ок',
  'риск': 'стоит скорректировать',
  'хорошо': 'удачный выбор',
};
