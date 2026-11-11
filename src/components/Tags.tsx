import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { cleanTagName, type Tag, type TagUsage } from '@/db/tags';
import { tagColors } from '@/lib/tagColor';

const MAX_SUGGESTIONS = 8;
// slate-400, matching the day screen's other placeholders.
const PLACEHOLDER_COLOR = '#94a3b8';

export function TagChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  const colors = tagColors(name);
  return (
    <View
      style={{ backgroundColor: colors.background }}
      className="flex-row items-center rounded-full py-1 pl-3 pr-3"
    >
      <Text style={{ color: colors.text }} className="text-sm font-medium">
        {name}
      </Text>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove tag ${name}`}
          hitSlop={8}
          className="-mr-1 ml-1.5"
        >
          <Text style={{ color: colors.text }} className="text-sm opacity-60">
            ✕
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** A row of tags to read in the journal. Renders nothing when there are none. */
export function TagList({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {tags.map((tag) => (
        <TagChip key={tag.id} name={tag.name} />
      ))}
    </View>
  );
}

type EditorProps = {
  tags: Tag[];
  allTags: TagUsage[];
  onAdd: (name: string) => void;
  onRemove: (tag: Tag) => void;
};

/**
 * The day's tags, each removable, and an "Add tag" button that opens a field. Typing filters the
 * existing tags; submitting a name nothing matches creates a new tag. The field stays open after
 * adding so several tags can go on in a row.
 */
export function TagEditor({ tags, allTags, onAdd, onRemove }: EditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const onDay = new Set(tags.map((tag) => tag.id));
  const clean = cleanTagName(draft);
  const needle = clean.toLowerCase();
  const exact = allTags.find((tag) => tag.name.toLowerCase() === needle);
  const suggestions = allTags
    .filter((tag) => !onDay.has(tag.id) && tag.name.toLowerCase().includes(needle))
    .slice(0, MAX_SUGGESTIONS);

  const add = (name: string) => {
    if (cleanTagName(name) !== '') onAdd(name);
    setDraft('');
  };

  return (
    <View className="mb-3 gap-2">
      <View className="flex-row flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <TagChip key={tag.id} name={tag.name} onRemove={() => onRemove(tag)} />
        ))}
        {adding ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => add(draft)}
            onBlur={() => {
              setDraft('');
              setAdding(false);
            }}
            submitBehavior="submit"
            autoFocus
            autoCapitalize="none"
            returnKeyType="done"
            placeholder="Tag name"
            placeholderTextColor={PLACEHOLDER_COLOR}
            className="min-w-28 rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-900"
          />
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            className="rounded-full border border-dashed border-slate-300 px-3 py-1 active:bg-slate-100"
          >
            <Text className="text-sm text-slate-500">+ Add tag</Text>
          </Pressable>
        )}
      </View>

      {adding && (suggestions.length > 0 || (clean !== '' && !exact)) && (
        <View className="flex-row flex-wrap gap-1.5">
          {clean !== '' && !exact && (
            <Pressable
              onPress={() => add(clean)}
              accessibilityRole="button"
              className="rounded-full bg-slate-900 px-3 py-1 active:opacity-80"
            >
              <Text className="text-sm font-medium text-white">{`Create "${clean}"`}</Text>
            </Pressable>
          )}
          {suggestions.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => add(tag.name)}
              accessibilityRole="button"
              accessibilityLabel={`Add tag ${tag.name}`}
              className="active:opacity-70"
            >
              <TagChip name={tag.name} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
