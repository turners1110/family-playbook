/**
 * Extract concrete themes from family answers for playbook-quality principles.
 */
export type ExtractedAnswerThemes = {
  ages: string[];
  numbers: string[];
  rules: string[];
  choices: string[];
  /** Short distinctive phrases (not stopwords). */
  phrases: string[];
  specificity: number; // 0–10
};

const STOP = new Set(
  "a an the and or but we our us to of in on for with as is are be will would should can our family child children baby parents parent sam michelle they them their this that these those when then than if about from into want wants means mean look like feel feels day days".split(
    " ",
  ),
);

function uniq(items: string[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
    if (out.length >= limit) break;
  }
  return out;
}

/** Pull ages, counts, rules, and distinctive phrases from free text / choices. */
export function extractAnswerThemes(text: string | null | undefined): ExtractedAnswerThemes {
  const raw = (text ?? "").trim();
  if (!raw) {
    return { ages: [], numbers: [], rules: [], choices: [], phrases: [], specificity: 0 };
  }

  const ages = uniq(
    [
      ...(raw.match(/\b(?:age|at|by|from|until|before|after)\s+(\d{1,2})\b/gi) ?? []),
      ...(raw.match(/\b(?:age|at|by|from|until|before|after)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi) ?? []),
      ...(raw.match(/\b(\d{1,2})\s*(?:years?|yrs?|months?|mos?|weeks?)\b/gi) ?? []),
      ...((/age|year|month|week/i.test(raw)
        ? raw.match(
            /\b(?:age\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
          )
        : null) ?? []),
    ],
    6,
  );

  const numbers = uniq(
    [
      ...(raw.match(/\b\d+\s*(?:minutes?|hours?|days?|nights?|weeks?|times?|%|percent)\b/gi) ?? []),
      ...(raw.match(/\b(?:up to|max|maximum|at least|no more than)\s+\d+\b/gi) ?? []),
    ],
    6,
  );

  const rules = uniq(
    raw
      .split(/[.;\n]+/)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length >= 18 &&
          /\b(always|never|must|only|no |not |before|after|until|unless|when|if )\b/i.test(
            s,
          ),
      )
      .map((s) => (s.length > 120 ? `${s.slice(0, 117)}…` : s)),
    5,
  );

  const choices = uniq(
    raw.includes(",")
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length >= 3 && s.length <= 48)
      : [],
    8,
  );

  const phrases = uniq(
    raw
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
      .slice(0, 24),
    10,
  );

  let specificity = 0;
  if (raw.length >= 40) specificity += 2;
  if (raw.length >= 100) specificity += 1;
  specificity += Math.min(3, ages.length + numbers.length);
  specificity += Math.min(2, rules.length);
  specificity += Math.min(2, choices.length > 1 ? 2 : choices.length);
  if (/\b(save|chore|visitor|sleep|feed|screen|allowance|daycare)\b/i.test(raw)) {
    specificity += 1;
  }

  return {
    ages,
    numbers,
    rules,
    choices,
    phrases,
    specificity: Math.min(10, specificity),
  };
}

export function mergeThemes(
  items: ExtractedAnswerThemes[],
): ExtractedAnswerThemes {
  const present = items.filter((i) => i.specificity > 0 || i.phrases.length > 0);
  const pool = present.length ? present : items;
  return {
    ages: uniq(pool.flatMap((i) => i.ages)),
    numbers: uniq(pool.flatMap((i) => i.numbers)),
    rules: uniq(pool.flatMap((i) => i.rules)),
    choices: uniq(pool.flatMap((i) => i.choices), 12),
    phrases: uniq(pool.flatMap((i) => i.phrases), 14),
    specificity: Math.round(
      pool.reduce((s, i) => s + i.specificity, 0) / Math.max(pool.length, 1),
    ),
  };
}

/**
 * Build a Turner Playbook-style principle from concrete answer material.
 * Returns null when content is too thin to say something useful.
 */
