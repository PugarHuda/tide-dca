/**
 * MoonPay widget URL builder.
 *
 * Surface: a "Top up via MoonPay" button on /setup + /dashboard. Clicking
 * opens MoonPay's hosted onramp in a new tab (or modal — caller's choice)
 * pre-filled with the user's connected wallet address as recipient.
 *
 * MoonPay supports two integration modes:
 *   - Sandbox / unsigned: works with NEXT_PUBLIC_MOONPAY_API_KEY only,
 *     fine for testnet + demo. Limit: $100/transaction.
 *   - Production / signed: requires server-side signing of the URL with
 *     MOONPAY_SECRET_KEY. We don't sign here — when going to production,
 *     wrap this builder behind a server action that returns a signed URL.
 *
 * Acquisition note (newsletter context, May 2026): MoonPay acquired DFlow
 * in a $100M deal, making them the aggregator powering Phantom + Solflare +
 * Coinbase + Kamino. That means Phantom users already see MoonPay surfaces
 * inside their wallet — Tide's MoonPay button is a reinforcing path, not a
 * net-new integration step for those users.
 *
 * Docs: https://dev.moonpay.com/docs/ramps-sdk-buy-url
 */

export type MoonPayParams = {
  /** Recipient wallet pubkey (where USDC arrives). */
  walletAddress: string;
  /** Optional pre-filled USD amount (e.g., 50 → user lands on $50 quote). */
  baseCurrencyAmount?: number;
  /** Optional redirect after purchase completes. */
  redirectURL?: string;
};

const MOONPAY_BUY_URL = "https://buy.moonpay.com";
const MOONPAY_SANDBOX_URL = "https://buy-sandbox.moonpay.com";

/** Returns a fully-formed MoonPay onramp URL. Sandbox if no real key. */
export function buildMoonPayUrl(params: MoonPayParams): string {
  const apiKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY ?? "";
  const isSandbox = !apiKey || apiKey.startsWith("pk_test_");
  const base = isSandbox ? MOONPAY_SANDBOX_URL : MOONPAY_BUY_URL;

  const search = new URLSearchParams({
    apiKey: apiKey || "pk_test_demo",
    currencyCode: "usdc_sol",
    walletAddress: params.walletAddress,
    baseCurrencyCode: "usd",
    showWalletAddressForm: "false",
  });

  if (params.baseCurrencyAmount !== undefined) {
    search.set("baseCurrencyAmount", String(params.baseCurrencyAmount));
  }
  if (params.redirectURL) {
    search.set("redirectURL", params.redirectURL);
  }

  return `${base}?${search.toString()}`;
}

/** True when an API key is configured — used to gate the button if absent. */
export function moonPayConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_MOONPAY_API_KEY;
}
