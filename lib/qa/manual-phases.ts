import type { QaManualPhase } from "@/lib/types/models";

export function createDefaultManualPhases(): QaManualPhase[] {
  return [
    {
      id: "phase_a",
      title: "PHASE A — Single-phone save test",
      steps: [
        "Create QA Test Pack",
        "Open QA Session",
        "Answer QA 1 (same), QA 2 (different), QA 3 (either-or), QA 4 (short text)",
      ],
      expected:
        "Answers save for Sam and Michelle separately; matching and differing states appear correctly.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_b",
      title: "PHASE B — Refresh and resume",
      steps: [
        "Copy the test_run_id",
        "Refresh the browser",
        "Confirm QA 1–4 remain answered",
        "Pause after QA 5; resume from /conversations",
      ],
      expected: "Progress and answers survive refresh; Resume returns to the next card.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_c",
      title: "PHASE C — Normal logout and login",
      steps: [
        "Complete QA 7",
        "Log out",
        "Log back in with normal authentication",
        "Resume the same session",
      ],
      expected: "Same test_run_id session resumes; answers remain.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_d",
      title: "PHASE D — Trip Mode access",
      steps: [
        "Open a private browser",
        "Use Emergency Access as Sam",
        "Open the same QA run",
      ],
      expected: "Sam’s prior answers appear; no duplicate session is created.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_e",
      title: "PHASE E — Michelle’s phone",
      steps: [
        "On Phone B, sign in or use Trip Mode as Michelle",
        "Open the same test_run_id",
        "Confirm actor is Michelle",
      ],
      expected: "Michelle sees the shared session; actor-specific answers remain separate.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_f",
      title: "PHASE F — Two-phone conflict test",
      steps: [
        "Sam answers QA 2 Morning; Michelle answers Night; refresh both",
        "Keep both answers",
        "Save separate then shared on QA 14",
        "Near-simultaneous edits on different questions",
        "Same-record shared-answer conflict retry",
      ],
      expected:
        "Both phones show correct answers; no silent overwrite; retry message on conflict.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_g",
      title: "PHASE G — Task creation",
      steps: [
        "Confirm four QA suggestions appear",
        "Confirm only QA Task One and QA Provider Follow-Up",
        "Confirm again — no duplicates",
      ],
      expected: "Only selected tasks created; is_test_data and test_run_id set.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_h",
      title: "PHASE H — History and summary",
      steps: [
        "Complete the session",
        "Open history",
        "Open the record and verify summary, differences, tasks",
      ],
      expected: "One history record; trip memory present; active time non-negative.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_i",
      title: "PHASE I — Download QA report",
      steps: ["Export QA Report JSON and Markdown"],
      expected: "Report includes run ID, checks, counts; no secrets.",
      status: "not_tested",
      notes: "",
    },
    {
      id: "phase_j",
      title: "PHASE J — Clean up test data",
      steps: [
        "Review cleanup counts",
        "Type DELETE QA <last six of testRunId>",
        "Rerun integrity check",
      ],
      expected: "Zero QA records for the run; real data unchanged.",
      status: "not_tested",
      notes: "",
    },
  ];
}