export function craftPrincipleStatement(input: {
  topicTitle: string;
  sharedPreviews: string[];
  samThemes: ExtractedAnswerThemes;
  michelleThemes: ExtractedAnswerThemes;
  sharedThemes: ExtractedAnswerThemes;
  disagreements: Array<{ question: string; sam: string; michelle: string }>;
}): { statement: string; usedSpecifics: string[] } | null {
  const usedSpecifics: string[] = [];
  const concretes = uniq(
    [
      ...input.sharedThemes.ages,
      ...input.sharedThemes.numbers,
      ...input.samThemes.ages,
      ...input.michelleThemes.ages,
      ...input.sharedThemes.rules.slice(0, 2),
      ...input.sharedThemes.choices.slice(0, 4),
    ],
    8,
  );
  usedSpecifics.push(...concretes);

  const sharedBits = input.sharedPreviews
    .map((p) => p.replace(/\.$/, "").trim())
    .filter((p) => p.length >= 24)
    .slice(0, 3);

  const totalSpec =
    input.sharedThemes.specificity +
    input.samThemes.specificity +
    input.michelleThemes.specificity;

  if (sharedBits.length < 1 && concretes.length < 2 && totalSpec < 6) {
    return null;
  }

  const parts: string[] = [];

  if (sharedBits.length >= 2) {
    parts.push(
      `In our family, ${sharedBits[0]}; we also hold that ${sharedBits[1]}${
        sharedBits[2] ? `; and ${sharedBits[2]}` : ""
      }.`,
    );
  } else if (sharedBits.length === 1) {
    parts.push(`In our family, ${sharedBits[0]}.`);
  } else if (concretes.length) {
    parts.push(
      `For ${input.topicTitle.toLowerCase()}, we commit to clear family rules around ${concretes
        .slice(0, 3)
        .join(", ")}.`,
    );
  }

  // Preserve meaningful differences rather than averaging them away.
  if (input.disagreements.length > 0) {
    const d = input.disagreements[0]!;
    parts.push(
      `We still differ on ${d.question.toLowerCase()}: Sam leans “${trimQuote(d.sam)},” while Michelle leans “${trimQuote(d.michelle)}”—we will keep that tension visible until we decide.`,
    );
    usedSpecifics.push("preserved disagreement");
  } else {
    const samOnly = uniq(
      [
        ...input.samThemes.rules,
        ...input.samThemes.ages,
        ...input.samThemes.choices.slice(0, 2),
      ].filter(
        (x) =>
          !input.michelleThemes.rules.includes(x) &&
          !input.michelleThemes.ages.includes(x),
      ),
      2,
    );
    const michelleOnly = uniq(
      [
        ...input.michelleThemes.rules,
        ...input.michelleThemes.ages,
        ...input.michelleThemes.choices.slice(0, 2),
      ].filter(
        (x) =>
          !input.samThemes.rules.includes(x) &&
          !input.samThemes.ages.includes(x),
      ),
      2,
    );
    if (samOnly.length && michelleOnly.length) {
      parts.push(
        `Sam especially emphasizes ${samOnly.join(" / ")}; Michelle especially emphasizes ${michelleOnly.join(" / ")}.`,
      );
      usedSpecifics.push(...samOnly, ...michelleOnly);
    }
  }

  if (input.sharedThemes.ages.length || input.sharedThemes.numbers.length) {
    const timing = uniq(
      [...input.sharedThemes.ages, ...input.sharedThemes.numbers],
      3,
    );
    parts.push(`Timing and thresholds we named: ${timing.join("; ")}.`);
  }

  const statement = parts.join(" ").replace(/\s+/g, " ").trim();
  if (statement.length < 60) return null;
  return { statement, usedSpecifics };
}

function trimQuote(s: string): string {
  const t = s.replace(/\.$/, "").trim();
  return t.length > 90 ? `${t.slice(0, 87)}…` : t;
}

export function explainPrincipleGaps(input: {
  answeredCount: number;
  importantUnanswered: number;
  disagreementCount: number;
  avgSpecificity: number;
  hasShared: boolean;
}): string {
  const missing: string[] = [];
  if (input.answeredCount < 3) {
    missing.push("a few more related answers so the principle isn’t based on one or two moments");
  }
  if (input.avgSpecificity < 4) {
    missing.push(
      "more concrete details (ages, rules, thresholds, or examples) in the answers you already gave",
    );
  }
  if (!input.hasShared && input.disagreementCount > 0) {
    missing.push("at least one shared conclusion where you already mostly agree");
  }
  if (input.importantUnanswered > 0) {
    missing.push(
      `${input.importantUnanswered} high-impact related question${input.importantUnanswered === 1 ? "" : "s"} still unanswered`,
    );
  }
  if (input.disagreementCount > 1) {
    missing.push("clarity on the open disagreements before locking a playbook statement");
  }
  if (!missing.length) {
    return "Confidence is moderate—small edits or one more related answer would make this playbook-ready.";
  }
  return `Not ready for a final playbook principle yet. Still missing: ${missing.join("; ")}.`;
}
