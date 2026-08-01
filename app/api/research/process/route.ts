import { NextResponse } from "next/server";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { getResearchStorageMode } from "@/lib/research/mode";
import {
  advanceEpubJob,
  claimNextEpubJob,
  logEpubProcessSafe,
} from "@/lib/research/epub/process-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.RESEARCH_PROCESS_RUNNER_SECRET;
  const header = request.headers.get("authorization");
  const bearer =
    header?.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : null;
  const provided =
    bearer ||
    request.headers.get("x-research-process-secret") ||
    new URL(request.url).searchParams.get("secret");

  if (secret && provided && provided === secret) return "secret" as const;
  return null;
}

/**
 * Protected EPUB job runner.
 * Claims one queued job and advances a few stages (timeout-safe / resumable).
 */
export async function POST(request: Request) {
  const mode = getResearchStorageMode();
  if (mode === "unavailable") {
    return NextResponse.json(
      { error: "Research storage unavailable." },
      { status: 503 },
    );
  }

  const viaSecret = authorized(request);
  if (!viaSecret) {
    try {
      await requireFamilyContext();
    } catch {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  let body: { jobId?: string; maxStages?: number; sourceId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const maxStages = Math.max(1, Math.min(Number(body.maxStages ?? 2), 3));
  const started = Date.now();

  let jobId = body.jobId;
  if (!jobId) {
    const claimed = await claimNextEpubJob();
    jobId = claimed?.id;
  }
  if (!jobId) {
    return NextResponse.json({
      ok: true,
      idle: true,
      message: "No queued EPUB jobs.",
    });
  }

  const result = await advanceEpubJob({ jobId, maxStages });
  logEpubProcessSafe({
    event: "runner_tick",
    sourceId: result.job?.source_id,
    fileId: (result.job as { file_id?: string } | null)?.file_id,
    jobId: result.job?.id ?? jobId,
    stage: result.job?.current_stage,
    status: result.job?.status,
    durationMs: Date.now() - started,
    errorCode: result.job?.error_code,
  });

  return NextResponse.json({
    ok: true,
    idle: false,
    done: result.done,
    jobId: result.job?.id ?? jobId,
    status: result.job?.status ?? null,
    stage: result.job?.current_stage ?? null,
    stagesRun: result.stagesRun,
    errorCode: result.job?.error_code ?? null,
    safeError: result.job?.safe_error_message ?? null,
  });
}

export async function GET(request: Request) {
  // Allow GET with secret for simple cron pings.
  return POST(request);
}
