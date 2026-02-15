import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import styles from "./admin.module.css";

import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, isAdminCookieValue } from "@/lib/adminAuth";
import { trackingHash } from "@/lib/security";
import { triageInfo } from "@/lib/triage";
import { MessageSender, ReportCategory, ReportStatus, RiskLevel } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

type ReportRow = {
  id: string;
  category: ReportCategory;
  riskLevel: RiskLevel;
  status: ReportStatus;
  riskReasonsJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type SortKey = "created_desc" | "created_asc" | "updated_desc" | "updated_asc" | "triage_desc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "triage_desc", label: "Triage priority (highest)" },
  { key: "created_desc", label: "Created (newest)" },
  { key: "created_asc", label: "Created (oldest)" },
  { key: "updated_desc", label: "Updated (newest)" },
  { key: "updated_asc", label: "Updated (oldest)" },
];

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function clampInt(v: string | undefined, def: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function cleanOpenInput(input: string) {
  // if user pastes "SLNI... (Risk: LOW)" keep first token only
  return input.split(/\s+/)[0].replace(/[^A-Za-z0-9_-]/g, "").trim();
}

function safeReasonCount(json: string) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

function sortToOrderBy(sort: SortKey) {
  switch (sort) {
    case "created_asc":
      return { createdAt: "asc" as const };
    case "updated_desc":
      return { updatedAt: "desc" as const };
    case "updated_asc":
      return { updatedAt: "asc" as const };
    // triage is handled in-memory (needs computed score)
    case "triage_desc":
    case "created_desc":
    default:
      return { createdAt: "desc" as const };
  }
}

type MsgMini = { reportId: string; sender: MessageSender; createdAt: Date };

function prioClass(p: "P0" | "P1" | "P2" | "P3") {
  if (p === "P0") return styles.prioP0;
  if (p === "P1") return styles.prioP1;
  if (p === "P2") return styles.prioP2;
  return styles.prioP3;
}

function slaClass(s: "RESOLVED" | "OVERDUE" | "DUE_SOON" | "OK") {
  if (s === "OVERDUE") return styles.slaOverdue;
  if (s === "DUE_SOON") return styles.slaSoon;
  if (s === "RESOLVED") return styles.slaResolved;
  return styles.slaOk;
}

export default async function AdminPage({ searchParams }: Props) {
  // --- auth ---
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isAdminCookieValue(token)) redirect("/admin/login");

  const sp = await Promise.resolve(searchParams);
  const now = new Date();

  // --- quick open ---
  const openRaw = (first(sp?.open) ?? "").toString().trim();
  const openInput = openRaw;
  const cleanedOpen = cleanOpenInput(openRaw);

  let openError: string | null = null;

  if (cleanedOpen) {
    // 1) try report id
    const direct = await prisma.report.findUnique({
      where: { id: cleanedOpen },
      select: { id: true },
    });

    if (direct) redirect(`/admin/${encodeURIComponent(direct.id)}`);

    // 2) try tracking id -> trackingHash
    const th = trackingHash(cleanedOpen);
    const byTracking = await prisma.report.findUnique({
      where: { trackingHash: th },
      select: { id: true },
    });

    if (byTracking) redirect(`/admin/${encodeURIComponent(byTracking.id)}`);

    openError = "Not found. Paste the admin Report ID (cml...) or the user's Tracking ID (12 chars).";
  }

  // --- filters ---
  const statusRaw = first(sp?.status);
  const categoryRaw = first(sp?.category);
  const riskRaw = first(sp?.risk);
  const q = (first(sp?.q) ?? "").toString().trim();

  const sortRaw = (first(sp?.sort) ?? "created_desc").toString() as SortKey;
  const sort: SortKey = SORTS.some((s) => s.key === sortRaw) ? sortRaw : "created_desc";

  const page = clampInt((first(sp?.page) ?? "1").toString(), 1, 1, 999);
  const take = 8;
  const skip = (page - 1) * take;

  const status =
    statusRaw && (Object.values(ReportStatus) as string[]).includes(statusRaw)
      ? (statusRaw as ReportStatus)
      : undefined;

  const category =
    categoryRaw && (Object.values(ReportCategory) as string[]).includes(categoryRaw)
      ? (categoryRaw as ReportCategory)
      : undefined;

  const risk =
    riskRaw && (Object.values(RiskLevel) as string[]).includes(riskRaw)
      ? (riskRaw as RiskLevel)
      : undefined;

  const where: any = {
    AND: [
      status ? { status } : {},
      category ? { category } : {},
      risk ? { riskLevel: risk } : {},
      q ? { id: { contains: q } } : {},
    ],
  };

  // --- snapshot cards (overall, not filtered) ---
  const [riskGroups, statusGroups] = await Promise.all([
    prisma.report.groupBy({ by: ["riskLevel"], _count: { _all: true } }),
    prisma.report.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const riskCount: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const g of riskGroups) riskCount[g.riskLevel] = g._count._all;

  const statusCount: Record<ReportStatus, number> = {
    NEW: 0,
    IN_REVIEW: 0,
    RESOLVED: 0,
    ESCALATED: 0,
  };
  for (const g of statusGroups) statusCount[g.status] = g._count._all;

  // --- list ---
  const MAX_TRIAGE_SCAN = 2000;

  const total = await prisma.report.count({ where });

  let reports: ReportRow[] = [];

  if (sort === "triage_desc") {
    // Pull a capped set, compute score, then paginate.
    const base = await prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(MAX_TRIAGE_SCAN, total),
      select: {
        id: true,
        category: true,
        riskLevel: true,
        status: true,
        riskReasonsJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const ids = base.map((r) => r.id);

    const msgs: MsgMini[] =
      ids.length === 0
        ? []
        : await prisma.reportMessage.findMany({
            where: { reportId: { in: ids } },
            orderBy: { createdAt: "desc" },
            select: { reportId: true, sender: true, createdAt: true },
          });

    const lastBy: Record<string, { sender: MessageSender; createdAt: Date } | undefined> = {};
    const hasAdmin: Record<string, boolean> = {};

    for (const m of msgs) {
      if (!lastBy[m.reportId]) lastBy[m.reportId] = { sender: m.sender, createdAt: m.createdAt };
      if (m.sender === "ADMIN") hasAdmin[m.reportId] = true;
    }

    const scored = base
      .map((r) => {
        const last = lastBy[r.id];
        const hasAdminReply = Boolean(hasAdmin[r.id]);

        const ti = triageInfo({
          riskLevel: r.riskLevel,
          status: r.status,
          createdAt: r.createdAt,
          now,
          hasAdminReply,
          lastMessageSender: last?.sender ?? "REPORTER",
          lastMessageAt: last?.createdAt ?? r.createdAt,
        });

        return { r, score: ti.score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);

    reports = scored.slice(skip, skip + take);
  } else {
    reports = await prisma.report.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip,
      take,
      select: {
        id: true,
        category: true,
        riskLevel: true,
        status: true,
        riskReasonsJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + take, total);
  const totalPages = Math.max(1, Math.ceil(total / take));

  // For the current page reports, load message stats (last sender + has admin reply)
  const pageIds = reports.map((r) => r.id);

  const pageMsgs: MsgMini[] =
    pageIds.length === 0
      ? []
      : await prisma.reportMessage.findMany({
          where: { reportId: { in: pageIds } },
          orderBy: { createdAt: "desc" },
          select: { reportId: true, sender: true, createdAt: true },
        });

  const lastBy: Record<string, { sender: MessageSender; createdAt: Date } | undefined> = {};
  const hasAdmin: Record<string, boolean> = {};

  for (const m of pageMsgs) {
    if (!lastBy[m.reportId]) lastBy[m.reportId] = { sender: m.sender, createdAt: m.createdAt };
    if (m.sender === "ADMIN") hasAdmin[m.reportId] = true;
  }

  function buildQuery(next: Partial<Record<string, string>>) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (risk) params.set("risk", risk);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (next.page) params.set("page", next.page);
    return params.toString();
  }

  const hasFilters = Boolean(status || category || risk || q || sort !== "created_desc");

  return (
    <main className={styles.opsRoot}>
      <div className={styles.bg} />
      <div className={styles.scanlines} />

      <div className={styles.wrap}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.kicker}>WHISPERSAFE • OPS</div>
            <h1 className={styles.h1}>Admin Command Center</h1>
            <p className={styles.sub}>Triage queue, risk signals, and encrypted follow-up threads.</p>
          </div>

          <div className={styles.topActions}>
            <a className={styles.linkPill} href="/api/admin/logout">
              Logout
            </a>
          </div>
        </header>

        {/* Snapshot */}
        <section className={styles.snapshot}>
          <div className={styles.snapCard}>
            <div className={styles.snapTitle}>Queue</div>
            <div className={styles.snapRow}>
              <div className={styles.metric}>
                <div className={styles.mKey}>NEW</div>
                <div className={`${styles.mVal} ${styles.pulseDot}`}>{statusCount.NEW}</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.mKey}>IN_REVIEW</div>
                <div className={styles.mVal}>{statusCount.IN_REVIEW}</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.mKey}>RESOLVED</div>
                <div className={styles.mVal}>{statusCount.RESOLVED}</div>
              </div>
            </div>
          </div>

          <div className={styles.snapCard}>
            <div className={styles.snapTitle}>Risk</div>
            <div className={styles.riskMeters}>
              <div className={`${styles.riskMeter} ${styles.low}`}>
                <div className={styles.riskLabel}>LOW</div>
                <div className={styles.riskNum}>{riskCount.LOW}</div>
              </div>
              <div className={`${styles.riskMeter} ${styles.med}`}>
                <div className={styles.riskLabel}>MED</div>
                <div className={styles.riskNum}>{riskCount.MEDIUM}</div>
              </div>
              <div className={`${styles.riskMeter} ${styles.high}`}>
                <div className={styles.riskLabel}>HIGH</div>
                <div className={styles.riskNum}>{riskCount.HIGH}</div>
              </div>
            </div>
          </div>

          <div className={styles.snapCard}>
            <div className={styles.snapTitle}>Quick Open</div>

            <form className={styles.openForm} action="/admin" method="GET">
              <input
                name="open"
                defaultValue={openInput}
                placeholder="Report ID (cml...) or Tracking ID (12 chars)"
                className={styles.input}
                autoComplete="off"
              />
              <button className={styles.btnPrimary} type="submit">
                Open
              </button>
            </form>

            {openError && <div className={styles.err}>✖ {openError}</div>}
          </div>
        </section>

        {/* Filters */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>Triage Filters</div>

            <div className={styles.badges}>
              {hasFilters ? (
                <>
                  {status && <span className={styles.badge}>Status: {status}</span>}
                  {category && <span className={styles.badge}>Category: {category}</span>}
                  {risk && <span className={styles.badge}>Risk: {risk}</span>}
                  {q && <span className={styles.badge}>Search: {q}</span>}
                  {sort !== "created_desc" && <span className={styles.badge}>Sort: {sort}</span>}
                </>
              ) : (
                <span className={styles.badgeMuted}>No filters applied</span>
              )}
            </div>
          </div>

          <form className={styles.filters} action="/admin" method="GET">
            <label className={styles.field}>
              <span>Status</span>
              <select className={styles.select} name="status" defaultValue={status ?? ""}>
                <option value="">All</option>
                <option value="NEW">NEW</option>
                <option value="IN_REVIEW">IN_REVIEW</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="ESCALATED">ESCALATED</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Category</span>
              <select className={styles.select} name="category" defaultValue={category ?? ""}>
                <option value="">All</option>
                <option value="HARASSMENT">HARASSMENT</option>
                <option value="CORRUPTION">CORRUPTION</option>
                <option value="ACADEMIC">ACADEMIC</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Risk</span>
              <select className={styles.select} name="risk" defaultValue={risk ?? ""}>
                <option value="">All</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </label>

            <label className={`${styles.field} ${styles.grow}`}>
              <span>Search (Report ID contains)</span>
              <input className={styles.input} name="q" defaultValue={q} placeholder="e.g. cmlj..." />
            </label>

            <label className={styles.field}>
              <span>Sort</span>
              <select className={styles.select} name="sort" defaultValue={sort}>
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <button className={styles.btnGhost} type="submit">
              Apply
            </button>

            <a className={styles.btnOutline} href="/admin">
              Reset
            </a>
          </form>

          <div className={styles.metaLine}>
            Showing <b>{from}</b>–<b>{to}</b> of <b>{total}</b> (Page {page} / {totalPages})
          </div>
        </section>

        {/* List */}
        <section className={styles.list}>
          {reports.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No matches</div>
              <div className={styles.emptyText}>Try resetting filters or searching a different ID.</div>
            </div>
          ) : (
            reports.map((r: ReportRow) => {
              const reasonCount = safeReasonCount(r.riskReasonsJson);

              const last = lastBy[r.id];
              const hasAdminReply = Boolean(hasAdmin[r.id]);

              const t = triageInfo({
                riskLevel: r.riskLevel,
                status: r.status,
                createdAt: r.createdAt,
                now,
                hasAdminReply,
                lastMessageSender: last?.sender ?? "REPORTER",
                lastMessageAt: last?.createdAt ?? r.createdAt,
              });

              const overdue = t.sla.state === "OVERDUE";

              return (
                <Link
                  key={r.id}
                  href={`/admin/${r.id}`}
                  className={[
                    styles.item,
                    styles[`risk_${r.riskLevel.toLowerCase()}`],
                    overdue ? styles.itemOverdue : "",
                  ].join(" ")}
                  title={`Priority ${t.priority} • Score ${t.score} • SLA: ${t.sla.label}`}
                >
                  <div className={styles.itemTop}>
                    <div className={styles.left}>
                      <div className={styles.titleRow}>
                        <span className={styles.cat}>{r.category}</span>

                        {/* Smart triage pills */}
                        <span className={`${styles.prioPill} ${prioClass(t.priority)}`}>
                          {t.priority} • {t.score}
                        </span>

                        <span className={`${styles.slaPill} ${slaClass(t.sla.state)}`}>
                          {t.sla.label}
                        </span>

                        <span className={`${styles.pill} ${styles[`pill_${r.status.toLowerCase()}`]}`}>
                          {r.status}
                        </span>

                        <span className={`${styles.pill} ${styles[`pillrisk_${r.riskLevel.toLowerCase()}`]}`}>
                          {r.riskLevel} RISK
                        </span>

                        {reasonCount > 0 && <span className={styles.signalPill}>{reasonCount} signals</span>}

                        {!hasAdminReply && r.status !== "RESOLVED" && (
                          <span className={styles.noReplyPill}>No admin reply</span>
                        )}
                      </div>

                      <div className={styles.small}>
                        <span className={styles.mono}>ID: {r.id}</span>
                      </div>
                    </div>

                    <div className={styles.right}>
                      <div className={styles.time}>
                        <div>
                          <div className={styles.tk}>Created</div>
                          <div className={styles.tv}>{new Date(r.createdAt).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className={styles.tk}>Updated</div>
                          <div className={styles.tv}>{new Date(r.updatedAt).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className={styles.tk}>Due</div>
                          <div className={styles.tv}>{new Date(t.sla.dueAt).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className={styles.openArrow}>↗</div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </section>

        {/* Pagination */}
        <div className={styles.pager}>
          <a
            className={`${styles.btnOutline} ${page <= 1 ? styles.disabled : ""}`}
            href={page <= 1 ? undefined : `/admin?${buildQuery({ page: String(page - 1) })}`}
          >
            ← Prev
          </a>

          <div className={styles.pageChip}>
            Page <b>{page}</b> / {totalPages}
          </div>

          <a
            className={`${styles.btnOutline} ${page >= totalPages ? styles.disabled : ""}`}
            href={page >= totalPages ? undefined : `/admin?${buildQuery({ page: String(page + 1) })}`}
          >
            Next →
          </a>
        </div>

        <footer className={styles.footer}>
          <span className={styles.footMono}>OPS UI • encrypted thread triage</span>
        </footer>
      </div>
    </main>
  );
}