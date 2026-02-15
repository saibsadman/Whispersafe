export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackingHash } from "@/lib/security";
import { isAdminRequest } from "@/lib/adminAuth";

export async function GET(req: Request) {
  try {
    // must be logged in as admin
    if (!isAdminRequest(req)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    const url = new URL(req.url);
    const tRaw = (url.searchParams.get("t") ?? "").trim();

    if (!tRaw) {
      return NextResponse.redirect(new URL("/admin?lookup=missing", req.url));
    }

    const trackingId = tRaw.toUpperCase();
    const tHash = trackingHash(trackingId);

    const found = await prisma.report.findUnique({
      where: { trackingHash: tHash },
      select: { id: true },
    });

    if (!found) {
      return NextResponse.redirect(
        new URL(`/admin?lookup=notfound&t=${encodeURIComponent(trackingId)}`, req.url)
      );
    }

    // redirect to report details
    return NextResponse.redirect(new URL(`/admin/${found.id}`, req.url));
  } catch (e: any) {
    console.error("GET /api/admin/lookup failed:", e);
    return NextResponse.redirect(new URL("/admin?lookup=error", req.url));
  }
}