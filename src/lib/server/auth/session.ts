import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type SessionPayload = {
  userId: number;
  role: "admin" | "user";
  mustChangePassword: boolean;
};

const MIN_SECRET_LENGTH = 32;

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is not set");
}
if (process.env.SESSION_SECRET.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`
  );
}

const encodedKey = () => new TextEncoder().encode(process.env.SESSION_SECRET);
const SHORT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const LONG_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export async function encrypt(
  payload: SessionPayload,
  durationMs: number
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + durationMs) / 1000))
    .sign(encodedKey());
}

export async function decrypt(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "number" ||
      (payload.role !== "admin" && payload.role !== "user") ||
      typeof payload.mustChangePassword !== "boolean"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      role: payload.role,
      mustChangePassword: payload.mustChangePassword,
    };
  } catch {
    return null;
  }
}

export async function createSessionCookie(
  payload: SessionPayload,
  rememberMe = false
) {
  const durationMs = rememberMe
    ? LONG_SESSION_DURATION_MS
    : SHORT_SESSION_DURATION_MS;
  const expiresAt = new Date(Date.now() + durationMs);
  const token = await encrypt(payload, durationMs);
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
