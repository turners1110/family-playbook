import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-ink-subtle">
        Turner Family Playbook
      </p>
      <h1 className="mt-2 font-display text-3xl text-ink">Page not found</h1>
      <p className="mt-3 text-ink-muted">
        This page doesn&apos;t exist or is no longer available.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/home" className="btn btn-primary min-h-11">
          Home
        </Link>
        <Link href="/conversations" className="btn btn-secondary min-h-11">
          Conversations
        </Link>
        <Link href="/before-baby" className="btn btn-secondary min-h-11">
          Before Baby
        </Link>
      </div>
    </main>
  );
}
