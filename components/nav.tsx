"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ConnectButton } from "./connect-button";
import { TideMark } from "./tide-mark";
import { CURRENT_NETWORK } from "@/lib/constants";

const LINKS = [
  { href: "/setup", label: "Setup" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin", label: "Admin" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change so the user sees the new page,
  // not the open hamburger.
  useEffect(() => {
    setMenuOpen(false);
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
