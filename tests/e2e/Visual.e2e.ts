import { expect, takeSnapshot, test } from '@chromatic-com/playwright';

test.describe('Visual testing', () => {
  test.describe('Static pages', () => {
    test('should take screenshot of the homepage', async ({ page }, testInfo) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', {
          name: 'Agent 工坊',
        }),
      ).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the portfolio page', async ({ page }, testInfo) => {
      await page.goto('/portfolio');

      await expect(page.getByText('欢迎访问我的作品集页面！')).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the about page', async ({ page }, testInfo) => {
      await page.goto('/about');

      await expect(page.getByText('欢迎来到关于页面！')).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the portfolio details page', async ({ page }, testInfo) => {
      await page.goto('/portfolio/2');

      await expect(page.getByText('为企业活动创建了一组宣传材料')).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the English homepage', async ({ page }, testInfo) => {
      await page.goto('/en');

      await expect(
        page.getByRole('heading', {
          name: 'Agent foundry',
        }),
      ).toBeVisible();

      await takeSnapshot(page, testInfo);
    });
  });
});
