"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { NAV_ITEMS } from "@/lib/constants/enums";
import {
  isElementFullyVisibleHorizontally,
  isNavItemActive,
  navScrollBehavior,
} from "@/lib/ui/active-nav";

export function PrimaryNav() {
  const pathname = usePathname() ?? "";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = activeRef.current;
    if (!scroller || !active) return;
    if (
      isElementFullyVisibleHorizontally(
        active.getBoundingClientRect(),
        scroller.getBoundingClientRect(),
      )
    ) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    active.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: navScrollBehavior(reduce),
    });
  }, [pathname]);

  return (
    <nav aria-label="Primary" className="border-t border-border/60">
      <div
        ref={scrollerRef}
        className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-2 scrollbar-none"
      >
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={active ? activeRef : undefined}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "min-h-11 whitespace-nowrap rounded-full px-3 py-2 text-sm transition",
                active
                  ? "bg-accent-soft font-semibold text-ink underline decoration-2 underline-offset-4 ring-1 ring-accent/35"
                  : "font-medium text-ink-muted hover:bg-bg-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
