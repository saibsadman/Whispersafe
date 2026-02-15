export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ADMIN_COOKIE, makeAdminToken } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const key = (body?.key ?? "").toString();

  if (!process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "ADMIN_KEY missing in .env" }, { status: 500 });
  }

  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return res;
}