import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN обязателен'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY обязателен'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  DEV_TELEGRAM_MOCK_ENABLED: z.string().default('0'),
  DEV_TELEGRAM_MOCK_USER_ID: z.string().default('900001'),
  DEV_TELEGRAM_MOCK_FIRST_NAME: z.string().default('Local'),
  DEV_TELEGRAM_MOCK_LAST_NAME: z.string().optional(),
  DEV_TELEGRAM_MOCK_USERNAME: z.string().default('local_dev'),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`);
    console.error('Ошибка конфигурации:\n' + missing.join('\n'));
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
