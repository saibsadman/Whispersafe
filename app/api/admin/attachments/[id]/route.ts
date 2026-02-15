export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/adminAuth";
import { readDecryptedUpload, safeName } from "@/lib/attachments";

// Next.js may pass params as a Promise
type Ctx = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(req: Request, ctx: Ctx) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const p = await Promise.resolve(ctx.params);
    const id = p?.id?.toString().trim();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const a = await prisma.reportAttachment.findUnique({
      where: { id },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        storagePath: true,
      },
    });

    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const bytes = await readDecryptedUpload(a.storagePath);

    const filename = safeName(a.originalName || "attachment");

    // ✅ TS-safe in every setup (removes the red underline)
    return new Response(bytes as any, {
      status: 200,
      headers: {
        "Content-Type": a.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("GET /api/admin/attachments/[id] failed:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}