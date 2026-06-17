import { describe, expect, it } from 'vitest';

describe('Logger', () => {
  describe('Configuration', () => {
    it('reconfigures during module reloads', async () => {
      const firstLoggerModule = './Logger.ts?first-reload';
      const secondLoggerModule = './Logger.ts?second-reload';

      await import(firstLoggerModule);

      await expect(import(secondLoggerModule)).resolves.toHaveProperty('logger');
    });
  });
});
