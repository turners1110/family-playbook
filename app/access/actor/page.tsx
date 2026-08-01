import { notFound, redirect } from "next/navigation";
import { EmergencyActorForm } from "@/components/auth/EmergencyActorForm";
import { getEmergencyActorChoices } from "@/lib/auth/emergency-actions";
import { isEmergencyAccessModeEnabled } from "@/lib/auth/emergency";
import { readEmergencySession } from "@/lib/auth/emergency-session";
import { getOptionalUser } from "@/lib/auth/family-context";

export const dynamic = "force-dynamic";

export default async function AccessActorPage() {
  if (!isEmergencyAccessModeEnabled()) {
    notFound();
  }

  const user = await getOptionalUser();
  if (user) redirect("/home");

  const session = await readEmergencySession();
  if (!session.ok) {
    redirect(
      session.reason === "expired"
        ? "/access?error=expired"
        : session.reason === "tampered"
          ? "/access?error=tampered"
          : "/access",
    );
  }

  const labels = await getEmergencyActorChoices();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
          Trip Mode
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">Who is answering?</h1>
        <p className="mt-3 text-ink-muted">
          Choose your name so separate answers stay correctly attributed. You can
          switch later by signing out of Trip Mode.
        </p>
        <EmergencyActorForm
          samLabel={labels.sam}
          michelleLabel={labels.michelle}
        />
      </div>
    </div>
  );
}
