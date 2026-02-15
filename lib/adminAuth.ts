import crypto from "crypto";

export const ADMIN_COOKIE = "ws_admin";
const MSG = "whispersafe-admin-v1";

function mustAdminKey(): string {
  const k = process.env.ADMIN_KEY;
  if (!k) throw new Error("ADMIN_KEY missing in .env");
  return k;
}

export function makeAdminToken(): string {
  // stable token derived from ADMIN_KEY (cookie never stores the raw key)
  return crypto.createHmac("sha256", mustAdminKey()).update(MSG).digest("base64url");
}

export function isAdminCookieValue(value?: string): boolean {
  if (!value) return false;
  const expected = makeAdminToken();

  // timing-safe compare
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function adminCookieFromHeader(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((s) => s.trim());
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === ADMIN_COOKIE) return rest.join("=");
  }
  return undefined;
}

export function isAdminRequest(req: Request): boolean {
  const v = adminCookieFromHeader(req.headers.get("cookie"));
  return isAdminCookieValue(v);
}