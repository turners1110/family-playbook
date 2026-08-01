export type MagicLinkResult =
  | { ok: true; message: string }
  | { ok: false; code: "invalid_email" | "config" | "magic_link_failed"; message: string };
