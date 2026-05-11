import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Analytics } from "@vercel/analytics/next";

import { Providers } from "@/lib/providers";
import { Nav } from "@/components/nav";
import { NetworkBanner } from "@/components/network-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Use Vercel-injected URL when deployed, fallback to placeholder for local
// dev. tide.fun is the target domain post-mainnet — until then OG previews
// resolve to the live Vercel deployment so social shares render correctly.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://tide-dca.vercel.app");

export const metadata: Metadata = {
  title: "Tide — DCA without MEV",
  description:
    "Hidden-Liquidity DCA Pool for Solana. Encrypted intents via Arcium MPC, aggregate execute via Jupiter, pro-rata distribute. Bots blind, retail wins.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Tide — DCA without MEV",
    description: "Hidden-Liquidity DCA Pool for Solana.",
    url: SITE_URL,
    siteName: "Tide",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tide",
    description: "Hidden-Liquidity DCA Pool. Bots blind, retail wins.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <Providers>
          <ToastProvider>
            <ErrorBoundary>
              <div className="shell">
                <Nav />
                <NetworkBanner />
                {children}
              </div>
            </ErrorBoundary>
          </ToastProvider>
        </Providers>
        {/* Vercel Analytics — free on hobby plan. Tracks page views +
            referrers without cookies or PII. Useful post-submission to
            see which routes judges engage with. */}
        <Analytics />
      </body>
    </html>
  );
}
