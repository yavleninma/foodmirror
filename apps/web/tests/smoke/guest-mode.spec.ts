import { expect, test, type Page } from '@playwright/test';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5Ww2cAAAAASUVORK5CYII=',
  'base64'
);

async function uploadPhoto(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'food.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });
}

async function mockTelegramWebApp(page: Page) {
  await page.route('https://telegram.org/js/telegram-web-app.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        (() => {
          const noop = () => {};
          window.Telegram = {
            WebApp: {
              initData: 'e2e-telegram-init-data',
              initDataUnsafe: {
                user: {
                  id: 700001,
                  first_name: 'E2E',
                  username: 'e2e_runner',
                },
              },
              ready: noop,
              expand: noop,
              close: noop,
              MainButton: {
                text: '',
                show: noop,
                hide: noop,
                onClick: noop,
                offClick: noop,
              },
              BackButton: {
                show: noop,
                hide: noop,
                onClick: noop,
                offClick: noop,
              },
              HapticFeedback: {
                impactOccurred: noop,
                notificationOccurred: noop,
              },
              colorScheme: 'light',
              themeParams: {},
            },
          };
        })();
      `,
    });
  });
}

test('health endpoint returns ok', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3000/api/health');
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.status).toBe('ok');
});

test('guest mode renders app and hides personal tabs', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'FoodMirror' })).toBeVisible();
  await expect(page.locator('nav')).toHaveCount(0);
});

test('guest can upload photo and receive analysis', async ({ page }) => {
  let insightCalls = 0;

  await page.route('**/api/insight', async (route) => {
    insightCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `insight-${insightCalls}`,
        verdict: 'mock-verdict-success',
        correction: 'mock-correction-success',
        createdAt: '2026-03-03T09:00:00.000Z',
      }),
    });
  });

  await page.goto('/');

  const requestPromise = page.waitForRequest('**/api/insight');
  await uploadPhoto(page);
  const request = await requestPromise;

  expect(request.method()).toBe('POST');
  await expect(page.getByText('Analyzing photo...')).toBeVisible();
  await expect(page.getByText('mock-verdict-success')).toBeVisible();
  await expect(page.getByText('mock-correction-success')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retake' })).toBeVisible();
  expect(insightCalls).toBe(1);
});

test('guest can retry when first analysis fails', async ({ page }) => {
  let insightCalls = 0;

  await page.route('**/api/insight', async (route) => {
    insightCalls += 1;

    if (insightCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'mock-insight-failed' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `insight-${insightCalls}`,
        verdict: 'mock-verdict-retry-success',
        correction: 'mock-correction-retry-success',
        createdAt: '2026-03-03T09:05:00.000Z',
      }),
    });
  });

  await page.goto('/');

  await uploadPhoto(page);

  await expect(page.getByText('mock-insight-failed')).toBeVisible();
  const retryButton = page.getByRole('button', { name: 'Retry' });
  await expect(retryButton).toBeVisible();
  await retryButton.click();

  await expect(page.getByText('mock-verdict-retry-success')).toBeVisible();
  await expect(page.getByText('mock-correction-retry-success')).toBeVisible();
  expect(insightCalls).toBe(2);
});

test('telegram mode shows personal tabs and loads history and stats', async ({ page }) => {
  let historyCalls = 0;
  let statsCalls = 0;

  await mockTelegramWebApp(page);

  await page.route('**/api/stats', async (route) => {
    statsCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        thisWeek: 777,
        lastWeek: 5,
        streak: 42,
      }),
    });
  });

  await page.route('**/api/history**', async (route) => {
    historyCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: [
          {
            id: 'history-1',
            verdict: 'mock-history-verdict',
            correction: 'mock-history-correction',
            createdAt: '2026-03-03T08:30:00.000Z',
          },
        ],
        nextCursor: null,
      }),
    });
  });

  await page.goto('/');

  const tabs = page.locator('nav button');
  await expect(tabs).toHaveCount(3);
  await expect(page.getByText('42')).toBeVisible();

  await tabs.nth(1).click();
  await expect(page.getByText('mock-history-correction')).toBeVisible();

  await tabs.nth(2).click();
  await expect(page.getByText(/777/)).toBeVisible();

  expect(historyCalls).toBeGreaterThan(0);
  expect(statsCalls).toBeGreaterThan(0);
});
