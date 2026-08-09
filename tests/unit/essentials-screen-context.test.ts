import { describe, expect, it } from "vitest";
import { ESSENTIALS_SCREENS, listPrimaryScreens } from "@/lib/essentials/pathway";
import {
  listEssentialsScreensMissingEnrichment,
  resolveEssentialsWorkshopContext,
  scoreLabel,
} from "@/lib/essentials/screen-context";

describe("essentials workshop context", () => {
  it("covers every Essentials screen with enrichment", () => {
    const missing = listEssentialsScreensMissingEnrichment(ESSENTIALS_SCREENS);
    expect(missing).toEqual([]);
  });

  it("resolves purpose, explanation, examples, and prompts for primaries", () => {
    for (const screen of listPrimaryScreens()) {
      const ctx = resolveEssentialsWorkshopContext(screen);
      expect(ctx.purpose?.length ?? 0).toBeGreaterThan(10);
      expect(ctx.explanation?.length ?? 0).toBeGreaterThan(20);
      expect(ctx.examples.length).toBeGreaterThanOrEqual(2);
      expect(ctx.prompts.length).toBeGreaterThan(0);
      expect(ctx.estimatedMinutes).toBeGreaterThan(0);
      expect(ctx.importance).not.toBeNull();
      expect(scoreLabel(ctx.importance!)).toBeTruthy();
    }
  });

  it("keeps soft dependencies pointing at real screens", () => {
    const ids = new Set(ESSENTIALS_SCREENS.map((s) => s.id));
    for (const screen of ESSENTIALS_SCREENS) {
      const ctx = resolveEssentialsWorkshopContext(screen);
      for (const dep of ctx.dependsOn) {
        expect(ids.has(dep), `${screen.id} depends on missing ${dep}`).toBe(
          true,
        );
      }
    }
  });
});
