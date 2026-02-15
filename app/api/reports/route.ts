export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptText, trackingId, trackingHash, riskExplain } from "@/lib/security";
import { isAdminRequest } from "@/lib/adminAuth";
import { MessageSender, ReportCategory, RiskLevel } from "@prisma/client";
import { saveEncryptedUpload } from "@/lib/attachments";

// Admin-only: list reports
export async function GET(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        category: true,
        riskLevel: true,
        riskReasonsJson: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ reports });
  } catch (e: any) {
    console.error("GET /api/reports failed:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}

function isMultipart(req: Request) {
  const ct = req.headers.get("content-type") || "";
  return ct.includes("multipart/form-data");
}

// Public: submit report + first message + optional attachments
export async function POST(req: Request) {
  try {
    let category: ReportCategory | undefined;
    let message = "";
    let files: File[] = [];

    if (isMultipart(req)) {
      const fd = await req.formData();
      category = (fd.get("category") ?? "").toString() as ReportCategory;
      message = (fd.get("message") ?? "").toString().trim();

      const all = fd.getAll("files");
      files = all.filter((x): x is File => typeof x === "object" && x instanceof File);
    } else {
      const body = await req.json();
      category = body.category as ReportCategory;
      message = (body.message ?? "").toString().trim();
    }

    if (!message || message.length < 10) {
      return NextResponse.json({ error: "Message must be at least 10 characters." }, { status: 400 });
    }

    const allowed: ReportCategory[] = ["HARASSMENT", "CORRUPTION", "ACADEMIC", "OTHER"];
    if (!allowed.includes(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }

    // limit attachments (safe)
    if (files.length > 3) {
      return NextResponse.json({ error: "Max 3 attachments allowed." }, { status: 400 });
    }

    const tId = trackingId();
    const tHash = trackingHash(tId);

    const encrypted = encryptText(message);
    const { riskLevel, reasons } = riskExplain(message);

    // 1) Create report
    const report = await prisma.report.create({
      data: {
        category,
        encryptedContent: encrypted,
        riskLevel: riskLevel as RiskLevel,
        riskReasonsJson: JSON.stringify(reasons ?? []),
        trackingHash: tHash,
      },
      select: { id: true },
    });

    // 2) Create first message (reporter)
    const msg = await prisma.reportMessage.create({
      data: {
        reportId: report.id,
        sender: MessageSender.REPORTER,
        encryptedContent: encrypted,
      },
      select: { id: true },
    });

    // 3) Save attachments (encrypted on disk) + DB rows
    if (files.length) {
      const saved = await Promise.all(files.map(saveEncryptedUpload));
      await prisma.reportAttachment.createMany({
        data: saved.map((s) => ({
          reportId: report.id,
          messageId: msg.id,
          uploader: MessageSender.REPORTER,
          originalName: s.originalName,
          mimeType: s.mimeType,
          size: s.size,
          sha256: s.sha256,
          storagePath: s.storagePath,
        })),
      });
    }

    return NextResponse.json(
      { trackingId: tId, riskLevel: riskLevel as string, attachments: files.length },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("POST /api/reports failed:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}