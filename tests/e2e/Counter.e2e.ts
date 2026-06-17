import assert from 'node:assert';
import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';

test.describe('Counter', () => {
  test.describe('Increment operation', () => {
    test('should display error message when incrementing with negative number', async ({
      page,
    }) => {
      await page.goto('/counter');

      const count = page.getByText('计数：');
      const countText = await count.textContent();

      assert.ok(countText !== null, 'Count should not be null');

      await page.getByLabel('递增数值').fill('-1');
      await page.getByRole('button', { name: '递增' }).click();

      await expect(page.getByText('数值必须在 1 到 3 之间')).toBeVisible();
      await expect(page.getByText('计数：')).toHaveText(countText);
    });

    test('should increment the counter and validate the count', async ({ page }) => {
      // `x-e2e-random-id` is used for end-to-end testing to make isolated requests
      // The default value is 0 when there is no `x-e2e-random-id` header
      const e2eRandomId = faker.number.int({ max: 1_000_000 });
      await page.setExtraHTTPHeaders({
        'x-e2e-random-id': e2eRandomId.toString(),
      });
      await page.goto('/counter');

      const count = page.getByText('计数：');
      const countText = await count.textContent();

      assert.ok(countText !== null, 'Count should not be null');

      const countNumber = Number(countText.split('：')[1]);

      await page.getByLabel('递增数值').fill('2');
      await page.getByRole('button', { name: '递增' }).isEnabled();
      await page.getByRole('button', { name: '递增' }).click();

      await expect(page.getByText('计数：')).toHaveText(`计数：${countNumber + 2}`);

      await page.getByLabel('递增数值').fill('3');
      await page.getByRole('button', { name: '递增' }).isEnabled();
      await page.getByRole('button', { name: '递增' }).click();

      await expect(page.getByText('计数：')).toHaveText(`计数：${countNumber + 5}`);
    });
  });
});
