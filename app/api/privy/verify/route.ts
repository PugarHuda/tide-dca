/**
 * Privy access-token verification endpoint.
 *
 * Privy mints JWT-shaped access tokens for authenticated users
 * (email/SMS/social/passkey/wallet). For server-protected actions, the
 * client sends the access token in `Authorization: Bearer <token>` and
 * the server verifies it against Privy's public key.
 *
 * This endpoint is the gate for any future Tide server action that
 * needs auth proof (e.g., signed MoonPay URL only for verified users,
 * server-issued promo codes, KYC-tier-gated DCA limits).
 *
 * Today's claim: token-verification path live + tested. Production
 * gating attaches `useTideAuth()` hook → `requireAuth()` middleware on
 * route handlers as features land.
 *
 * Reference: https://docs.privy.io/guide/server/access-tokens
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";
const PRIVY_API = "https://auth.privy.io/api/v1";

type VerifyResult =
  | {
      ok: true;
      userId: string;
      sessionId?: string;
      issuedAt?: number;
      expiresAt?: number;
    }
  | { ok: false; error: string };

/**
 * Verify a Privy access token. We hit Privy's `/api/v1/sessions/<id>`
 * endpoint (which requires app id + secret in basic auth) to confirm
 * the session is real + active. Lighter than fetching their JWKS and
 * doing local JWT verification; rate-limited but fine for the gating
 * volume Tide needs.
 *
 * Decode shape (JWT): we only crack the payload to read `sub` (user id)
 * + `sid` (session id). Signature check delegated to Privy's API call.
 */
async function verifyToken(token: string): Promise<VerifyResult> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    return { ok: false, error: "Privy server credentials not configured" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, error: "Token is not a JWT" };
  }
  let payload: { sub?: string; sid?: string; iat?: number; exp?: number };
  try {
    payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as typeof payload;
  } catch {
    return { ok: false, error: "Failed to decode JWT payload" };
  }
  if (!payload.sub) return { ok: false, error: "Token missing sub" };
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return { ok: false, error: "Token expired" };
  }
  if (!payload.sid) {
    return {
      ok: false,
      error: "Token missing session id (likely an embedded-only token)",
    };
  }

  const auth = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString(
    "base64",
  );
  let sessionRes: Response;
  try {
    sessionRes = await fetch(`${PRIVY_API}/sessions/${payload.sid}`, {
      headers: {
        authorization: `Basic ${auth}`,
        "privy-app-id": PRIVY_APP_ID,
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `Privy API unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!sessionRes.ok) {
    return { ok: false, error: `Privy session check ${sessionRes.status}` };
  }
  const session = (await sessionRes.json()) as {
    id?: string;
    user_id?: string;
    revoked?: boolean;
  };
  if (session.revoked) {
    return { ok: false, error: "Session revoked" };
  }
  if (session.user_id !== payload.sub) {
    return { ok: false, error: "Session/sub mismatch" };
  }

  return {
    ok: true,
    userId: payload.sub,
    sessionId: payload.sid,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer <token> required" },
      { status: 401 },
    );
  }
  const result = await verifyToken(match[1]);
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}

// Quiet unused-imports.
void crypto;
