import { memo, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

// A multiline input that styles its own Markdown as you type. The text stays the raw source,
// markers included; the markers are dimmed and the text they wrap is styled. TextInput draws
// Text children as spans, so the children must spell out exactly the input's text.

type Segment = { text: string; className?: string };

const MARKER = 'text-slate-300';
const HEADING_CLASSES: Record<number, string> = {
  1: 'text-2xl leading-8 font-semibold text-slate-900',
  2: 'text-xl leading-7 font-semibold text-slate-900',
  3: 'text-lg leading-7 font-semibold text-slate-900',
};
const DEFAULT_HEADING = 'font-semibold text-slate-900';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  placeholderTextColor: string;
  className?: string;
  /** In px, for heights that depend on the screen size. */
  minHeight?: number;
};

export function MarkdownInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  className,
  minHeight,
}: Props) {
  const [focused, setFocused] = useState(false);
  // React Native measures the input's height from the text twice per keystroke: once as the
  // native side has it, without our spans, and again with them. A heading's taller lines make
  // the two disagree, so the box jumped on every key. A fixed height skips that measuring; the
  // EditText's own laid-out content height, which does include the spans, sets it instead.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const height =
    contentHeight === null ? undefined : Math.max(minHeight ?? 0, Math.ceil(contentHeight));

  return (
    <View>
      <TextInput
        onChangeText={onChangeText}
        onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        multiline
        textAlignVertical="top"
        className={`p-0 text-base leading-6 text-slate-800 ${className ?? ''}`}
        style={{ minHeight, height }}
      >
        {value !== '' && <Highlighted source={value} />}
      </TextInput>
      {focused && (
        <Text className="mt-2 text-xs text-slate-400">
          Markdown: **bold**, _italic_, # heading, - list, [link](https://…)
        </Text>
      )}
    </View>
  );
}

const Highlighted = memo(function Highlighted({ source }: { source: string }) {
  const segments = useMemo(() => highlight(source), [source]);
  return segments.map((segment, i) =>
    segment.className ? (
      <Text key={i} className={segment.className}>
        {segment.text}
      </Text>
    ) : (
      segment.text
    ),
  );
});

/** Splits the source into styled runs. Joining every run's text gives back the source exactly. */
export function highlight(source: string): Segment[] {
  const out: Segment[] = [];
  let inFence = false;

  source.split('\n').forEach((line, i) => {
    if (i > 0) out.push({ text: '\n' });
    if (line === '') return;

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push({ text: line, className: `font-mono text-sm ${MARKER}` });
      return;
    }
    if (inFence) {
      out.push({ text: line, className: 'font-mono text-sm text-slate-700' });
      return;
    }

    const heading = /^(#{1,6})(\s+)(.*)$/.exec(line);
    if (heading) {
      const [, hashes, space, rest] = heading;
      const style = HEADING_CLASSES[hashes.length] ?? DEFAULT_HEADING;
      out.push({ text: hashes + space, className: combine(style, MARKER) });
      out.push(...inline(rest, style));
      return;
    }

    if (/^ {0,3}([-*_])( *\1){2,} *$/.test(line)) {
      out.push({ text: line, className: MARKER });
      return;
    }

    const quote = /^(\s*>\s?)(.*)$/.exec(line);
    if (quote) {
      out.push({ text: quote[1], className: 'font-bold text-slate-300' });
      out.push(...inline(quote[2], 'italic text-slate-600'));
      return;
    }

    const list = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s)?(.*)$/.exec(line);
    if (list) {
      const [, indent, bullet, space, task = '', rest] = list;
      out.push({ text: indent + bullet + space, className: 'font-bold text-slate-400' });
      if (task) out.push({ text: task, className: 'font-mono text-sky-600' });
      out.push(...inline(rest, task && task[1] !== ' ' ? 'line-through text-slate-400' : ''));
      return;
    }

    out.push(...inline(line, ''));
  });

  return merge(out);
}

// Groups: 1-2 code, 3 bold (**), 4 bold (__), 5 strikethrough, 6 italic (*), 7 italic (_),
// 8-9 link text and URL.
const INLINE =
  /(`+)(.+?)\1|\*\*(?=\S)(.*?\S)\*\*|__(?=\S)(.*?\S)__|~~(?=\S)(.*?\S)~~|\*(?=[^\s*])(.*?[^\s*])\*|_(?=[^\s_])(.*?[^\s_])_|\[([^\]]+)\]\(([^)\s]+)\)/g;

function inline(text: string, base: string): Segment[] {
  const out: Segment[] = [];
  const style = (extra: string) => combine(base, extra);
  const plain = (s: string) => s !== '' && out.push({ text: s, className: base || undefined });
  const wrap = (marker: string, inner: string, extra: string) => {
    out.push({ text: marker, className: style(MARKER) });
    out.push(...inline(inner, style(extra)));
    out.push({ text: marker, className: style(MARKER) });
  };

  const re = new RegExp(INLINE.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    // Like marked, an underscore inside a word (snake_case) is not emphasis.
    if (m[7] !== undefined && /\w/.test(text[m.index - 1] ?? '')) {
      re.lastIndex = m.index + 1;
      continue;
    }
    plain(text.slice(last, m.index));
    last = m.index + m[0].length;

    if (m[1] !== undefined) {
      out.push({ text: m[1], className: style(MARKER) });
      // No text-sm here: inside a heading it would fight the heading's size.
      out.push({ text: m[2], className: style('font-mono bg-slate-100') });
      out.push({ text: m[1], className: style(MARKER) });
    } else if (m[3] !== undefined) wrap('**', m[3], 'font-bold');
    else if (m[4] !== undefined) wrap('__', m[4], 'font-bold');
    else if (m[5] !== undefined) wrap('~~', m[5], 'line-through');
    else if (m[6] !== undefined) wrap('*', m[6], 'italic');
    else if (m[7] !== undefined) wrap('_', m[7], 'italic');
    else {
      out.push({ text: '[', className: style(MARKER) });
      out.push(...inline(m[8], style('text-sky-700 underline')));
      out.push({ text: `](${m[9]})`, className: style(MARKER) });
    }
  }
  plain(text.slice(last));
  return out;
}

const COLOR = /^text-(slate|sky)-\d+$/;

// Tailwind settles two text colours by stylesheet order, not class order, so a dimmed marker
// inside a heading could come out dark. An added colour replaces the base one instead.
function combine(base: string, extra: string): string {
  const added = extra.split(' ').filter(Boolean);
  const replacesColor = added.some((c) => COLOR.test(c));
  const kept = base.split(' ').filter((c) => c && !(replacesColor && COLOR.test(c)));
  return [...kept, ...added].join(' ');
}

// Fewer spans means less work for the native text layout on every keystroke.
function merge(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const segment of segments) {
    const prev = out[out.length - 1];
    if (prev && prev.className === segment.className) prev.text += segment.text;
    else out.push({ ...segment });
  }
  return out;
}
