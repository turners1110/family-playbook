# AI service interface

Core app functions do not depend on AI.

Interface: `lib/services/ai.ts`

```ts
interface AiService {
  generateSection(input: AiGenerateSectionInput): Promise<AiGenerateSectionResult>;
  summarizeAnswers(texts: string[]): Promise<AiGenerateSectionResult>;
  findContradictions(statements: string[]): Promise<AiGenerateSectionResult>;
}
```

Current implementation: `MockAiService`

Rules for first release and beyond:

1. Label all AI output as AI-generated
2. Store prompts and outputs in `ai_outputs`
3. Require explicit user approval before AI text becomes part of a decision or playbook
4. Keep human-entered content separate from AI drafts
5. Never present mocked AI as live model intelligence
