import { describe, expect, it } from 'vitest';
import { answerFromSkill, trainSkillFromSources } from './SkillTrainer';

describe('SkillTrainer', () => {
  describe('Training extraction', () => {
    it('extracts skill content from markdown sources', () => {
      const skill = trainSkillFromSources([
        {
          type: 'markdown',
          label: 'Product notes',
          content: '# Billing agent\n\nThe agent answers usage, invoice, and payment questions.',
        },
      ]);

      expect(skill.title).toBe('Billing agent');
      expect(skill.content).toContain('Product notes');
      expect(skill.content).toContain('invoice');
      expect(skill.content).toContain('```thinking');
    });

    it('keeps URL references in the source inventory', () => {
      const skill = trainSkillFromSources([
        {
          type: 'github',
          label: 'GitHub repository',
          url: 'https://github.com/acme/docs',
          content: 'Repository contains integration guides for MCP connectors.',
        },
      ]);

      expect(skill.content).toContain('https://github.com/acme/docs');
      expect(skill.summary).toContain('MCP connectors');
    });
  });

  describe('Answer retrieval', () => {
    it('answers from matching skill paragraphs', () => {
      const answer = answerFromSkill({
        question: 'How does the invoice workflow behave?',
        skillSummary: 'Billing workflow notes.',
        skillContent:
          'The invoice workflow creates a draft invoice before payment collection.\n\nMCP setup requires a connector URL.',
      });

      expect(answer).toContain('draft invoice');
    });
  });
});
