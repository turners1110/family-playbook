import Link from "next/link";
import { isEmergencyAccessModeEnabled } from "@/lib/auth/emergency";

export const dynamic = "force-dynamic";

export default function StorageUnavailablePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-danger">
          Storage unavailable
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">
          Pause before answering
        </h1>
        <p className="mt-3 text-ink-muted">
          Remote family storage could not be reached. Do not enter new answers
          until storage is restored, or you may lose work.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink-muted">
          <li>Try refreshing in a minute.</li>
          <li>If you recently saved, download a backup from Settings when access returns.</li>
          <li>Contact Sam if this continues.</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/home" className="btn btn-primary">
            Try again
          </Link>
          {isEmergencyAccessModeEnabled() ? (
            <Link href="/access" className="btn btn-secondary">
              Back to access
            </Link>
          ) : (
            <Link href="/login" className="btn btn-secondary">
              Back to login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
