/**
 * Safe structured logs for EPUB processing.
 * Never logs book text, signed URLs, tokens, file contents, or secrets.
 */

export type EpubProcessLog = {
  event: string;
  sourceId?: string;
  fileId?: string;
  jobId?: string;
  stage?: string | null;
  status?: string | null;
  durationMs?: number;
  errorCode?: string | null;
};

export function logEpubProcess(entry: EpubProcessLog) {
  const payload = {
    ts: new Date().toISOString(),
    scope: "epub_process",
    event: entry.event,
    sourceId: entry.sourceId ?? null,
    fileId: entry.fileId ?? null,
    jobId: entry.jobId ?? null,
    stage: entry.stage ?? null,
    status: entry.status ?? null,
    durationMs: entry.durationMs ?? null,
    errorCode: entry.errorCode ?? null,
  };
  console.info(JSON.stringify(payload));
}

export function auditEpubAiEnv() {
  const provider = (process.env.RESEARCH_AI_PROVIDER || "mock").toLowerCase();
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const model =
    process.env.RESEARCH_AI_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    null;
  const runnerSecretConfigured = Boolean(
    process.env.RESEARCH_PROCESS_RUNNER_SECRET,
  );

  let ready = true;
  let reason: string | null = null;
  if (provider === "openai" && !hasOpenAi) {
    ready = false;
    reason = "OPENAI_API_KEY missing for RESEARCH_AI_PROVIDER=openai";
  } else if (provider === "anthropic" && !hasAnthropic) {
    ready = false;
    reason = "ANTHROPIC_API_KEY missing for RESEARCH_AI_PROVIDER=anthropic";
  }

  return {
    provider,
    modelConfigured: Boolean(model),
    modelName: model ? "[set]" : null,
    openAiKeyConfigured: hasOpenAi,
    anthropicKeyConfigured: hasAnthropic,
    runnerSecretConfigured,
    aiReady: ready,
    reason,
  };
}
