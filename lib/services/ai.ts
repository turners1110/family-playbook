/**
 * AI service interface — mocked for first release.
 * Core app functions must not depend on live AI.
 */

export interface AiGenerateSectionInput {
  sectionSlug: string;
  sectionTitle: string;
  decisions: Array<{ title: string; statement: string; status: string }>;
  outcomes: Array<{ label: string }>;
  openQuestions: string[];
  principles: Array<{ title: string; statement: string }>;
}

export interface AiGenerateSectionResult {
  model: string;
  prompt: string;
  output: string;
  requiresApproval: true;
  labeled: "ai_generated";
}

export interface AiService {
  generateSection(input: AiGenerateSectionInput): Promise<AiGenerateSectionResult>;
  summarizeAnswers(texts: string[]): Promise<AiGenerateSectionResult>;
  findContradictions(statements: string[]): Promise<AiGenerateSectionResult>;
}

export class MockAiService implements AiService {
  async generateSection(input: AiGenerateSectionInput): Promise<AiGenerateSectionResult> {
    const prompt = `Generate playbook section "${input.sectionTitle}" from family decisions and outcomes.`;
    const output = [
      `[AI DRAFT — requires approval]`,
      ``,
      `Section: ${input.sectionTitle}`,
      ``,
      input.principles.length
        ? `Guiding principles:\n${input.principles.map((p) => `- ${p.title}: ${p.statement}`).join("\n")}`
        : `No principles provided.`,
      ``,
      input.decisions.length
        ? `Current plans:\n${input.decisions.map((d) => `- ${d.title}: ${d.statement} (${d.status})`).join("\n")}`
        : `No decisions linked yet.`,
      ``,
      input.outcomes.length
        ? `Related outcomes: ${input.outcomes.map((o) => o.label).join(", ")}`
        : ``,
      ``,
      input.openQuestions.length
        ? `Open questions:\n${input.openQuestions.map((q) => `- ${q}`).join("\n")}`
        : ``,
      ``,
      `This draft separates values, current plans, uncertainty, and child-dependent items. Edit before approving.`,
    ]
      .filter((line) => line !== undefined)
      .join("\n");

    return {
      model: "mock-v1",
      prompt,
      output,
      requiresApproval: true,
      labeled: "ai_generated",
    };
  }

  async summarizeAnswers(texts: string[]): Promise<AiGenerateSectionResult> {
    return {
      model: "mock-v1",
      prompt: "Summarize family answers",
      output: `[AI DRAFT — requires approval]\n\nThemes mentioned:\n${texts
        .slice(0, 5)
        .map((t) => `- ${t.slice(0, 120)}`)
        .join("\n")}`,
      requiresApproval: true,
      labeled: "ai_generated",
    };
  }

  async findContradictions(statements: string[]): Promise<AiGenerateSectionResult> {
    return {
      model: "mock-v1",
      prompt: "Find contradictions",
      output: `[AI DRAFT — requires approval]\n\nReviewed ${statements.length} statements. Manual review still required; this mock does not assert real contradictions.`,
      requiresApproval: true,
      labeled: "ai_generated",
    };
  }
}

export const aiService: AiService = new MockAiService();
