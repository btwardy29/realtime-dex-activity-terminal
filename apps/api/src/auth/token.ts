import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthSession } from "@rdat/types";

const encoder = new TextEncoder();

export function signSession(session: AuthSession, secret: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = sign(`${header}.${payload}`, secret);

  return `${header}.${payload}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): AuthSession | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  const expected = sign(`${parts[0]}.${parts[1]}`, secret);
  if (!safeEqual(parts[2], expected)) {
    return null;
  }

  const parsed = parseSession(base64UrlDecode(parts[1]));
  if (!parsed || Date.parse(parsed.expiresAt) <= Date.now()) {
    return null;
  }

  return parsed;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  return timingSafeEqual(aBytes, bBytes);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function parseSession(value: string): AuthSession | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isSessionRecord(parsed)) {
    return null;
  }

  return parsed;
}

function isSessionRecord(value: unknown): value is AuthSession {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    "walletAddress" in value &&
    "expiresAt" in value &&
    typeof value.userId === "string" &&
    typeof value.walletAddress === "string" &&
    typeof value.expiresAt === "string"
  );
}
