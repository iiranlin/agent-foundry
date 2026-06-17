type AgentSourceInput = {
  content: string;
  label: string;
  type: string;
  url?: string | null;
};

type SkillTrainingResult = {
  content: string;
  summary: string;
  title: string;
};

const MAX_SKILL_CHARS = 8000;
const MAX_SUMMARY_CHARS = 420;

const normalizeWhitespace = (value: string) => value.replaceAll(/\s+/gu, ' ').trim();

const extractHeadings = (content: string) =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'))
    .map((line) => line.replace(/^#+\s*/u, '').trim())
    .filter(Boolean)
    .slice(0, 6);

const extractKeywords = (content: string) => {
  const words = normalizeWhitespace(content)
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word.length > 3);

  const counts = new Map<string, number>();

  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .map(([word]) => word)
    .slice(0, 12);
};

const summarize = (content: string) => {
  const normalized = normalizeWhitespace(content);

  if (normalized.length <= MAX_SUMMARY_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_SUMMARY_CHARS - 1).trim()}...`;
};

export const trainSkillFromSources = (sources: AgentSourceInput[]): SkillTrainingResult => {
  const usableSources = sources.filter((source) => source.content.trim() || source.url?.trim());

  if (usableSources.length === 0) {
    return {
      title: 'Untitled skill',
      summary: 'No usable training content was provided.',
      content: [
        '# Untitled skill',
        '',
        '## Scope',
        'No usable training content was provided.',
        '',
        '## Operating notes',
        'Ask the user to add text files, markdown, GitHub references, or third-party URLs before answering domain questions.',
      ].join('\n'),
    };
  }

  const combinedContent = usableSources
    .map((source) => {
      const sourceUrl = source.url ? `\nURL: ${source.url}` : '';
      return `Source: ${source.label || source.type}${sourceUrl}\n${source.content.trim()}`;
    })
    .join('\n\n---\n\n');
  const headings = usableSources.flatMap((source) => extractHeadings(source.content));
  const keywords = extractKeywords(combinedContent);
  const [firstSource] = usableSources;
  const title = headings[0] ?? firstSource?.label ?? 'Generated skill';
  const summary = summarize(combinedContent);
  const sourceLines = usableSources.map((source) => {
    const url = source.url ? ` (${source.url})` : '';
    return `- ${source.label || source.type}${url}`;
  });
  const thoughtLines = [
    `Collected ${usableSources.length} context source${usableSources.length === 1 ? '' : 's'}.`,
    'Treat the uploaded data as the Agent context, not as a separate hidden knowledge base.',
    'Use headings, recurring keywords, and source inventory only to make the context easier to inspect.',
  ];
  const content = [
    `# ${title}`,
    '',
    '```thinking',
    thoughtLines.join('\n'),
    '```',
    '',
    '## Scope',
    summary,
    '',
    '## Source inventory',
    ...sourceLines,
    '',
    '## Key topics',
    keywords.length > 0
      ? keywords.map((keyword) => `- ${keyword}`).join('\n')
      : '- No recurring topics detected',
    '',
    '## Answering guidance',
    'Use the source excerpts below as the primary context. If the requested fact is not present, say that the current agent does not contain enough training data.',
    '',
    '## Source excerpts',
    combinedContent.slice(0, MAX_SKILL_CHARS),
  ].join('\n');

  return {
    title,
    summary,
    content,
  };
};

export const answerFromSkill = (options: {
  question: string;
  skillContent: string;
  skillSummary: string;
}) => {
  const normalizedQuestion = normalizeWhitespace(options.question);
  const questionTerms = extractKeywords(normalizedQuestion);
  const paragraphs = options.skillContent
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 40);
  const rankedParagraphs = paragraphs
    .map((paragraph) => ({
      paragraph,
      score: questionTerms.filter((term) => paragraph.toLowerCase().includes(term)).length,
    }))
    .filter((item) => item.score > 0)
    .toSorted((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.paragraph);

  if (rankedParagraphs.length === 0) {
    return [
      '当前 Agent 的训练数据里没有足够信息直接回答这个问题。',
      '',
      `已训练摘要：${options.skillSummary}`,
    ].join('\n');
  }

  return ['基于当前 Agent 的训练内容，可以这样回答：', '', rankedParagraphs.join('\n\n')].join(
    '\n',
  );
};
