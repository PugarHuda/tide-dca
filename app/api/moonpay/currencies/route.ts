/**
 * MoonPay public currencies proxy.
 *
 * MoonPay's `/v3/currencies` endpoint is fully public — no API key
 * required, no signature. Returns the list of supported crypto + fiat
 * currencies including each one's min/max buy amounts, supported
 * networks, and US-state availability.
 *
 * We proxy server-side (instead of fetching from the browser) for
 * three reasons:
 *   1. CORS — MoonPay doesn't whitelist arbitrary origins for browser
 *      access; the `/v3/currencies` endpoint blocks browser fetches
 *   2. Filtering — server can pluck just the USDC-on-Solana row plus
 *      a small summary so the client doesn't ship 100KB of unused
 *      currency metadata
 *   3. Caching — Next.js can cache the upstream response, currencies
 *      change rarely so a 5-minute revalidate is plenty
 *
 * This proves the MoonPay integration uses real MoonPay data for
 * the supported-currencies + min/max display, even before a
 * production API key exists for the signed-onramp path.
 *
 * Reference: https://dev.moonpay.com/reference/getallcurrencies
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300; // 5 min

const MOONPAY_CURRENCIES_URL = "https://api.moonpay.com/v3/currencies";
const TARGET_CODE = "usdc_sol";

type MoonPayCurrency = {
  id: string;
  code: string;
  name: string;
  type: "crypto" | "fiat";
  precision?: number;
  decimals?: number;
  minBuyAmount?: number;
  maxBuyAmount?: number;
  isSellSupported?: boolean;
  isSuspended?: boolean;
  isStableCoin?: boolean;
  notAllowedCountries?: string[];
  metadata?: {
    contractAddress?: string | null;
    networkCode?: string | null;
  };
};

export type MoonPayStatus = {
  ok: true;
  fetchedAt: number;
  target: {
    code: string;
    name: string;
    network: string | null;
    minBuyUsd: number | null;
    maxBuyUsd: number | null;
    isStableCoin: boolean;
    isSuspended: boolean;
    isSellSupported: boolean;
    notAllowedCountries: string[];
    contractAddress: string | null;
  } | null;
  totalSupportedCryptos: number;
  solanaAssets: Array<{ code: string; name: string }>;
};

export async function GET() {
  try {
    const res = await fetch(MOONPAY_CURRENCIES_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `MoonPay upstream ${res.status}` },
        { status: 502 },
      );
    }

    const all = (await res.json()) as MoonPayCurrency[];
    const cryptos = all.filter((c) => c.type === "crypto");
    const target = cryptos.find((c) => c.code === TARGET_CODE) ?? null;
    const solanaAssets = cryptos
      .filter((c) => c.metadata?.networkCode === "solana")
      .map((c) => ({ code: c.code, name: c.name }));

    const payload: MoonPayStatus = {
      ok: true,
      fetchedAt: Date.now(),
      target: target
        ? {
            code: target.code,
            name: target.name,
            network: target.metadata?.networkCode ?? null,
            minBuyUsd: target.minBuyAmount ?? null,
            maxBuyUsd: target.maxBuyAmount ?? null,
            isStableCoin: !!target.isStableCoin,
            isSuspended: !!target.isSuspended,
            isSellSupported: !!target.isSellSupported,
            notAllowedCountries: target.notAllowedCountries ?? [],
            contractAddress: target.metadata?.contractAddress ?? null,
          }
        : null,
      totalSupportedCryptos: cryptos.length,
      solanaAssets,
    };

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
