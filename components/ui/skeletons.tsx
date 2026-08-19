import { clsx } from "clsx";

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-lg bg-bg-muted", className)}
      aria-hidden
    />
  );
}

/** Header + nav chrome so route loading.tsx is not a blank page. */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" aria-busy="true">
      <p className="sr-only" aria-live="polite">
        Loading
      </p>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <Pulse className="h-5 w-52" />
            <Pulse className="mt-2 h-3 w-28" />
          </div>
          <Pulse className="h-9 w-24 rounded-full" />
        </div>
        <nav aria-hidden className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-hidden px-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Pulse key={i} className="h-9 w-24 shrink-0 rounded-full" />
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="surface space-y-3 p-5" aria-hidden>
      <Pulse className="h-3 w-24" />
      <Pulse className="h-6 w-3/4" />
      {Array.from({ length: lines }).map((_, i) => (
        <Pulse key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3" aria-hidden>
      <Pulse className="h-4 w-2/3" />
      <Pulse className="h-8 w-20 rounded-full" />
    </div>
  );
}

export function ProgressTileSkeleton() {
  return (
    <div className="surface space-y-3 p-4" aria-hidden>
      <Pulse className="h-3 w-28" />
      <Pulse className="h-8 w-16" />
      <Pulse className="h-2 w-full rounded-full" />
    </div>
  );
}

export function QuestionCardSkeleton() {
  return (
    <div className="surface space-y-4 p-5" aria-hidden>
      <Pulse className="h-3 w-32" />
      <Pulse className="h-8 w-4/5" />
      <Pulse className="h-4 w-full" />
      <Pulse className="h-12 w-full rounded-xl" />
      <Pulse className="h-12 w-full rounded-xl" />
    </div>
  );
}

export function DecisionSkeleton() {
  return (
    <div className="space-y-4">
      <Pulse className="h-9 w-64" />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={4} />
    </div>
  );
}

export function ResearchCardSkeleton() {
  return (
    <div className="surface flex gap-4 p-4" aria-hidden>
      <Pulse className="h-16 w-12 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Pulse className="h-5 w-3/4" />
        <Pulse className="h-4 w-full" />
        <Pulse className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <PageSkeleton>
      <Pulse className="mb-6 h-10 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ProgressTileSkeleton />
        <ProgressTileSkeleton />
        <ProgressTileSkeleton />
        <ProgressTileSkeleton />
      </div>
      <div className="mt-6">
        <QuestionCardSkeleton />
      </div>
    </PageSkeleton>
  );
}

export function BeforeBabyPageSkeleton() {
  return (
    <PageSkeleton>
      <Pulse className="mb-4 h-10 w-48" />
      <Pulse className="mb-4 h-16 w-full rounded-2xl" />
      <div className="space-y-3">
        <CardSkeleton />
        <CardSkeleton />
        <ListRowSkeleton />
      </div>
    </PageSkeleton>
  );
}

export function ConversationsPageSkeleton() {
  return (
    <PageSkeleton>
      <Pulse className="mb-4 h-10 w-56" />
      <CardSkeleton />
      <div className="mt-4 space-y-3">
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </PageSkeleton>
  );
}

export function EssentialsPageSkeleton() {
  return (
    <PageSkeleton>
      <Pulse className="mb-4 h-10 w-44" />
      <Pulse className="mb-4 h-3 w-full rounded-full" />
      <QuestionCardSkeleton />
    </PageSkeleton>
  );
}

export function QuestionsPageSkeleton() {
  return (
    <PageSkeleton>
      <Pulse className="mb-4 h-10 w-40" />
      <div className="space-y-3">
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </PageSkeleton>
  );
}

export function DecisionsPageSkeleton() {
  return (
    <PageSkeleton>
      <Pulse className="mb-4 h-10 w-40" />
      <div className="space-y-3">
        <CardSkeleton lines={2} />
        <CardSkeleton lines={2} />
      </div>
    </PageSkeleton>
  );
}

export function DecisionDetailSkeleton() {
  return (
    <PageSkeleton>
      <DecisionSkeleton />
    </PageSkeleton>
  );
}

export function ResearchPageSkeleton() {
  return (
    <PageSkeleton>
      <Pulse className="mb-4 h-10 w-56" />
      <div className="space-y-3">
        <ResearchCardSkeleton />
        <ResearchCardSkeleton />
        <ResearchCardSkeleton />
      </div>
    </PageSkeleton>
  );
}

export function ResearchDetailSkeleton() {
  return (
    <PageSkeleton>
      <Pulse className="mb-4 h-10 w-2/3" />
      <CardSkeleton lines={5} />
    </PageSkeleton>
  );
}
