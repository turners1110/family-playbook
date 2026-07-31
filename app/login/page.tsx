import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getOptionalUser } from "@/lib/auth/family-context";
import { publicAuthMessage } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const user = await getOptionalUser();
  if (user) {
    redirect("/home");
  }

  const errorMessage = publicAuthMessage(params.error);

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
          Sign in with a magic link sent to your email. Only invited family members
          can access this space.
        </p>
        <LoginForm initialError={errorMessage} />
        <p className="mt-6 text-xs text-ink-subtle">
          After signing in for the first time, an administrator must link your account
          to the Turner Family with <code>pnpm setup:family</code>.
        </p>
      </div>
    </div>
  );
}
