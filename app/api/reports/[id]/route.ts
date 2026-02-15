export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/security";
import { ReportStatus } from "@prisma/client";

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> };

async function readId(ctx: Ctx): Promise<string | undefined> {
  const p = await (ctx as any).params; // supports params as object or Promise
  return p?.id as string | undefined;
}

// GET single report (admin use: includes decrypted thread)
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const id = await readId(ctx);

    if (!id) {
      return NextResponse.json({ error: "Missing report id." }, { status: 400 });
    }

    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        riskLevel: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        encryptedContent: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            sender: true,
            encryptedContent: true,
            createdAt: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // decrypt thread messages
    const messages = (report.messages ?? []).map((m) => ({
      id: m.id,
      sender: m.sender,
      createdAt: m.createdAt,
      message: decryptText(m.encryptedContent),
    }));

    // fallback for older reports (if messages are empty)
    const fallbackFirst = decryptText(report.encryptedContent);

    return NextResponse.json({
      report: {
        id: report.id,
        category: report.category,
        riskLevel: report.riskLevel,
        status: report.status,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        message: messages[0]?.message ?? fallbackFirst, // keep compatibility
        messages: messages.length ? messages : [
          {
            id: "legacy",
            sender: "REPORTER",
            createdAt: report.createdAt,
            message: fallbackFirst,
          },
        ],
      },
    });
  } catch (e: any) {
    console.error("GET /api/reports/[id] failed:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}

// PATCH update status (admin action)
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const id = await readId(ctx);

    if (!id) {
      return NextResponse.json({ error: "Missing report id." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body?.status as ReportStatus | undefined;

    const allowed: ReportStatus[] = ["NEW", "IN_REVIEW", "RESOLVED"];
    if (!status || !allowed.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Use one of: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await prisma.report.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        category: true,
        riskLevel: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        encryptedContent: true,
      },
    });

    return NextResponse.json({
      report: {
        id: updated.id,
        category: updated.category,
        riskLevel: updated.riskLevel,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        message: decryptText(updated.encryptedContent),
      },
    });
  } catch (e: any) {
    console.error("PATCH /api/reports/[id] failed:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}