import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, isAdminCookieValue } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Report = {
  id: string;
  category: string;
  riskLevel: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminPage() {
  const cookieStore = await cookies(); // ✅ Next.js 16 needs await
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!isAdminCookieValue(token)) {
    redirect("/admin/login");
  }

  const reports: Report[] = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      category: true,
      riskLevel: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Admin Dashboard</h1>

        <div style={{ marginLeft: "auto" }}>
          <a href="/api/admin/logout" style={{ fontSize: 14 }}>
            Logout
          </a>
        </div>
      </div>

      <p style={{ opacity: 0.7, marginTop: 8 }}>Latest reports (metadata only).</p>

      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        {reports.length === 0 ? (
          <div>No reports yet.</div>
        ) : (
          reports.map((r) => (
            <Link
              key={r.id}
              href={`/admin/${r.id}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 14,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {r.category} • Risk: {r.riskLevel} • Status: {r.status}
                </div>

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  ID: {r.id} • {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}