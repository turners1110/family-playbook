import Link from "next/link";
import { redirect } from "next/navigation";
import { readStore } from "@/lib/db/local-store";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  try {
    await readStore();
    redirect("/home");
  } catch {
    // store missing
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
          Private family access
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">
          Turner Family Principles
        </h1>
        <p className="mt-3 text-ink-muted">
          This release uses a secure local family store for Sam and Michelle. For
          production, connect Supabase Auth (magic link) using the included schema and RLS.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-ink-muted">
          <li>
            Run <code className="rounded bg-bg-muted px-1">pnpm generate:questions</code>
          </li>
          <li>
            Run <code className="rounded bg-bg-muted px-1">pnpm seed</code>
          </li>
          <li>
            Open <Link href="/home" className="text-accent underline">Home</Link>
          </li>
        </ol>
        <div className="mt-6 rounded-xl border border-border bg-bg-muted p-4 text-sm text-ink-muted">
          Demo emails after seeding: sam@turner.family · michelle@turner.family
          <br />
          Switch users from the header once signed into the local session.
        </div>
        <Link href="/home" className="btn btn-primary mt-6 w-full">
          Enter family space
        </Link>
      </div>
    </div>
  );
}
