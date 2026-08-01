/**
 * Dry-run content upgrade preview. Does not apply changes.
 *
 *   pnpm preview:content-upgrade
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { readStore } from "@/lib/db/store";
import { buildContentUpgradePreview } from "@/lib/content/upgrade";

async function main() {
  const store = await readStore();
  const preview = buildContentUpgradePreview(store);
  const safe = preview.changes.filter((c) => c.safe).length;
  const manual = preview.changes.filter((c) => !c.safe).length;
  console.log(
    JSON.stringify(
      {
        template_version: preview.template_version,
        essentials_version: preview.essentials_version,
        generated_at: preview.generated_at,
        summary: preview.summary,
        safe_changes: safe,
        manual_approval_changes: manual,
        change_types: Object.fromEntries(
          [...new Set(preview.changes.map((c) => c.change_type))].map((type) => [
            type,
            preview.changes.filter((c) => c.change_type === type).length,
          ]),
        ),
        sample: preview.changes.slice(0, 12).map((c) => ({
          id: c.id,
          type: c.change_type,
          entity_type: c.entity_type,
          reason: c.reason,
          safe: c.safe,
          data_preserved: c.data_preserved,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
