#!/usr/bin/env node
/**
 * E2E тесты FoodMirror — запуск через браузер (browser MCP).
 *
 * Использование:
 * 1. Открыть https://web.telegram.org/k/ и залогиниться
 * 2. Открыть чат с @FoodMirror_test_bot
 * 3. Заблокировать браузер (browser_lock)
 * 4. Запустить: node tests/e2e/run-e2e.js
 * 5. Выполнять шаги или передать агенту для автоматизации через MCP
 *
 * Тесты описаны в tests/e2e/TEST_PLAN.md
 *
 * UX Telegram Web:
 * - Поле ввода сообщения = ref e19 (generic), НЕ e1 (поиск)
 * - Кнопки "Подтвердить", "Отмена", "Сегодня" и т.д. можно имитировать текстом
 * - Навести на значок рядом со скрепкой — чтобы раскрыть кастомную клавиатуру
 */

const TESTS = [
  {
    id: "1",
    name: "Текстовый ввод → оценка → подтверждение",
    steps: [
      { action: "type", text: "овсянка 100г с бананом", then: "press Enter" },
      { action: "wait", ms: 8000 },
      { action: "snapshot", expect: ["Оценка", "ккал"] },
      { action: "hover", target: "icon next to paperclip" },
      { action: "click", target: "Подтвердить" },
      { action: "wait", ms: 2000 },
      { action: "snapshot", expect: ["Принято", "Сегодня"] },
    ],
  },
  {
    id: "2",
    name: "Отмена черновика",
    steps: [
      { action: "type", text: "йогурт 150г", then: "press Enter" },
      { action: "wait", ms: 8000 },
      { action: "type", text: "Отмена", then: "press Enter" },
      { action: "wait", ms: 1500 },
      { action: "snapshot", expect: ["Черновик отменён"] },
      { action: "type", text: "Отмена", then: "press Enter" },
      { action: "wait", ms: 1000 },
      { action: "snapshot", expect: ["Нет активного черновика"] },
    ],
  },
  {
    id: "3",
    name: "История «Сегодня»",
    steps: [
      { action: "hover", target: "icon next to paperclip" },
      { action: "click", target: "Сегодня" },
      { action: "wait", ms: 2000 },
      { action: "snapshot", expect: ["Сегодня"] },
    ],
  },
  {
    id: "4",
    name: "История «Вчера»",
    steps: [
      { action: "click", target: "Вчера" },
      { action: "wait", ms: 2000 },
      { action: "snapshot", expect: ["Вчера"] },
    ],
  },
  {
    id: "5",
    name: "«Почему так?» без черновика",
    steps: [
      { action: "type", text: "Почему так?", then: "press Enter" },
      { action: "wait", ms: 1500 },
      { action: "snapshot", expect: ["Нет активной оценки"] },
    ],
  },
  {
    id: "6",
    name: "Сложное блюдо — одна оценка",
    steps: [
      { action: "type", text: "рис 150г с яйцом", then: "press Enter" },
      { action: "wait", ms: 10000 },
      { action: "snapshot", expect: ["Оценка", "ккал"], notExpect: ["У: 0"] },
      { action: "click", target: "Подтвердить" },
      { action: "wait", ms: 2000 },
      { action: "snapshot", expect: ["Принято"] },
    ],
  },
];

function printSteps() {
  console.log("\n=== E2E тесты FoodMirror ===\n");
  for (const t of TESTS) {
    console.log(`\n--- Тест ${t.id}: ${t.name} ---`);
    t.steps.forEach((s, i) => {
      const desc = s.action === "type"
        ? `Ввести: "${s.text}"${s.then ? ` → ${s.then}` : ""}`
        : s.action === "wait"
          ? `Ждать ${s.ms}мс`
          : s.action === "snapshot"
            ? `Проверить snapshot: ${s.expect.join(", ")}${s.notExpect ? ` (не должно быть: ${s.notExpect.join(", ")})` : ""}`
            : s.action === "click"
              ? `Клик: ${s.target}`
              : s.action === "hover"
                ? `Навести: ${s.target}`
                : JSON.stringify(s);
      console.log(`  ${i + 1}. ${desc}`);
    });
  }
  console.log("\n=== Конец ===\n");
}

printSteps();
