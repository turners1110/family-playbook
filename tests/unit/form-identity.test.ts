import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  STALE_PAYLOAD_USER_MESSAGE,
  assertSaveIdentity,
  assertSelectedOptionsValid,
  clearDraft,
  draftStorageKey,
  formIdentityKey,
  readDraft,
  writeDraft,
} from "@/lib/ui/form-identity";
import {
  conversationItemIsComplete,
  isDeepQuestionAnswered,
  mapConversationItemStatus,
} from "@/lib/services/answered-status";

const root = path.resolve(__dirname, "../..");

describe("form identity", () => {
  it("builds distinct keys per question / item / actor", () => {
    const a = formIdentityKey({
      sessionId: "s1",
      sessionItemId: "i1",
      questionId: "q_a",
    });
    const b = formIdentityKey({
      sessionId: "s1",
      sessionItemId: "i2",
      questionId: "q_b",
    });
    expect(a).not.toBe(b);
    expect(a).toContain("q_a");
    expect(b).toContain("i2");
  });

  it("scopes draft storage keys so Question A cannot collide with B", () => {
    const familyId = "fam_test";
    const keyA = draftStorageKey(familyId, {
      sessionId: "s1",
      sessionItemId: "i1",
      questionId: "q_a",
    });
    const keyB = draftStorageKey(familyId, {
      sessionId: "s1",
      sessionItemId: "i2",
      questionId: "q_b",
    });
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain("q_a");
    expect(keyB).toContain("q_b");

    const memory = new Map<string, string>();
    const fakeWindow = {
      sessionStorage: {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => {
          memory.set(k, v);
        },
        removeItem: (k: string) => {
          memory.delete(k);
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = fakeWindow;

    writeDraft(keyA, {
      identityKey: formIdentityKey({
        sessionId: "s1",
        sessionItemId: "i1",
        questionId: "q_a",
      }),
      samChoices: ["opt_a"],
      michelleChoices: [],
      samText: "A NOTES ONLY",
      michelleText: "",
      samExplain: "",
      michelleExplain: "",
      samScale: null,
      michelleScale: null,
      customSam: "",
      customMichelle: "",
      sharedText: "",
      updatedAt: new Date().toISOString(),
    });
    expect(readDraft(keyA)?.samText).toBe("A NOTES ONLY");
    expect(readDraft(keyB)).toBeNull();
    clearDraft(keyA);
    expect(readDraft(keyA)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
  });

  it("blocks mismatched save identities and stale options", () => {
    expect(
      assertSaveIdentity({
        expectedSessionId: "s1",
        expectedSessionItemId: "i1",
        expectedQuestionId: "q_a",
        payloadSessionId: "s1",
        payloadSessionItemId: "i1",
        payloadQuestionId: "q_b",
      }).ok,
    ).toBe(false);
    expect(
      assertSaveIdentity({
        expectedSessionId: "s1",
        expectedSessionItemId: "i1",
        expectedQuestionId: "q_a",
        payloadSessionId: "s1",
        payloadSessionItemId: "i2",
        payloadQuestionId: "q_a",
      }).ok,
    ).toBe(false);
    expect(
      assertSaveIdentity({
        expectedSessionId: "s1",
        expectedSessionItemId: "i1",
        expectedQuestionId: "q_a",
        payloadSessionId: "s1",
        payloadSessionItemId: "i1",
        payloadQuestionId: "q_a",
      }).ok,
    ).toBe(true);
    expect(assertSelectedOptionsValid(["gone"], ["keep"], false).ok).toBe(
      false,
    );
    expect(assertSelectedOptionsValid(["keep"], ["keep"], false).ok).toBe(true);
    expect(assertSelectedOptionsValid(["custom"], ["keep"], true).ok).toBe(
      true,
    );
    expect(STALE_PAYLOAD_USER_MESSAGE).toMatch(/no longer matches/i);
  });

  it("actor and session draft keys stay separate", () => {
    const familyId = "fam";
    const sam = draftStorageKey(familyId, {
      sessionId: "s1",
      sessionItemId: "i1",
      questionId: "q_a",
      actor: "sam",
    });
    const michelle = draftStorageKey(familyId, {
      sessionId: "s1",
      sessionItemId: "i1",
      questionId: "q_a",
      actor: "michelle",
    });
    const otherSession = draftStorageKey(familyId, {
      sessionId: "s2",
      sessionItemId: "i1",
      questionId: "q_a",
      actor: "sam",
    });
    expect(sam).not.toBe(michelle);
    expect(sam).not.toBe(otherSession);
  });
});

describe("answered status canonical helpers", () => {
  it("maps conversation item statuses and completion", () => {
    expect(mapConversationItemStatus("answered_same")).toBe("both_answered");
    expect(mapConversationItemStatus("undecided")).toBe("undecided");
    expect(mapConversationItemStatus("discuss_later")).toBe("discuss_later");
    expect(mapConversationItemStatus("needs_follow_up")).toBe(
      "waiting_for_provider",
    );
    expect(conversationItemIsComplete("answered_different")).toBe(true);
    expect(conversationItemIsComplete("pending")).toBe(false);
  });

  it("deep question requires library answer, not quick companion alone", () => {
    const store = {
      answers: [],
      conversation_quick_answers: [
        { prompt_id: "qp_parent_word", question_id: null },
      ],
    } as never;
    expect(isDeepQuestionAnswered(store, "q_deep")).toBe(false);
    const withDeep = {
      answers: [{ question_id: "q_deep" }],
    } as never;
    expect(isDeepQuestionAnswered(withDeep, "q_deep")).toBe(true);
  });
});

describe("UI contracts for stale form fix", () => {
  it("ConversationCard is keyed by session+item+prompt and resets identity", () => {
    const card = readFileSync(
      path.join(root, "components/conversations/ConversationCard.tsx"),
      "utf8",
    );
    expect(card).toMatch(/formIdentityKey/);
    expect(card).toMatch(/Unsaved draft restored/);
    expect(card).toMatch(/STALE_PAYLOAD_USER_MESSAGE/);
    expect(card).toMatch(/clearDraft/);
    expect(card).toMatch(/mountIdentityRef/);
    expect(card).toMatch(/expectedPromptId/);

    const sessionPage = readFileSync(
      path.join(root, "app/conversations/session/[sessionId]/page.tsx"),
      "utf8",
    );
    expect(sessionPage).toMatch(/key=\{`\$\{session\.id\}:\$\{item\.id\}:\$\{prompt\.id\}`\}/);

    const essentials = readFileSync(
      path.join(root, "app/questions/before-birth/screen/[screenId]/page.tsx"),
      "utf8",
    );
    expect(essentials).toMatch(/key=\{screen\.id\}/);

    const essentialsView = readFileSync(
      path.join(root, "components/essentials/EssentialsScreen.tsx"),
      "utf8",
    );
    expect(essentialsView).toMatch(/assertEssentialsWrites/);
    expect(essentialsView).toMatch(/mountQuestionIdRef/);
  });

  it("server batch save rejects expectedPromptId mismatch", () => {
    const service = readFileSync(
      path.join(root, "lib/services/conversations.ts"),
      "utf8",
    );
    expect(service).toMatch(/expectedPromptId/);
    expect(service).toMatch(/question_mismatch/);
  });

  it("verified saves revalidate homepage and essentials routes", () => {
    const actions = readFileSync(
      path.join(root, "lib/actions/conversations.ts"),
      "utf8",
    );
    expect(actions).toMatch(/revalidatePath\("\/home"\)/);
    expect(actions).toMatch(/revalidatePath\("\/questions\/before-birth"\)/);
    const essentials = readFileSync(
      path.join(root, "lib/actions/essentials.ts"),
      "utf8",
    );
    expect(essentials).toMatch(/revalidatePath\("\/home"\)/);
  });
});
