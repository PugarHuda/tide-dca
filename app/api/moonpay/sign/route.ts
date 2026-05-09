/**
 * MoonPay signed-URL endpoint.
 *
 * MoonPay's secure mode requires every onramp URL to carry an HMAC-SHA256
 * signature derived with the project's secret key. This endpoint takes the
 * client-built URL, signs the query string, and returns the URL with the
 * signature appended — keeping the secret key server-side at all times.
 *
 * Without this endpoint, the MoonPay button only works in sandbox /
 * unsigned mode (capped at $100/transaction). Production traffic requires
 * signed URLs.
 *
 * Reference: https://dev.moonpay.com/docs/ramps-sdk-buy-url-signature
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { buildMoonPayUrl } from "@/lib/moonpay";

export const runtime = "nodejs";

type SignRequestBody = {
  walletAddress: string;
  baseCurrencyAmount?: number;
  redirectURL?: string;
};

const ALLOWED_AMOUNT_MAX = 10_000;

export async function POST(req: Request) {
  let body: SignRequestBody;
  try {
    body = (await req.json()) as SignRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.walletAddress !== "string" || body.walletAddress.length < 32) {
    return NextResponse.json(
      { error: "walletAddress required" },
      { status: 400 },
    );
  }

  // Sanity-bound the amount so a leaky frontend can't request a $1M
  // signed onramp by mistake. Real prod limits live in the MoonPay
  // dashboard; this is just a defensive cap.
  if (
    body.baseCurrencyAmount !== undefined &&
    (body.baseCurrencyAmount < 1 || body.baseCurrencyAmount > ALLOWED_AMOUNT_MAX)
  ) {
    return NextResponse.json(
      { error: `Amount must be between 1 and ${ALLOWED_AMOUNT_MAX}` },
      { status: 400 },
    );
  }

  const secret = process.env.MOONPAY_SECRET_KEY;
  const url = buildMoonPayUrl({
    walletAddress: body.walletAddress,
    baseCurrencyAmount: body.baseCurrencyAmount,
    redirectURL: body.redirectURL,
  });

  // No API key configured — return 503 so the client can surface a
  // "MoonPay not configured" state instead of opening a broken page.
  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        error: "MoonPay API key not configured for this deployment",
        configured: false,
      },
      { status: 503 },
    );
  }

  // API key set but no secret — return unsigned URL for sandbox dev.
  if (!secret) {
    return NextResponse.json({ url, signed: false });
  }

  // MoonPay signature: HMAC-SHA256 of the url's query string (i.e., the
  // part after `?`), base64-encoded, then URL-encoded into `signature` param.
  const queryStart = url.indexOf("?");
  if (queryStart === -1) {
    return NextResponse.json(
      { error: "Built URL missing query string" },
      { status: 500 },
    );
  }
  const querySegment = url.substring(queryStart);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(querySegment)
    .digest("base64");

  const signedUrl = `${url}&signature=${encodeURIComponent(signature)}`;
  return NextResponse.json({ url: signedUrl, signed: true });
}
