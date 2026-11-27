import { test } from '@playwright/test';
import { openApp } from '@x10/shared/e2e';

const HOST = 'Maren Solberg';

test.describe('Hearth Sprint redesign screenshots', () => {
  test('capture 6 high-signal screenshots', async ({ page }, info) => {
    test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture screenshots.');
    const isPhone = info.project.name === 'phone';
    await page.emulateMedia({ reducedMotion: 'reduce' });

    if (!isPhone) {
      // 1. desktop-light-stage.png
      await page.emulateMedia({ colorScheme: 'light' });
      await openApp(page, '/', HOST);
      await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'docs/redesign/desktop-light-stage.png' });

      // 2. desktop-dark-stage.png
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'docs/redesign/desktop-dark-stage.png' });

      // 3. desktop-lens.png (Recall due + soot curve)
      await page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: 'Recall due' }).click();
      await page.getByRole('button', { name: /min today/ }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'docs/redesign/desktop-lens.png' });

      // 4. desktop-tool.png (Study log)
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/#/study');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'docs/redesign/desktop-tool.png' });
    } else {
      // 5. phone-light-stage.png
      await page.emulateMedia({ colorScheme: 'light' });
      await openApp(page, '/', HOST);
      await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'docs/redesign/phone-light-stage.png' });

      // 6. phone-dark-stage.png
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'docs/redesign/phone-dark-stage.png' });
    }
  });
});
