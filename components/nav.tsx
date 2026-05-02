import Link from "next/link";
import { ConnectButton } from "./connect-button";

export function Nav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-mono text-lg">
          <span className="text-cyan-400">≈</span>
          <span className="font-semibold">tide</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/setup"
            className="text-zinc-400 transition hover:text-zinc-100"
          >
            Setup DCA
          </Link>
          <Link
            href="/dashboard"
            className="text-zinc-400 transition hover:text-zinc-100"
          >
            Dashboard
          </Link>
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
