import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';

const CRITICAL_PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Discovery', path: '/?filter=dreps' },
  { name: 'Match', path: '/?mode=match' },
];

/**
 * Wait for the Seneca conversation panel's entrance animation to finish.
 *
 * On these public homepage routes the Seneca panel (`role="dialog"`) auto-opens
 * once the cinematic queue resolves, and framer-motion fades its content from
 * opacity 0 -> 1. axe-core derives each text node's effective colour by blending
 * it with the background by opacity, so a scan that lands mid-fade reports false
 * `color-contrast` failures: light panel text (`text-zinc-100` / `text-foreground`)
 * blends toward the near-black panel background into a low-contrast grey. Waiting
 * until every text element is fully opaque makes axe measure only the settled
 * state.
 *
 * Scoped to text-bearing elements deliberately -- the CompassSigil animates its
 * opacity in an infinite pulse, so a whole-subtree opacity check would never
 * settle. The sigil holds no text and is never an ancestor of a text node, so it
 * cannot change a text element's effective opacity. Transform does not influence
 * axe's contrast calculation, so it is not waited on.
 */
async function waitForSenecaPanelSettled(page: Page): Promise<void> {
  const panel = page.locator('[role="dialog"][aria-label="Seneca conversation"]');
  try {
    await panel.first().waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // The panel never opened for this route -- nothing to settle.
    return;
  }
  await page.waitForFunction(
    () => {
      const root = document.querySelector('[role="dialog"][aria-label="Seneca conversation"]');
      if (!root) return true;
      const effectiveOpacity = (node: Element): number => {
        let opacity = 1;
        for (
          let current: Element | null = node;
          current && current !== root.parentElement;
          current = current.parentElement
        ) {
          opacity *= Number(getComputedStyle(current).opacity || '1');
        }
        return opacity;
      };
      const hasVisibleText = (node: Element): boolean =>
        Array.from(node.childNodes).some(
          (child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '',
        );
      return [root, ...root.querySelectorAll('*')]
        .filter(hasVisibleText)
        .every((node) => effectiveOpacity(node) >= 1);
    },
    undefined,
    { timeout: 10_000 },
  );
}

test.describe('Critical public accessibility', () => {
  for (const { name, path } of CRITICAL_PAGES) {
    test(`${name} has no critical or serious accessibility violations`, async ({ page }) => {
      test.setTimeout(60_000);

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

      // The Seneca panel auto-opens here and fades in; scanning mid-fade produces
      // false color-contrast violations. Wait for it to settle before scanning.
      await waitForSenecaPanelSettled(page);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('a[href="#main-content"]')
        .exclude('.recharts-wrapper')
        .analyze();

      const critical = results.violations.filter(
        (violation: Result) => violation.impact === 'critical',
      );
      const serious = results.violations.filter(
        (violation: Result) => violation.impact === 'serious',
      );

      expect(critical, `Critical violations on ${name}`).toHaveLength(0);
      expect(serious, `Serious violations on ${name}`).toHaveLength(0);
    });
  }
});
