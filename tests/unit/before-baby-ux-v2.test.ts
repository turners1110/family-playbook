import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");

function file(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

const MUTATION_FILES = [
  "components/checklists/BeforeBabyScheduler.tsx",
  "components/checklists/BeforeBabyTaskCard.tsx",
  "components/checklists/BeforeBabyBoard.tsx",
  "components/checklists/BeforeBabySchedulingSettings.tsx",
  "components/checklists/QuickAddTaskSheet.tsx",
  "components/checklists/OwnershipAssigner.tsx",
  "app/before-baby/page.tsx",
  "app/before-baby/assign/page.tsx",
];

describe("Before Baby UX v2 reload regression", () => {
  it("does not call window.location.reload on Before Baby mutation paths", () => {
    for (const rel of MUTATION_FILES) {
      const src = file(rel);
      expect(src, rel).not.toMatch(/window\.location\.reload\s*\(/);
      expect(src, rel).not.toMatch(/location\.reload\s*\(/);
    }
  });

  it("does not hard-navigate with location.href after checklist mutations", () => {
    expect(file("components/checklists/BeforeBabyScheduler.tsx")).not.toMatch(
      /window\.location\.href/,
    );
    expect(file("components/checklists/BeforeBabyBoard.tsx")).not.toMatch(
      /window\.location\.href/,
    );
  });
});

describe("Before Baby mutation contract", () => {
  it("scheduler uses save feedback and reconciles returned tasks", () => {
    const src = file("components/checklists/BeforeBabyScheduler.tsx");
    expect(src).toMatch(/useSaveFeedback/);
    expect(src).toMatch(/SaveStatus/);
    expect(src).toMatch(/What needs attention/);
    expect(src).toMatch(/payload\.tasks/);
    expect(src).toMatch(/onCreated=\{\(task\) => \{\s*setTasks/);
    expect(file("hooks/useBeforeBabyViewState.ts")).toMatch(/scroll: false/);
  });

  it("server actions return canonical tasks for reconciliation", () => {
    const src = file("lib/actions/checklists.ts");
    expect(src).toMatch(/actionToggleChecklistTask[\s\S]*tasks/);
    expect(src).toMatch(/actionUpdateChecklistTask[\s\S]*tasks/);
    expect(src).toMatch(/actionArchiveChecklistTask[\s\S]*tasks/);
    expect(src).toMatch(/actionGenerateBeforeBabySchedule[\s\S]*tasks: result\.tasks/);
    expect(src).toMatch(/actionAssignChecklistOwner[\s\S]*tasks/);
  });

  it("task edit keeps input fields and retry on the same form", () => {
    const src = file("components/checklists/BeforeBabyTaskCard.tsx");
    expect(src).toMatch(/defaultValue=\{task\.title\}/);
    expect(src).toMatch(/save\.retry/);
    expect(src).toMatch(/disabled=\{save\.isBusy\}/);
  });

  it("Home uses the same attention helper as Before Baby", () => {
    const home = file("app/home/page.tsx");
    expect(home).toMatch(/buildBeforeBabyAttention/);
    expect(home).toMatch(/getBeforeBabyChecklist/);
    expect(file("components/checklists/BeforeBabyScheduler.tsx")).toMatch(
      /buildBeforeBabyAttention/,
    );
  });
});

describe("save-feedback reuse", () => {
  it("does not invent a second save-status framework on Before Baby", () => {
    const src = file("components/checklists/BeforeBabyScheduler.tsx");
    expect(src).not.toMatch(/SavingStatusContext/);
    expect(src).toMatch(/from "@\/hooks\/useSaveFeedback"/);
    expect(file("components/checklists/BeforeBabyBoard.tsx")).toMatch(/SaveStatus/);
  });
});
