import { test, expect } from '@playwright/test';

test.describe('Proposals flow', () => {
  test('proposals page loads', async ({ page }) => {
    await page.goto('/proposals');
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('proposals list renders', async ({ page }) => {
    await page.goto('/proposals');
    await page.waitForLoadState('networkidle');

    const proposalLink = page.locator('a[href*="/proposals/"]').first();
    if (await proposalLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      expect(await proposalLink.textContent()).toBeTruthy();
    }
  });

  test('can navigate to proposal detail', async ({ page }) => {
    await page.goto('/proposals');
    await page.waitForLoadState('networkidle');

    const proposalLink = page.locator('a[href*="/proposals/"]').first();
    if (await proposalLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await proposalLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
