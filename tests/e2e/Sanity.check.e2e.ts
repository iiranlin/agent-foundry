import { expect, test } from '@playwright/test';

// Checkly is a tool used to monitor deployed environments, such as production or preview environments.
// It runs end-to-end tests with the `.check.e2e.ts` extension after each deployment to ensure that the environment is up and running.
// With Checkly, you can monitor your production environment and run `*.check.e2e.ts` tests regularly at a frequency of your choice.
// If the tests fail, Checkly will notify you via email, Slack, or other channels of your choice.
// On the other hand, E2E tests ending with `*.e2e.ts` are only run before deployment.
// You can run them locally or on CI to ensure that the application is ready for deployment.

test.describe('Sanity', () => {
  test.describe('Static pages', () => {
    test('should display the homepage', async ({ page }) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', {
          name: 'Agent 工坊',
        }),
      ).toBeVisible();
    });

    test('should navigate to the about page', async ({ page }) => {
      await page.goto('/about');

      await expect(page.getByText('欢迎来到关于页面', { exact: false })).toBeVisible();
    });

    test('should navigate to the portfolio page', async ({ page }) => {
      await page.goto('/portfolio');

      await expect(page.locator('main').getByRole('link', { name: /^作品集/u })).toHaveCount(6);
    });
  });
});
