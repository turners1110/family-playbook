import { NextResponse } from "next/server";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import { getResearchStorageStatus, uploadResearchFile } from "@/lib/research/services";
import { createHash } from "crypto";
import { validateResearchUpload } from "@/lib/research/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Local-development upload endpoint.
 * Production uploads go directly to a Supabase signed upload URL.
 */
export async function POST(request: Request) {
  const status = getResearchStorageStatus();
  if (status.mode !== "local") {
    return NextResponse.json(
      {
        error:
          "Use the signed Supabase upload URL in production. This route is local-dev only.",
      },
      { status: 400 },
    );
  }

  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase") {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }

  const form = await request.formData();
  const sourceId = String(form.get("sourceId") || "");
  const fileHash = String(form.get("fileHash") || "");
  const file = form.get("file");

  if (!sourceId || !fileHash || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing upload fields." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const actualHash = createHash("sha256").update(buffer).digest("hex");
  if (actualHash !== fileHash) {
    return NextResponse.json({ error: "File hash mismatch." }, { status: 400 });
  }

  const check = validateResearchUpload({
    name: file.name,
    size: file.size,
    type: file.type,
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  try {
    const saved = await uploadResearchFile(ctx, {
      sourceId,
      filename: file.name,
      mimeType: check.mimeType,
      buffer,
      fileHash,
    });
    return NextResponse.json({ ok: true, file: saved });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed.",
      },
      { status: 400 },
    );
  }
}
