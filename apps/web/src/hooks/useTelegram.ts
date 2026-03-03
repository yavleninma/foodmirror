import { useEffect, useMemo } from 'react';

interface TelegramUnsafeUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUnsafeUser;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

const GUEST_TOKEN_KEY = 'foodmirror_guest_token';
const DEV_MOCK_INIT_DATA_PREFIX = 'dev_mock:';

function getOrCreateGuestToken(): string {
  let token = localStorage.getItem(GUEST_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  }
  return token;
}

function applyColorScheme(scheme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', scheme === 'dark');
}

function isTruthyFlag(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function isEnabledByUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return isTruthyFlag(params.get('tgMock') || undefined) || isTruthyFlag(params.get('devTelegramMock') || undefined);
}

function resolveDevMockUser(): TelegramUnsafeUser {
  const rawId = import.meta.env.VITE_DEV_TELEGRAM_USER_ID || '900001';
  const parsedId = Number.parseInt(rawId, 10);
  const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 900001;

  return {
    id,
    first_name: import.meta.env.VITE_DEV_TELEGRAM_FIRST_NAME || 'Local',
    last_name: import.meta.env.VITE_DEV_TELEGRAM_LAST_NAME || undefined,
    username: import.meta.env.VITE_DEV_TELEGRAM_USERNAME || 'local_dev',
  };
}

function createDevMockInitData(user: TelegramUnsafeUser): string {
  const payload = {
    id: String(user.id),
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
  };
  return `${DEV_MOCK_INIT_DATA_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
}

function createDevMockWebApp(): TelegramWebApp {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const noop = () => {};
  const user = resolveDevMockUser();
  const noButton = {
    text: '',
    show: noop,
    hide: noop,
    onClick: noop,
    offClick: noop,
  };

  return {
    initData: createDevMockInitData(user),
    initDataUnsafe: {
      user,
    },
    ready: noop,
    expand: noop,
    close: noop,
    MainButton: noButton,
    BackButton: noButton,
    HapticFeedback: {
      impactOccurred: noop,
      notificationOccurred: noop,
    },
    colorScheme: dark ? 'dark' : 'light',
    themeParams: {},
  };
}

export function useTelegram() {
  const rawWebApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  const devMockEnabled = isTruthyFlag(import.meta.env.VITE_DEV_TELEGRAM_MOCK) || isEnabledByUrl();
  const useDevTelegramMock = typeof window !== 'undefined'
    && import.meta.env.DEV
    && !rawWebApp?.initData
    && devMockEnabled;

  const webApp = useMemo(() => {
    if (rawWebApp) return rawWebApp;
    if (!useDevTelegramMock) return undefined;
    return createDevMockWebApp();
  }, [rawWebApp, useDevTelegramMock]);

  useEffect(() => {
    if (webApp) {
      webApp.ready();
      webApp.expand();
      applyColorScheme(webApp.colorScheme || 'light');
    } else if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyColorScheme(prefersDark ? 'dark' : 'light');

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => applyColorScheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [webApp]);

  const isInTelegram = !!webApp?.initData;
  const initData = useMemo(() => webApp?.initData || '', [webApp]);
  const colorScheme = useMemo(() => webApp?.colorScheme || 'light', [webApp]);
  const isDevTelegramMock = useMemo(
    () => useDevTelegramMock && Boolean(webApp?.initData?.startsWith(DEV_MOCK_INIT_DATA_PREFIX)),
    [useDevTelegramMock, webApp]
  );

  const guestToken = useMemo(() => {
    if (isInTelegram || typeof window === 'undefined') return '';
    return getOrCreateGuestToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInTelegram]);

  const user = useMemo(() => {
    const u = webApp?.initDataUnsafe?.user;
    if (!u) return null;
    return {
      id: String(u.id),
      firstName: u.first_name,
      lastName: u.last_name,
      username: u.username,
    };
  }, [webApp]);

  return {
    webApp,
    initData,
    guestToken,
    user,
    isInTelegram,
    isDevTelegramMock,
    colorScheme,
  };
}
