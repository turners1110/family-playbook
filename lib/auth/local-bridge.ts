import { readStore, updateStore } from "@/lib/db/store";
import type { FamilyMember, UserProfile } from "@/lib/types/models";

/**
 * Phase 1 bridge: map the authenticated Supabase email onto the local JSON
 * store member so existing product flows keep working unchanged.
 */
export async function syncLocalIdentityFromAuth(email: string, displayName: string) {
  const normalized = email.trim().toLowerCase();
  const samEmail = (process.env.TURNER_SAM_EMAIL ?? "sam@turner.family").trim().toLowerCase();
  const michelleEmail = (process.env.TURNER_MICHELLE_EMAIL ?? "michelle@turner.family")
    .trim()
    .toLowerCase();

  await updateStore((store) => {
    let targetUser: UserProfile | undefined;

    if (normalized === samEmail) {
      targetUser = store.users.find((u) => u.display_name.toLowerCase().includes("sam"));
    } else if (normalized === michelleEmail) {
      targetUser = store.users.find((u) => u.display_name.toLowerCase().includes("michelle"));
    } else {
      targetUser = store.users.find((u) => u.email.toLowerCase() === normalized);
    }

    if (!targetUser) {
      // Fall back to first parent so local product flows still have an actor.
      targetUser = store.users[0];
    }

    if (targetUser) {
      store.current_user_id = targetUser.id;
      // Keep local display email aligned for settings/UI hints without overwriting seed names.
      if (!targetUser.email || targetUser.email.endsWith("@turner.family")) {
        targetUser.email = email;
      }
      if (displayName && targetUser.display_name.startsWith("Sam") === false && targetUser.display_name.startsWith("Michelle") === false) {
        targetUser.display_name = displayName;
      }
    }

    return store;
  });
}

export async function getLocalMemberForAuthEmail(email: string): Promise<FamilyMember | null> {
  const store = await readStore();
  const normalized = email.trim().toLowerCase();
  const samEmail = (process.env.TURNER_SAM_EMAIL ?? "sam@turner.family").trim().toLowerCase();
  const michelleEmail = (process.env.TURNER_MICHELLE_EMAIL ?? "michelle@turner.family")
    .trim()
    .toLowerCase();

  let userId = store.current_user_id;
  if (normalized === samEmail) {
    userId = store.users.find((u) => u.display_name.toLowerCase().includes("sam"))?.id ?? userId;
  } else if (normalized === michelleEmail) {
    userId =
      store.users.find((u) => u.display_name.toLowerCase().includes("michelle"))?.id ?? userId;
  } else {
    userId = store.users.find((u) => u.email.toLowerCase() === normalized)?.id ?? userId;
  }

  return store.members.find((m) => m.user_id === userId) ?? null;
}
