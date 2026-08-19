import { NAV_ITEMS } from "@/lib/constants/enums";

export type NavHref = (typeof NAV_ITEMS)[number]["href"];

/**
 * Longest-prefix match so nested routes highlight the section, not only exact paths.
 * `/questions/before-birth` wins over `/questions`.
 */
export function resolveActiveNavHref(pathname: string): NavHref | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (path === "/before-birth" || path.startsWith("/before-birth/")) {
    return "/questions/before-birth";
  }
  const ranked = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length);
  for (const item of ranked) {
    if (path === item.href || path.startsWith(`${item.href}/`)) {
      return item.href;
    }
  }
  return null;
}

export function isNavItemActive(href: string, pathname: string): boolean {
  return resolveActiveNavHref(pathname) === href;
}

export function navScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

export function isElementFullyVisibleHorizontally(
  element: { left: number; right: number },
  container: { left: number; right: number },
): boolean {
  return element.left >= container.left - 1 && element.right <= container.right + 1;
}
