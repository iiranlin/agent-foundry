import { parseMarkdownBlocks } from './MarkdownBlocks';

type InlineToken = {
  text: string;
  type: 'text' | 'code' | 'strong';
};

const parseInlineTokens = (text: string) => {
  const tokens: InlineToken[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/gu;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: text.slice(lastIndex, match.index),
      });
    }

    const [rawToken] = match;

    if (rawToken.startsWith('`')) {
      tokens.push({
        type: 'code',
        text: rawToken.slice(1, -1),
      });
    } else {
      tokens.push({
        type: 'strong',
        text: rawToken.slice(2, -2),
      });
    }

    lastIndex = match.index + rawToken.length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      text: text.slice(lastIndex),
    });
  }

  return tokens;
};

const InlineMarkdown = (props: { text: string }) => (
  <>
    {parseInlineTokens(props.text).map((token, index) => {
      const key = `${token.type}-${index}`;

      if (token.type === 'code') {
        return (
          <code
            className="rounded-sm bg-slate-200 px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere] break-words"
            key={key}
          >
            {token.text}
          </code>
        );
      }

      if (token.type === 'strong') {
        return (
          <strong className="font-semibold text-slate-950" key={key}>
            {token.text}
          </strong>
        );
      }

      return <span key={key}>{token.text}</span>;
    })}
  </>
);

export const MarkdownMessage = (props: { content: string; thoughtLabel: string }) => {
  const blocks = parseMarkdownBlocks(props.content);

  return (
    <div className="space-y-3 text-sm leading-6 [overflow-wrap:anywhere] break-words text-slate-800">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === 'heading') {
          const className =
            block.level === 1
              ? 'break-words text-lg font-semibold text-slate-950'
              : 'break-words text-base font-semibold text-slate-950';

          return (
            <h3 className={className} key={key}>
              <InlineMarkdown text={block.text} />
            </h3>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          const className = block.ordered
            ? 'list-decimal space-y-1 pl-5 break-words'
            : 'list-disc space-y-1 pl-5 break-words';

          return (
            <ListTag className={className} key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'code') {
          return (
            <pre
              className="max-w-full overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-slate-100"
              key={key}
            >
              {block.code}
            </pre>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              className="border-l-2 border-blue-400 pl-3 break-words text-slate-600"
              key={key}
            >
              <InlineMarkdown text={block.text} />
            </blockquote>
          );
        }

        if (block.type === 'thought') {
          return (
            <details
              className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-slate-700"
              key={key}
            >
              <summary className="cursor-pointer text-xs font-semibold text-amber-800">
                {props.thoughtLabel}
              </summary>
              <pre className="mt-2 overflow-auto font-mono text-xs leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                {block.text}
              </pre>
            </details>
          );
        }

        if (block.type === 'divider') {
          return <hr className="border-slate-200" key={key} />;
        }

        return (
          <p className="break-words" key={key}>
            <InlineMarkdown text={block.text} />
          </p>
        );
      })}
    </div>
  );
};
