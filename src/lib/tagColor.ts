export type TagColors = {
  background: string;
  text: string;
  dot: string;
};

/**
 * Colours derived from the tag's name, so a tag looks the same everywhere without storing a
 * colour. Lowercased first because names are unique ignoring case. FNV-1a spreads similar
 * names ("trip", "trips") across different hues.
 */
export function tagColors(name: string): TagColors {
  let hash = 0x811c9dc5;
  for (const char of name.toLowerCase()) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  const hue = (hash >>> 0) % 360;
  return {
    background: `hsl(${hue}, 75%, 92%)`,
    text: `hsl(${hue}, 55%, 28%)`,
    dot: `hsl(${hue}, 65%, 50%)`,
  };
}
