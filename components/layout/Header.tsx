"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "./Logo";
import { CartButton } from "./CartButton";
import { NavMobileDrawer } from "./NavMobileDrawer";
import { useUIStore } from "@/lib/ui-store";
import { nav } from "@/lib/content";
import { cn } from "@/lib/utils";
import type { NavLink } from "@/types";

export function Header() {
  const openMobileNav = useUIStore((s) => s.openMobileNav);
  const [scrolled, setScrolled] = React.useState(false);
  const pathname = usePathname();
  const links = nav.primary as NavLink[];

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-bg/95 backdrop-blur transition-shadow",
        scrolled && "shadow-header"
      )}
    >
      <div className="container-px flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openMobileNav}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-surface lg:hidden"
            aria-label="Open menu"
            aria-expanded={false}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <Logo />
        </div>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => {
              const active =
                pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-lg px-3 py-2 font-medium no-underline transition-colors hover:bg-surface hover:text-brand",
                      active ? "text-brand" : "text-ink"
                    )}
                  >
                    {l.label}
                    {active && (
                      <span
                        aria-hidden
                        className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href="/contact"
            className="hidden rounded-lg px-3 py-2 font-medium text-ink no-underline hover:bg-surface hover:text-brand sm:inline-block"
          >
            Contact
          </Link>
          <CartButton />
        </div>
      </div>
      <NavMobileDrawer />
    </header>
  );
}
