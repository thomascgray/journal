import { type Token, type Tokens, lexer } from 'marked';
import { memo, type ReactNode, useMemo } from 'react';
import { Linking, Text, View } from 'react-native';

// Renders Markdown to native views. marked only parses here; nothing goes through HTML.
// Raw HTML and images in the source show as plain text.

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-2xl font-semibold',
  2: 'text-xl font-semibold',
  3: 'text-lg font-semibold',
};

export const Markdown = memo(function Markdown({ source }: { source: string }) {
  const tokens = useMemo(() => lexer(source, { gfm: true, breaks: true }), [source]);
  return <View className="gap-3">{renderBlocks(tokens)}</View>;
});

function renderBlocks(tokens: Token[]): ReactNode[] {
  return tokens.flatMap((token, i) => {
    const block = renderBlock(token, i);
    return block === null ? [] : [block];
  });
}

function renderBlock(token: Token, key: number): ReactNode {
  switch (token.type) {
    case 'space':
    // A task item's checkbox. List draws its own marker from item.checked.
    case 'checkbox':
      return null;
    case 'heading': {
      const { depth, tokens } = token as Tokens.Heading;
      return (
        <Text
          key={key}
          className={`text-slate-900 ${HEADING_CLASSES[depth] ?? 'text-base font-semibold'}`}
        >
          {renderInline(tokens)}
        </Text>
      );
    }
    case 'paragraph':
      return (
        <Text key={key} className="text-base leading-6 text-slate-800">
          {renderInline((token as Tokens.Paragraph).tokens)}
        </Text>
      );
    case 'text': {
      // Block-level text appears inside tight list items.
      const { tokens, text } = token as Tokens.Text;
      return (
        <Text key={key} className="text-base leading-6 text-slate-800">
          {tokens ? renderInline(tokens) : text}
        </Text>
      );
    }
    case 'list':
      return <List key={key} list={token as Tokens.List} />;
    case 'blockquote':
      return (
        <View key={key} className="gap-2 border-l-4 border-slate-200 pl-3">
          {renderBlocks((token as Tokens.Blockquote).tokens)}
        </View>
      );
    case 'code':
      return (
        <View key={key} className="rounded-lg bg-slate-100 p-3">
          <Text className="font-mono text-sm text-slate-800">{(token as Tokens.Code).text}</Text>
        </View>
      );
    case 'hr':
      return <View key={key} className="h-px bg-slate-200" />;
    default:
      return (
        <Text key={key} className="text-base leading-6 text-slate-800">
          {token.raw.trim()}
        </Text>
      );
  }
}

function List({ list }: { list: Tokens.List }) {
  const start = typeof list.start === 'number' ? list.start : 1;
  return (
    <View className="gap-1">
      {list.items.map((item, i) => {
        const marker = item.task
          ? item.checked
            ? '☑'
            : '☐'
          : list.ordered
            ? `${start + i}.`
            : '•';
        return (
          <View key={i} className="flex-row gap-2">
            <Text className="min-w-4 text-base leading-6 text-slate-500">{marker}</Text>
            <View className="flex-1 gap-1">{renderBlocks(item.tokens)}</View>
          </View>
        );
      })}
    </View>
  );
}

function renderInline(tokens: Token[]): ReactNode[] {
  return tokens.map((token, key) => {
    switch (token.type) {
      case 'strong':
        return (
          <Text key={key} className="font-bold">
            {renderInline((token as Tokens.Strong).tokens)}
          </Text>
        );
      case 'em':
        return (
          <Text key={key} className="italic">
            {renderInline((token as Tokens.Em).tokens)}
          </Text>
        );
      case 'del':
        return (
          <Text key={key} className="line-through">
            {renderInline((token as Tokens.Del).tokens)}
          </Text>
        );
      case 'codespan':
        return (
          <Text key={key} className="bg-slate-100 font-mono text-sm">
            {(token as Tokens.Codespan).text}
          </Text>
        );
      case 'link': {
        const { href, tokens } = token as Tokens.Link;
        return (
          <Text
            key={key}
            className="text-sky-700 underline"
            onPress={() => Linking.openURL(href).catch(() => {})}
          >
            {renderInline(tokens)}
          </Text>
        );
      }
      case 'br':
        return '\n';
      case 'text': {
        const text = token as Tokens.Text;
        return text.tokens ? <Text key={key}>{renderInline(text.tokens)}</Text> : text.text;
      }
      case 'escape':
        return (token as Tokens.Escape).text;
      default:
        return token.raw;
    }
  });
}
