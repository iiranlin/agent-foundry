import { describe, expect, it } from 'vitest';
import { parseMarkdownBlocks } from './MarkdownBlocks';

describe('MarkdownBlocks', () => {
  describe('Parser', () => {
    it('parses headings lists and code blocks', () => {
      const blocks = parseMarkdownBlocks(
        [
          '## Plan',
          '',
          '- Train data',
          '- Answer questions',
          '',
          '```ts',
          'const ok = true;',
          '```',
        ].join('\n'),
      );

      expect(blocks).toStrictEqual([
        { type: 'heading', level: 2, text: 'Plan' },
        { type: 'list', ordered: false, items: ['Train data', 'Answer questions'] },
        { type: 'code', language: 'ts', code: 'const ok = true;' },
      ]);
    });

    it('parses paragraphs and quotes', () => {
      const blocks = parseMarkdownBlocks('First line\nsecond line\n\n> Important');

      expect(blocks).toStrictEqual([
        { type: 'paragraph', text: 'First line second line' },
        { type: 'quote', text: 'Important' },
      ]);
    });

    it('parses expandable thought blocks', () => {
      const blocks = parseMarkdownBlocks(
        [
          '<thinking>',
          'I need to inspect the source first.',
          '</thinking>',
          '',
          'Answer.',
          '',
          '```reasoning',
          'Second thought.',
          '```',
        ].join('\n'),
      );

      expect(blocks).toStrictEqual([
        { type: 'thought', text: 'I need to inspect the source first.' },
        { type: 'paragraph', text: 'Answer.' },
        { type: 'thought', text: 'Second thought.' },
      ]);
    });
  });
});
