export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackingHash } from "@/lib/security";

export async function GET() {
  return NextResponse.json({ ok: true, message: "Use POST with { trackingId } to check status." });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const trackingId = (body?.trackingId ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");

    if (!trackingId || trackingId.length < 6) {
      return NextResponse.json({ error: "Tracking ID is required." }, { status: 400 });
    }

    const tHash = trackingHash(trackingId);

    const report = await prisma.report.findUnique({
      where: { trackingHash: tHash },
      select: {
        id: true,
        category: true,
        riskLevel: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // IMPORTANT: do NOT return decrypted message here (public endpoint)
    return NextResponse.json({ report });
  } catch (e: any) {
    console.error("POST /api/status failed:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}