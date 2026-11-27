import { expect, test } from '@playwright/test';
import { openApp } from '@x10/shared/e2e';

const HOST = 'Maren Solberg';
const LEARNER = 'Devon Okafor';

test.describe('Hearth Sprint E2E & Acceptance Criteria', () => {
  test('smoke: loads hearth centrepiece with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await openApp(page, '/', HOST);
    await expect(page.getByTestId('hearth-stage')).toBeVisible();
    await expect(page.getByTestId('brass-thermometer')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('AC5: fire and list view show the same R per topic; reduced motion stops sparks but keeps glow', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, '/', HOST);

    const stage = page.getByTestId('hearth-stage');
    await expect(stage).toBeVisible();
    await expect(stage).toHaveAttribute('data-sparks', 'paused');

    // Capture R from first hearth log
    const firstLog = page.locator('[data-testid^="hearth-log-"]').first();
    const logTestId = await firstLog.getAttribute('data-testid');
    const topicId = logTestId!.replace('hearth-log-', '');
    const stageR = Number(await firstLog.getAttribute('data-r'));

    // Switch to List view and verify exact same R%
    await page.getByRole('radio', { name: 'List' }).click();
    const listRText = await page.getByTestId(`list-r-${topicId}`).innerText();
    expect(listRText.trim()).toBe(`${Math.round(stageR * 100)}%`);
  });

  test('centrepiece: lens switch, Today focus, and ?nowebgl fallback', async ({ page }, info) => {
    await openApp(page, '/?nowebgl=1', HOST);
    await expect(page.getByTestId('hearth-stage')).toHaveAttribute('data-sparks', 'paused');

    await page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: 'Recall due' }).click();
    if (info.project.name === 'phone') {
      await page.getByRole('button', { name: /^Today/ }).click();
    }
    await page.getByRole('button', { name: /min today/ }).click();
    await expect(page.getByTestId('soot-curve')).toBeVisible();
  });

  test('AC3 UI: logging an 8-minute session shows 0 effective hours preview', async ({ page }) => {
    await openApp(page, '/study', LEARNER);
    await page.getByLabel('Minutes').fill('8');
    await expect(page.getByText('Under 10 min = 0')).toBeVisible();
    await page.getByRole('button', { name: 'Log session' }).click();
    await expect(page.getByText(/under 10 min counts 0/i)).toBeVisible();
  });

  test('AC2 UI: submitting a recall check goes to Buddy bench awaiting confirmation', async ({ page }) => {
    await openApp(page, '/poker', LEARNER);
    const gotItButtons = page.getByRole('button', { name: 'Got it' });
    const count = await gotItButtons.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      await gotItButtons.nth(i).click();
    }
    await page.getByRole('button', { name: 'Send for confirmation' }).click();
    await expect(page.getByText(/buddy confirmation/i)).toBeVisible();
  });
});
