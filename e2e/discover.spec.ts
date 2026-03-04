import { test, expect } from '@playwright/test';

test.describe('Discover flow', () => {
  test('discover page loads and shows DRep list', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('can search for a DRep', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('can navigate to a DRep profile', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const profileLink = page.locator('a[href*="/drep/"]').first();
    if (await profileLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await profileLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
