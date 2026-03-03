import type { InsightResponse, HistoryResponse, StatsResponse, UserGoalResponse, HealthResponse } from '@foodmirror/shared';

export class ApiClient {
  private initData = '';
  private guestToken = '';

  setInitData(initData: string) {
    this.initData = initData;
  }

  setGuestToken(token: string) {
    this.guestToken = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.initData) {
      headers['X-Init-Data'] = this.initData;
    } else if (this.guestToken) {
      headers['X-Guest-Token'] = this.guestToken;
    }

    // Не ставим Content-Type для FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`/api${path}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error((data as any).error || 'Что-то пошло не так') as Error & { status: number };
      error.status = res.status;
      throw error;
    }

    return data as T;
  }

  async getInsight(photo: File): Promise<InsightResponse> {
    const form = new FormData();
    form.append('photo', photo);
    return this.request<InsightResponse>('/insight', {
      method: 'POST',
      body: form,
    });
  }

  async getHistory(limit?: number, cursor?: string): Promise<HistoryResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return this.request<HistoryResponse>(`/history${qs ? `?${qs}` : ''}`);
  }

  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>('/stats');
  }

  async updateGoal(goal: string): Promise<UserGoalResponse> {
    return this.request<UserGoalResponse>('/user/goal', {
      method: 'PUT',
      body: JSON.stringify({ goal }),
    });
  }

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async getMe(): Promise<{ id: string; firstName: string | null; goal: string }> {
    return this.request('/user/me');
  }
}

export const api = new ApiClient();
