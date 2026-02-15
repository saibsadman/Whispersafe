export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url));

  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}