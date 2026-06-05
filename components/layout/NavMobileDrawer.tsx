"use client";

import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { LinkButton } from "@/components/ui/Button";
import { useUIStore } from "@/lib/ui-store";
import { nav } from "@/lib/content";
import { SITE } from "@/lib/constants";
import type { NavLink } from "@/types";

export function NavMobileDrawer() {
  const open = useUIStore((s) => s.mobileNavOpen);
  const close = useUIStore((s) => s.closeMobileNav);
  const links = nav.primary as NavLink[];

  return (
    <Drawer open={open} onClose={close} side="left" title="Menu">
      <nav aria-label="Mobile" className="flex h-full flex-col p-5">
        <LinkButton href="/product/odorstrike" size="lg" fullWidth onClick={close}>
          Shop ODORSTRIKE — ₹229
        </LinkButton>

        <ul className="mt-6 flex flex-col gap-1">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={close}
                className="block rounded-lg px-3 py-3 font-display text-lg font-semibold text-ink no-underline hover:bg-surface"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/contact"
              onClick={close}
              className="block rounded-lg px-3 py-3 font-display text-lg font-semibold text-ink no-underline hover:bg-surface"
            >
              Contact
            </Link>
          </li>
        </ul>

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-5 text-ink-2">
          <a
            href={SITE.instagram}
            className="inline-flex items-center gap-2 no-underline"
          >
            <Instagram className="h-4 w-4" aria-hidden /> {SITE.instagramHandle}
          </a>
          <a
            href={`mailto:${SITE.email}`}
            className="inline-flex items-center gap-2 no-underline"
          >
            <Mail className="h-4 w-4" aria-hidden /> {SITE.email}
          </a>
        </div>
      </nav>
    </Drawer>
  );
}
