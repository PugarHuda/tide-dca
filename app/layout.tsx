import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/lib/providers";
import { Nav } from "@/components/nav";
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

export const metadata: Metadata = {
  title: "Tide — DCA without MEV",
  description:
    "Hidden-Liquidity DCA Pool for Solana. Encrypted intents via Arcium MPC, aggregate execute via Jupiter, pro-rata distribute. Bots blind, retail wins.",
  metadataBase: new URL("https://tide.fun"),
  openGraph: {
    title: "Tide — DCA without MEV",
    description: "Hidden-Liquidity DCA Pool for Solana.",
    url: "https://tide.fun",
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
            <div className="shell">
              <Nav />
              {children}
            </div>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
