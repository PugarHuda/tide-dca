"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { ConnectButton } from "./connect-button";
import { TideMark } from "./tide-mark";
import { CURRENT_NETWORK } from "@/lib/constants";

// Cast href as Route<string> so newly-added routes (e.g. /demo) compile
// before `next build` regenerates the full typed-routes manifest. The
// runtime resolves these correctly via the actual app/ directory; the
// cast just satisfies the static typed-routes check.
//
// /admin restored to primary nav — operator needs quick access. Retail
// visitors who click it see a clear "read-only" banner unless their
// wallet matches pool.authority (gate added in app/admin/page.tsx), so
// no confusion or accidental destructive actions.
const LINKS: { href: Route; label: string }[] = [
  { href: "/demo" as Route, label: "Demo" },
  { href: "/setup" as Route, label: "Setup" },
  { href: "/dashboard" as Route, label: "Dashboard" },
  { href: "/admin" as Route, label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  // Close mobile menu on route change so the user sees the new page,
  // not the open hamburger.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Show a sticky "Start DCA" CTA in the nav once the user has scrolled
  // past the hero on the landing page. Hides on every other route since
  // the CTA only makes sense on the marketing page.
  useEffect(() => {
    if (pathname !== "/") {
      setScrolledPastHero(false);
      return;
    }
    const onScroll = () => {
      setScrolledPastHero(window.scrollY > window.innerHeight * 0.7);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <nav className="nav">
      <Link href="/" className="nav__brand">
        <TideMark />
        <span>Tide</span>
      </Link>
      <div className="nav__links nav__links--desktop">
        {LINKS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="nav__link"
            data-active={pathname === it.href}
          >
            {it.label}
          </Link>
        ))}
      </div>
      <div className="nav__spacer" />
      {pathname === "/" && (
        <Link
          href="/setup"
          className="btn btn--primary btn--sm nav__cta"
          data-visible={scrolledPastHero}
        >
          Start DCA
        </Link>
      )}
      <span className="nav__net">solana {CURRENT_NETWORK}</span>
      <ConnectButton />
      <button
        type="button"
        className="nav__burger"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        <span data-open={menuOpen} />
        <span data-open={menuOpen} />
        <span data-open={menuOpen} />
      </button>

      {menuOpen && (
        <div className="nav__drawer" role="menu">
          {LINKS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="nav__drawer-link"
              data-active={pathname === it.href}
              onClick={() => setMenuOpen(false)}
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
