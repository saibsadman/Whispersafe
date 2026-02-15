export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptText, encryptText, trackingHash } from "@/lib/security";
import { MessageSender } from "@prisma/client";
import { saveEncryptedUpload } from "@/lib/attachments";

function cleanTrackingId(raw: string) {
  // Accept user pastes: "SLNIWFJ6YSB_ (Risk: LOW)" -> keep first token
  return raw.trim().split(/\s+/)[0].replace(/[^A-Za-z0-9_-]/g, "");
}

function isMultipart(req: Request) {
  const ct = req.headers.get("content-type") || "";
  return ct.includes("multipart/form-data");
}

function safeDecrypt(s: string) {
  try {
    return decryptText(s);
  } catch {
    return "(Could not decrypt message)";
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const t = url.searchParams.get("t") ?? url.searchParams.get("trackingId") ?? "";
    const trackingId = cleanTrackingId(t);

    if (!trackingId) {
      return NextResponse.json({ error: "Missing trackingId. Use ?t=XXXX" }, { status: 400 });
    }

    const th = trackingHash(trackingId);

    const report = await prisma.report.findUnique({
      where: { trackingHash: th },
      select: {
        id: true,
        category: true,
        riskLevel: true,
        status: true,
        isLocked: true,
        lockedAt: true,
        escalatedAt: true,
        createdAt: true,
        updatedAt: true,
        encryptedContent: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const msgs = await prisma.reportMessage.findMany({
      where: { reportId: report.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, sender: true, encryptedContent: true, createdAt: true },
    });

    // attachments metadata (no decrypt/download for reporter)
    const attachments = await prisma.reportAttachment.findMany({
      where: { reportId: report.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        uploader: true,
        messageId: true,
      },
    });

    // fallback for old reports created before ReportMessage existed
    const messages =
      msgs.length > 0
        ? msgs.map((m) => ({
            id: m.id,
            sender: m.sender,
            message: safeDecrypt(m.encryptedContent),
            createdAt: m.createdAt,
          }))
        : [
            {
              id: "legacy-first",
              sender: MessageSender.REPORTER,
              message: safeDecrypt(report.encryptedContent),
              createdAt: report.createdAt,
            },
          ];

    return NextResponse.json({
      report: {
        category: report.category,
        riskLevel: report.riskLevel,
        status: report.status,
        isLocked: report.isLocked,
        lockedAt: report.lockedAt,
        escalatedAt: report.escalatedAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
      messages,
      attachments,
    });
  } catch (e: any) {
    console.error("GET /api/followup failed:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let trackingId = "";
    let message = "";
    let files: File[] = [];

    if (isMultipart(req)) {
      const fd = await req.formData();
      trackingId = cleanTrackingId((fd.get("trackingId") ?? "").toString());
      message = (fd.get("message") ?? "").toString().trim();

      const all = fd.getAll("files");
      files = all.filter((x): x is File => typeof x === "object" && x instanceof File);
    } else {
      const body = await req.json().catch(() => ({}));
      trackingId = cleanTrackingId((body?.trackingId ?? "").toString());
      message = (body?.message ?? "").toString().trim();
    }

    if (!trackingId) {
      return NextResponse.json({ error: "Missing trackingId." }, { status: 400 });
    }

    // allow either message OR attachments
    if ((!message || message.length < 5) && files.length === 0) {
      return NextResponse.json(
        { error: "Message must be at least 5 characters (or attach a file)." },
        { status: 400 }
      );
    }

    if (files.length > 3) {
      return NextResponse.json({ error: "Max 3 attachments allowed." }, { status: 400 });
    }

    const th = trackingHash(trackingId);

    const report = await prisma.report.findUnique({
      where: { trackingHash: th },
      select: { id: true, isLocked: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    // ✅ Lockdown enforcement
    if (report.isLocked) {
      return NextResponse.json(
        { error: "This report is in lockdown. Follow-up is temporarily disabled." },
        { status: 423 }
      );
    }

    // Create message only if provided
    let messageId: string | null = null;
    if (message && message.length >= 5) {
      const created = await prisma.reportMessage.create({
        data: {
          reportId: report.id,
          sender: MessageSender.REPORTER,
          encryptedContent: encryptText(message),
        },
        select: { id: true },
      });
      messageId = created.id;
    }

    // Save attachments if provided
    if (files.length) {
      const saved = await Promise.all(files.map(saveEncryptedUpload));
      await prisma.reportAttachment.createMany({
        data: saved.map((s) => ({
          reportId: report.id,
          messageId,
          uploader: MessageSender.REPORTER,
          originalName: s.originalName,
          mimeType: s.mimeType,
          size: s.size,
          sha256: s.sha256,
          storagePath: s.storagePath,
        })),
      });
    }

    return NextResponse.json({ ok: true, attachments: files.length }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/followup failed:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}