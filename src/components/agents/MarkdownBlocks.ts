export type MarkdownBlock =
  | {
      level: 1 | 2 | 3;
      text: string;
      type: 'heading';
    }
  | {
      text: string;
      type: 'paragraph';
    }
  | {
      items: string[];
      ordered: boolean;
      type: 'list';
    }
  | {
      code: string;
      language: string;
      type: 'code';
    }
  | {
      text: string;
      type: 'quote';
    }
  | {
      text: string;
      type: 'thought';
    }
  | {
      type: 'divider';
    };

const headingPattern = /^(#{1,3})\s+(.+)$/u;
const orderedListPattern = /^\d+\.\s+(.+)$/u;
const unorderedListPattern = /^[-*]\s+(.+)$/u;
const thoughtOpenPattern = /^<(thinking|thought)>$/iu;
const thoughtClosePattern = /^<\/(thinking|thought)>$/iu;
const thoughtFenceLanguages = new Set(['reasoning', 'thought', 'thinking']);

const flushParagraph = (options: { blocks: MarkdownBlock[]; lines: string[] }) => {
  if (options.lines.length === 0) {
    return;
  }

  options.blocks.push({
    type: 'paragraph',
    text: options.lines.join(' '),
  });
  options.lines.length = 0;
};

const normalizeHeadingLevel = (level: number): 1 | 2 | 3 => {
  if (level <= 1) {
    return 1;
  }

  if (level === 2) {
    return 2;
  }

  return 3;
};

// eslint-disable-next-line complexity
export const parseMarkdownBlocks = (content: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  const lines = content.split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph({ blocks, lines: paragraphLines });
      index += 1;
      continue;
    }

    if (trimmedLine.startsWith('```')) {
      flushParagraph({ blocks, lines: paragraphLines });
      const language = trimmedLine.replace(/^```/u, '').trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index]?.trim().startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }

      if (thoughtFenceLanguages.has(language.toLowerCase())) {
        blocks.push({
          type: 'thought',
          text: codeLines.join('\n'),
        });
      } else {
        blocks.push({
          type: 'code',
          language,
          code: codeLines.join('\n'),
        });
      }

      index += 1;
      continue;
    }

    if (thoughtOpenPattern.test(trimmedLine)) {
      flushParagraph({ blocks, lines: paragraphLines });
      const thoughtLines: string[] = [];
      index += 1;

      while (index < lines.length && !thoughtClosePattern.test(lines[index]?.trim() ?? '')) {
        thoughtLines.push(lines[index] ?? '');
        index += 1;
      }

      blocks.push({
        type: 'thought',
        text: thoughtLines.join('\n').trim(),
      });
      index += 1;
      continue;
    }

    if (/^---+$/u.test(trimmedLine)) {
      flushParagraph({ blocks, lines: paragraphLines });
      blocks.push({ type: 'divider' });
      index += 1;
      continue;
    }

    const heading = headingPattern.exec(trimmedLine);

    if (heading) {
      flushParagraph({ blocks, lines: paragraphLines });
      blocks.push({
        type: 'heading',
        level: normalizeHeadingLevel(heading[1]?.length ?? 1),
        text: heading[2] ?? '',
      });
      index += 1;
      continue;
    }

    if (trimmedLine.startsWith('> ')) {
      flushParagraph({ blocks, lines: paragraphLines });
      blocks.push({
        type: 'quote',
        text: trimmedLine.replace(/^>\s*/u, ''),
      });
      index += 1;
      continue;
    }

    const unorderedList = unorderedListPattern.exec(trimmedLine);
    const orderedList = orderedListPattern.exec(trimmedLine);

    if (unorderedList || orderedList) {
      flushParagraph({ blocks, lines: paragraphLines });
      const ordered = Boolean(orderedList);
      const items: string[] = [];

      while (index < lines.length) {
        const candidateLine = lines[index]?.trim() ?? '';
        const candidate = ordered
          ? orderedListPattern.exec(candidateLine)
          : unorderedListPattern.exec(candidateLine);

        if (!candidate) {
          break;
        }

        items.push(candidate[1] ?? '');
        index += 1;
      }

      blocks.push({
        type: 'list',
        ordered,
        items,
      });
      continue;
    }

    paragraphLines.push(trimmedLine);
    index += 1;
  }

  flushParagraph({ blocks, lines: paragraphLines });

  return blocks;
};
