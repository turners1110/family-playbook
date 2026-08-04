/**
 * Apply curated Shared-First discussion modes to the question seed.
 * Dry-run by default; pass --write to update data/seed/questions.json.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  classifyDiscussionMode,
  summarizeClassification,
  type DiscussionMode,
} from "../lib/discussions/discussion-mode";

const root = path.resolve(__dirname, "..");
const file = path.join(root, "data/seed/questions.json");
const write = process.argv.includes("--write");

const questions = JSON.parse(readFileSync(file, "utf8")) as Array<
  Record<string, unknown> & {
    id: string;
    slug: string;
    short_title: string;
    text: string;
    categories: string[];
    separate_answers_recommended?: boolean;
  }
>;

const modes: DiscussionMode[] = [];
let changed = 0;

for (const q of questions) {
  const result = classifyDiscussionMode(q);
  modes.push(result.discussion_mode);
  const before = JSON.stringify({
    discussion_mode: q.discussion_mode ?? null,
    discussion_reason: q.discussion_reason ?? null,
    separate_answers_recommended: q.separate_answers_recommended ?? null,
  });
  q.discussion_mode = result.discussion_mode;
  q.discussion_reason = result.discussion_reason;
  q.separate_answers_recommended = result.separate_answers_recommended;
  const after = JSON.stringify({
    discussion_mode: q.discussion_mode,
    discussion_reason: q.discussion_reason,
    separate_answers_recommended: q.separate_answers_recommended,
  });
  if (before !== after) changed += 1;
}

const stats = summarizeClassification(modes);
const report = {
  write,
  changed,
  stats,
  target: {
    shared_first: "70–80%",
    separate_first: "20–25%",
    either: "<5%",
  },
  sample_separate: questions
    .filter((q) => q.discussion_mode === "separate_first")
    .slice(0, 12)
    .map((q) => q.short_title),
  sample_either: questions
    .filter((q) => q.discussion_mode === "either")
    .slice(0, 8)
    .map((q) => q.short_title),
};

console.log(JSON.stringify(report, null, 2));

if (write) {
  writeFileSync(file, `${JSON.stringify(questions, null, 2)}\n`);
  console.log(`Wrote ${file}`);
}
