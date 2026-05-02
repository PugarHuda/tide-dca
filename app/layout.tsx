import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tide — DCA Without MEV",
  description:
    "Hidden-Liquidity DCA Pool for Solana. Encrypted intents via Arcium, aggregate execute via Jupiter, pro-rata distribute. Bots blind, retail wins.",
  metadataBase: new URL("https://tide.fun"),
  openGraph: {
    title: "Tide — DCA Without MEV",
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
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
