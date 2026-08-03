import Link from "next/link";
import { NAV_ITEMS } from "@/lib/constants/enums";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import { AuthStatus } from "@/components/layout/AuthStatus";
import { storageBackupLabel } from "@/lib/db/durable-save";

export async function AppShell({
  children,
  title,
  subtitle,
  actions,
  focusMode = false,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Hide secondary nav for focused babymoon sessions. */
  focusMode?: boolean;
}) {
  const ctx = await requireFamilyContext();
  if (ctx.mode === "supabase" && ctx.profile.email) {
    await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);
  }
  const backup = storageBackupLabel();

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/home" className="min-w-0">
            <div className="font-display text-lg leading-tight text-ink sm:text-xl">
              Turner Family Principles
            </div>
            <div className="truncate text-xs text-ink-subtle">
              {ctx.family.name}
              {ctx.mode === "emergency" ? ` · ${backup.label}` : ""}
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {ctx.mode === "emergency" && (
              <span
                className={
                  backup.remote
                    ? "hidden rounded-full border border-border bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong sm:inline"
                    : "hidden rounded-full border border-danger/40 bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger sm:inline"
                }
                title={backup.warning ?? undefined}
              >
                {backup.label}
              </span>
            )}
            <Link href="/search" className="btn btn-ghost hidden sm:inline-flex">
              Search
            </Link>
            {!focusMode ? (
              <Link href="/questions/before-birth" className="btn btn-secondary hidden md:inline-flex">
                Essentials
              </Link>
            ) : null}
            {!focusMode ? (
              <Link href="/babymoon" className="btn btn-secondary hidden md:inline-flex">
                Babymoon
              </Link>
            ) : null}
            <AuthStatus
              displayName={ctx.member.display_name || ctx.profile.display_name}
              email={
                ctx.mode === "emergency"
                  ? `Answering as ${ctx.member.display_name}`
                  : ctx.profile.email
              }
              mode={ctx.mode}
            />
          </div>
        </div>
        {!focusMode ? (
          <nav aria-label="Primary" className="border-t border-border/60">
            <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-2 scrollbar-none">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-bg-muted hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {(title || actions) && (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {title && (
                <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
              )}
              {subtitle && (
                <p className="mt-1 max-w-2xl text-ink-muted">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
