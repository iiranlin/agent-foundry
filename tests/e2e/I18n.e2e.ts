import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test.describe('Language Switching', () => {
    test('switches language from Chinese to English using dropdown', async ({ page }) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', {
          name: 'Agent 工坊',
        }),
      ).toBeVisible();

      await page.getByLabel('切换语言').selectOption('en');

      await expect(
        page.getByRole('heading', {
          name: 'Agent foundry',
        }),
      ).toBeVisible();
    });

    test('loads English using URL prefix on the sign-in page', async ({ page }) => {
      await page.goto('/en/sign-in');

      await expect(page.getByText('Email address')).toBeVisible();
    });
  });
});
