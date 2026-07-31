export type AuthErrorCode =
  | "config"
  | "unauthenticated"
  | "expired"
  | "no_profile"
  | "no_membership"
  | "no_family"
  | "no_settings"
  | "callback_failed"
  | "magic_link_failed"
  | "invalid_email"
  | "setup_required";

export class AuthIdentityError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthIdentityError";
    this.code = code;
  }
}

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  config:
    "Sign-in is not configured yet. Ask an administrator to set Supabase environment variables.",
  unauthenticated: "Please sign in to continue.",
  expired: "Your session has expired. Please sign in again.",
  no_profile:
    "Your account is signed in, but a profile could not be found. Contact the family administrator.",
  no_membership:
    "Your account is signed in, but it is not linked to the Turner Family yet. Ask an administrator to run the family setup.",
  no_family:
    "Your family record is missing. Ask an administrator to run the family setup.",
  no_settings:
    "Family settings are missing. Ask an administrator to run the family setup.",
  callback_failed: "We could not complete sign-in. Please request a new magic link.",
  magic_link_failed:
    "If that email can receive mail, a sign-in link will arrive shortly. Check your inbox.",
  invalid_email: "Enter a valid email address.",
  setup_required:
    "Authentication is ready, but family membership is not set up yet.",
};

export function publicAuthMessage(code: AuthErrorCode | string | null | undefined) {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code as AuthErrorCode] ?? "Something went wrong. Please try again.";
}
