import { useEffect } from 'react';
import { useTelegram } from './useTelegram';
import { api } from '../lib/api';

/**
 * Инициализирует API клиент с initData из Telegram или guest-токеном для веба.
 * Вызывать один раз в корневом компоненте.
 */
export function useApiInit() {
  const telegram = useTelegram();
  const { initData, guestToken } = telegram;

  useEffect(() => {
    api.setInitData(initData);
  }, [initData]);

  useEffect(() => {
    api.setGuestToken(guestToken);
  }, [guestToken]);

  return telegram;
}
