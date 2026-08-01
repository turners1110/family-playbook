import { updateStore } from "@/lib/db/store";
import type { EmergencyActorKey } from "@/lib/auth/emergency";

export async function syncEmergencyActorToStore(actor: EmergencyActorKey) {
  await updateStore(
    (store) => {
      const needle = actor === "sam" ? "sam" : "michelle";
      const user = store.users.find((u) =>
        u.display_name.toLowerCase().includes(needle),
      );
      if (user) {
        store.current_user_id = user.id;
      }
      return store;
    },
    { operation: "syncEmergencyActorToStore" },
  );
}
