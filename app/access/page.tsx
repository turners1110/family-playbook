import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { EmergencyAccessForm } from "@/components/auth/EmergencyAccessForm";
import {
  EMERGENCY_ACCESS_USER_MESSAGES,
  isEmergencyAccessModeEnabled,
} from "@/lib/auth/emergency";
import { readEmergencySession } from "@/lib/auth/emergency-session";
import { getOptionalUser } from "@/lib/auth/family-context";

export const dynamic = "force-dynamic";

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isEmergencyAccessModeEnabled()) {
    notFound();
  }

  const user = await getOptionalUser();
  if (user) redirect("/home");

  const session = await readEmergencySession();
  if (session.ok) redirect("/access/actor");

  const params = await searchParams;
  const initialError =
    params.error === "expired"
      ? EMERGENCY_ACCESS_USER_MESSAGES.expired
      : params.error === "tampered"
        ? EMERGENCY_ACCESS_USER_MESSAGES.tampered
        : params.error === "setup"
          ? "Trip Mode could not find Sam or Michelle in the family store."
          : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
          Trip Mode
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">
          Family access
        </h1>
        <p className="mt-3 text-ink-muted">
          Enter the shared family access code to use Turner Family Principles on
          this trip. Your answers save to the remote online backup.
        </p>
        <EmergencyAccessForm initialError={initialError} />
        <p className="mt-6 text-xs text-ink-subtle">
          Prefer magic-link testing?{" "}
          <Link href="/login" className="underline">
            Go to email sign-in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
