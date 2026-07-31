import Link from "next/link";
import { NAV_ITEMS } from "@/lib/constants/enums";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { syncLocalIdentityFromAuth } from "@/lib/auth/local-bridge";
import { AuthStatus } from "@/components/layout/AuthStatus";

export async function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const ctx = await requireFamilyContext();
  await syncLocalIdentityFromAuth(ctx.profile.email, ctx.profile.display_name);

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
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/search" className="btn btn-ghost hidden sm:inline-flex">
              Search
            </Link>
            <Link href="/babymoon" className="btn btn-secondary hidden md:inline-flex">
              Babymoon
            </Link>
            <AuthStatus
              displayName={ctx.member.display_name || ctx.profile.display_name}
              email={ctx.profile.email}
            />
          </div>
        </div>
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
