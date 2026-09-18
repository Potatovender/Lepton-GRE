/** Read-only syntax cache. Never stores coordinate, time, scope or evaluation results. */
export function createAstCache({ maxEntries = 256, maxCharacters = 512_000 } = {}) {
  const entries = new Map();
  let characters = 0;
  return (key, parse) => {
    const cached = entries.get(key);
    if (cached) { entries.delete(key); entries.set(key, cached); return cached; }
    const result = parse();
    if (key.length > maxCharacters / 4) return result;
    const pending = [result];
    while (pending.length) {
      const node = pending.pop();
      if (!node || typeof node !== "object" || Object.isFrozen(node)) continue;
      pending.push(...Object.values(node)); Object.freeze(node);
    }
    entries.set(key, result); characters += key.length;
    while (entries.size > maxEntries || characters > maxCharacters) {
      const first = entries.keys().next().value;
      characters -= first.length; entries.delete(first);
    }
    return result;
  };
}
