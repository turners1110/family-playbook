import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import {
  isElementFullyVisibleHorizontally,
  isNavItemActive,
  navScrollBehavior,
  resolveActiveNavHref,
} from "@/lib/ui/active-nav";
import { clientValidateStructuredAnswer } from "@/lib/questions/structured-client-validation";
import { classifyUserError } from "@/lib/errors/user-facing";
import { classifySaveError } from "@/lib/ui/save-feedback";

const root = path.resolve(__dirname, "../..");

function source(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("active navigation", () => {
  it("maps nested routes to the section href", () => {
    expect(resolveActiveNavHref("/home")).toBe("/home");
    expect(resolveActiveNavHref("/before-baby/plan")).toBe("/before-baby");
    expect(resolveActiveNavHref("/questions/before-birth/screen/1")).toBe(
      "/questions/before-birth",
    );
    expect(resolveActiveNavHref("/questions/sleep")).toBe("/questions");
    expect(resolveActiveNavHref("/conversations/session/abc")).toBe(
      "/conversations",
    );
    expect(resolveActiveNavHref("/decisions/xyz")).toBe("/decisions");
    expect(resolveActiveNavHref("/research/src_1")).toBe("/research");
    expect(resolveActiveNavHref("/before-birth")).toBe("/questions/before-birth");
    expect(resolveActiveNavHref("/search")).toBeNull();
  });

  it("sets only one active item", () => {
    expect(isNavItemActive("/questions", "/questions/before-birth")).toBe(false);
    expect(
      isNavItemActive("/questions/before-birth", "/questions/before-birth"),
    ).toBe(true);
  });

  it("PrimaryNav uses aria-current and scrollIntoView", () => {
    const src = source("components/layout/PrimaryNav.tsx");
    expect(src).toMatch(/aria-current=\{active \? "page"/);
    expect(src).toMatch(/scrollIntoView/);
    expect(src).toMatch(/prefers-reduced-motion/);
    expect(src).toMatch(/activeRef/);
  });

  it("uses auto scroll when reduced motion is preferred", () => {
    expect(navScrollBehavior(true)).toBe("auto");
    expect(navScrollBehavior(false)).toBe("smooth");
  });

  it("skips scroll when the active item is already fully visible", () => {
    expect(
      isElementFullyVisibleHorizontally(
        { left: 40, right: 120 },
        { left: 0, right: 300 },
      ),
    ).toBe(true);
    expect(
      isElementFullyVisibleHorizontally(
        { left: 280, right: 360 },
        { left: 0, right: 300 },
      ),
    ).toBe(false);
  });
});

describe("route loading and error boundaries", () => {
  const loadingRoutes = [
    "app/home/loading.tsx",
    "app/before-baby/loading.tsx",
    "app/questions/loading.tsx",
    "app/questions/before-birth/loading.tsx",
    "app/conversations/loading.tsx",
    "app/conversations/session/[sessionId]/loading.tsx",
    "app/decisions/loading.tsx",
    "app/decisions/[id]/loading.tsx",
    "app/research/loading.tsx",
    "app/research/[sourceId]/loading.tsx",
  ];

  it("adds loading.tsx for major routes", () => {
    for (const file of loadingRoutes) {
      expect(existsSync(path.join(root, file)), file).toBe(true);
    }
  });

  it("shared skeletons include sr-only loading copy and hide pulses", () => {
    const src = source("components/ui/skeletons.tsx");
    expect(src).toMatch(/sr-only/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/aria-hidden/);
    expect(src).toMatch(/PageSkeleton/);
  });

  it("root error boundary retries without leaking secrets", () => {
    const err = source("components/errors/RouteError.tsx");
    expect(err).toMatch(/Retry/);
    expect(err).toMatch(/Back to Home/);
    expect(err).not.toMatch(/stack/);
    expect(err).not.toMatch(/service.role|SUPABASE_SERVICE/i);
    expect(existsSync(path.join(root, "app/error.tsx"))).toBe(true);
    expect(existsSync(path.join(root, "app/not-found.tsx"))).toBe(true);
    const nf = source("app/not-found.tsx");
    expect(nf).toMatch(/Page not found/);
    expect(nf).toMatch(/\/home/);
    expect(nf).toMatch(/\/conversations/);
    expect(nf).toMatch(/\/before-baby/);
  });
});

describe("structured client validation", () => {
  it("rejects duplicate ranking values", () => {
    expect(
      clientValidateStructuredAnswer(
        { mode: "ranking", options: ["A", "B"] },
        {
          text: "",
          choice: [],
          ranking: ["A", "A"],
          scale: null,
          matrix: {},
        },
      ),
    ).toMatch(/same option twice/i);
  });

  it("requires three priority picks", () => {
    expect(
      clientValidateStructuredAnswer(
        { mode: "priority_pick", max_selections: 3 },
        {
          text: "",
          choice: ["one"],
          ranking: [],
          scale: null,
          matrix: {},
        },
      ),
    ).toMatch(/Select 3/);
  });

  it("requires matrix rows", () => {
    expect(
      clientValidateStructuredAnswer(
        { mode: "matrix", matrix_rows: ["Sleep", "Feeding"] },
        {
          text: "",
          choice: "",
          ranking: [],
          scale: null,
          matrix: { Sleep: "Sam" },
        },
      ),
    ).toMatch(/assignment/);
  });

  it("requires policy fields", () => {
    expect(
      clientValidateStructuredAnswer(
        { mode: "policy_builder", policy_fields: ["Rule"] },
        {
          text: "Rule: ",
          choice: "",
          ranking: [],
          scale: null,
          matrix: {},
        },
      ),
    ).toMatch(/policy field/i);
  });
});

describe("user-facing errors", () => {
  it("classifies network, auth, and conflict", () => {
    expect(classifyUserError(new Error("Failed to fetch")).kind).toBe("network");
    expect(classifyUserError(new Error("session expired")).kind).toBe("auth");
    expect(classifyUserError(new Error("Another update was saved")).kind).toBe(
      "conflict",
    );
  });

  it("maps save network errors to connection copy", () => {
    expect(classifySaveError(new Error("network down")).message).toMatch(
      /Connection lost/i,
    );
  });
});

describe("save surfaces reuse shared status", () => {
  it("AnswerEditor uses SaveButton and SaveStatus", () => {
    const src = source("components/questions/AnswerEditor.tsx");
    expect(src).toMatch(/useSaveFeedback/);
    expect(src).toMatch(/SaveButton/);
    expect(src).toMatch(/SaveStatus/);
    expect(src).toMatch(/PendingNavigationGuard/);
    expect(src).toMatch(/clientValidateStructuredAnswer/);
  });

  it("DecisionForm and Before Baby custom task use SaveStatus", () => {
    expect(source("components/decisions/DecisionForm.tsx")).toMatch(/SaveStatus/);
    expect(source("components/checklists/BeforeBabyBoard.tsx")).toMatch(
      /SaveStatus/,
    );
  });
});
