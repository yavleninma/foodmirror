/**
 * Smoke-тест бота: токен Telegram и (опционально) доступ к БД.
 * Запуск: npx tsx scripts/smoke-test-bot.ts
 * Переменные: TELEGRAM_BOT_TOKEN (обязательно), DATABASE_URL (опционально — проверить подключение к БД).
 *
 * Проверка "выдержит ли нагрузку": запустить несколько раз параллельно, например:
 *   for i in 1 2 3 4 5; do npx tsx scripts/smoke-test-bot.ts & done; wait
 */

import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { PrismaClient } from "@prisma/client";

const token = process.env.TELEGRAM_BOT_TOKEN;
const checkDb = !!process.env.DATABASE_URL;

async function main(): Promise<void> {
  const results: { name: string; ok: boolean; ms?: number; error?: string }[] = [];

  // 1. Telegram getMe
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN not set");
    process.exit(1);
  }
  const bot = new TelegramBot(token, { polling: false });
  const t0 = Date.now();
  try {
    const me = await bot.getMe();
    results.push({ name: "Telegram getMe", ok: true, ms: Date.now() - t0 });
    console.log("Telegram: OK (@%s)", me.username);
  } catch (e) {
    results.push({
      name: "Telegram getMe",
      ok: false,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    });
    console.error("Telegram: FAIL", e);
  }

  // 2. DB ping (optional)
  if (checkDb) {
    const prisma = new PrismaClient();
    const t1 = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.push({ name: "PostgreSQL", ok: true, ms: Date.now() - t1 });
      console.log("PostgreSQL: OK");
    } catch (e) {
      results.push({
        name: "PostgreSQL",
        ok: false,
        ms: Date.now() - t1,
        error: e instanceof Error ? e.message : String(e),
      });
      console.error("PostgreSQL: FAIL", e);
    } finally {
      await prisma.$disconnect();
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error("Smoke test failed:", failed);
    process.exit(1);
  }
  console.log("Smoke test OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
