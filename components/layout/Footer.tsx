import Link from "next/link";
import { Instagram } from "lucide-react";
import { Logo } from "./Logo";
import { nav } from "@/lib/content";
import { SITE } from "@/lib/constants";
import type { NavLink } from "@/types";

function FooterCol({ title, links }: { title: string; links: NavLink[] }) {
  return (
    <div>
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-3">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-ink-2 no-underline hover:text-brand">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const f = nav.footer;
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="container-px py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-2">
              Pocket-sized odor killer for your clothes. Built in {SITE.city},
              India.
            </p>
            <a
              href={SITE.instagram}
              className="mt-4 inline-flex items-center gap-2 text-sm text-ink-2 no-underline hover:text-brand"
            >
              <Instagram className="h-4 w-4" aria-hidden /> {SITE.instagramHandle}
            </a>
          </div>
          <FooterCol title="Shop" links={f.shop as NavLink[]} />
          <FooterCol title="Learn" links={f.learn as NavLink[]} />
          <FooterCol title="Support" links={f.support as NavLink[]} />
          <FooterCol title="Legal" links={f.legal as NavLink[]} />
        </div>

        <div className="mt-10 border-t border-border pt-6 text-sm text-ink-3">
          <p className="mb-2 max-w-3xl">
            ODORSTRIKE is a fabric freshener for use on clothing only. Not a
            cosmetic, deodorant, or skin product. For use on fabrics and clothing
            only — not for application to skin.
          </p>
          <p>
            © {new Date().getFullYear()} {SITE.name}, {SITE.city},{" "}
            {SITE.region}, {SITE.country}. All prices inclusive of taxes.
          </p>
        </div>
      </div>
    </footer>
  );
}
