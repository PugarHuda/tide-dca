"use client";

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
  return (
    <nav className="nav">
      <Link href="/" className="nav__brand">
        <TideMark />
        <span>Tide</span>
      </Link>
      <div className="nav__links">
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
    </nav>
  );
}
