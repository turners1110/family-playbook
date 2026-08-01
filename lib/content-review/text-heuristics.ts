/**
 * Deterministic text heuristics for content-review flags.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

/** Jaccard similarity on token sets (0–1). */
export function jaccardSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function looksTooBroad(text: string): boolean {
  const t = normalize(text);
  if (t.length < 40) return false;
  return (
    /\b(everything|in general|overall|how do we feel about|what do we think about parenting)\b/.test(
      t,
    ) || (tokenize(t).length <= 6 && /\b(parenting|values|philosophy)\b/.test(t))
  );
}

export function looksTooNarrow(text: string): boolean {
  const t = normalize(text);
  return (
    /\b(exactly|specific brand|which store|which aisle|exact minute)\b/.test(t) ||
    (tokenize(t).length >= 28 && /\bonly\b/.test(t))
  );
}

export function combinesSeveralDecisions(text: string): boolean {
  const t = normalize(text);
  const andCount = (t.match(/\band\b/g) || []).length;
  const orCount = (t.match(/\bor\b/g) || []).length;
  return andCount >= 2 || (andCount >= 1 && orCount >= 1) || /\b(also|as well as|plus)\b/.test(t);
}

export function unclearWording(text: string): boolean {
  const t = normalize(text);
  return (
    /\b(stuff|things|somehow|etc|appropriate|properly|good enough)\b/.test(t) ||
    /\?\?/.test(text) ||
    t.endsWith(" or")
  );
}

export function biasedWording(text: string): boolean {
  const t = normalize(text);
  return /\b(obviously|clearly we should|everyone knows|real parents|the right way|you should|must we)\b/.test(
    t,
  );
}

export function philosophicalNotPractical(text: string, type: string): boolean {
  const t = normalize(text);
  if (type === "practical_planning") return false;
  return /\b(meaning of|philosophy|worldview|identity as parents|what kind of parents)\b/.test(
    t,
  );
}

export function practicalShouldBeTask(text: string, type: string): boolean {
  const t = normalize(text);
  return (
    type === "practical_planning" ||
    /\b(pack|buy|install|schedule|register|choose a pediatrician|get a car seat)\b/.test(
      t,
    )
  );
}
