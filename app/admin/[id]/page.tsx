import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import styles from "./report.module.css";

import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, isAdminCookieValue } from "@/lib/adminAuth";
import { encryptText, decryptText } from "@/lib/security";
import { AuditAction, AuditActor, MessageSender, ReportStatus } from "@prisma/client";

import RedactedBlock from "./RedactedBlock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Next.js may pass params as a Promise
type Props = {
  params?: Promise<{ id?: string }> | { id?: string };
};

function safeDecrypt(s: string) {
  try {
    return decryptText(s);
  } catch {
    return "(Could not decrypt message)";
  }
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isAdminCookieValue(token)) redirect("/admin/login");
}

type RiskReason = { code: string; label: string; severity: "LOW" | "MEDIUM" | "HIGH" };

function parseReasons(json: string): RiskReason[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function nextSteps(
  riskLevel: "LOW" | "MEDIUM" | "HIGH",
  reasons: RiskReason[],
  opts?: { isLocked?: boolean; status?: ReportStatus }
) {
  const steps: string[] = [];

  const hasPII = reasons.some((r) => r.code === "PII_EMAIL" || r.code === "PII_PHONE");
  const hasThreat = reasons.some((r) => r.code === "THREAT_VIOLENCE");
  const isLocked = Boolean(opts?.isLocked);
  const isEscalated = opts?.status === "ESCALATED";

  if (isLocked || isEscalated) {
    steps.push("Lockdown active — follow-up from reporter is disabled.");
    steps.push("Escalate to designated safety/response channel immediately.");
  } else if (riskLevel === "HIGH" || hasThreat) {
    steps.push("Escalate immediately / treat as urgent.");
    steps.push("Do not engage with threats. Follow your org safety protocol.");
  } else if (riskLevel === "MEDIUM") {
    steps.push("Prioritize triage within 24 hours.");
  } else {
    steps.push("Triage when available. Monitor for follow-up messages.");
  }

  if (hasPII) {
    steps.push("Sensitive info detected — avoid copying externally; keep access limited.");
  }

  return steps.slice(0, 4);
}

function formatBytes(n: number) {
  if (!Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

async function writeAudit(reportId: string, action: AuditAction, details: any) {
  await prisma.auditEvent.create({
    data: {
      reportId,
      actor: AuditActor.ADMIN,
      action,
      detailsJson: JSON.stringify(details ?? {}),
    },
  });
}

async function updateStatusAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = (formData.get("id") ?? "").toString();
  const statusRaw = (formData.get("status") ?? "").toString();

  if (!id) return;

  const allowed = new Set(Object.values(ReportStatus) as string[]);
  if (!allowed.has(statusRaw)) redirect(`/admin/${encodeURIComponent(id)}`);

  const status = statusRaw as ReportStatus;

  // If admin sets ESCALATED, automatically enable lockdown.
  if (status === "ESCALATED") {
    await prisma.report.update({
      where: { id },
      data: {
        status,
        isLocked: true,
        lockedAt: new Date(),
        escalatedAt: new Date(),
      },
    });
    await writeAudit(id, AuditAction.ESCALATE, { via: "status_control" });
  } else {
    await prisma.report.update({ where: { id }, data: { status } });
  }

  redirect(`/admin/${encodeURIComponent(id)}`);
}

async function lockThreadAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = (formData.get("id") ?? "").toString();
  if (!id) return;

  await prisma.report.update({
    where: { id },
    data: {
      isLocked: true,
      lockedAt: new Date(),
      // keep status unchanged unless it is NEW/IN_REVIEW/RESOLVED already
      // (admin can explicitly set ESCALATED from status dropdown if needed)
    },
  });

  await writeAudit(id, AuditAction.LOCK, { via: "lock_button" });
  redirect(`/admin/${encodeURIComponent(id)}`);
}

async function unlockThreadAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = (formData.get("id") ?? "").toString();
  if (!id) return;

  await prisma.report.update({
    where: { id },
    data: {
      isLocked: false,
      lockedAt: null,
    },
  });

  await writeAudit(id, AuditAction.UNLOCK_THREAD, { via: "unlock_button" });
  redirect(`/admin/${encodeURIComponent(id)}`);
}

async function escalateAndLockAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = (formData.get("id") ?? "").toString();
  if (!id) return;

  await prisma.report.update({
    where: { id },
    data: {
      status: ReportStatus.ESCALATED,
      isLocked: true,
      lockedAt: new Date(),
      escalatedAt: new Date(),
    },
  });

  await writeAudit(id, AuditAction.ESCALATE, { via: "escalate_lock_button" });
  redirect(`/admin/${encodeURIComponent(id)}`);
}

async function sendAdminMessageAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const reportId = (formData.get("reportId") ?? "").toString();
  const message = (formData.get("message") ?? "").toString().trim();

  if (!reportId) return;
  if (!message || message.length < 5) redirect(`/admin/${encodeURIComponent(reportId)}`);

  await prisma.reportMessage.create({
    data: {
      reportId,
      sender: MessageSender.ADMIN,
      encryptedContent: encryptText(message),
    },
  });

  redirect(`/admin/${encodeURIComponent(reportId)}`);
}

export default async function AdminReportPage({ params }: Props) {
  await requireAdmin();

  const p = await Promise.resolve(params);
  const reportId = p?.id?.toString().trim();

  if (!reportId) {
    return (
      <main className={`${styles.root}`}>
        <div className={styles.bg} />
        <div className={styles.grid} />
        <div className={styles.scan} />
        <div className={styles.wrap}>
          <Link className={styles.back} href="/admin">
            ← Back to dashboard
          </Link>
          <h1 className={styles.h1}>Report Details</h1>
          <div style={{ marginTop: 10, color: "rgba(248,113,113,1)", fontWeight: 900 }}>
            ✖ Missing report id in URL.
          </div>
        </div>
      </main>
    );
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      category: true,
      riskLevel: true,
      status: true,
      riskReasonsJson: true,
      encryptedContent: true,
      createdAt: true,
      updatedAt: true,

      // ✅ Lockdown fields
      isLocked: true,
      lockedAt: true,
      escalatedAt: true,

      // ✅ attachments list (metadata only)
      attachments: {
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
      },
    },
  });

  if (!report) {
    return (
      <main className={`${styles.root}`}>
        <div className={styles.bg} />
        <div className={styles.grid} />
        <div className={styles.scan} />
        <div className={styles.wrap}>
          <Link className={styles.back} href="/admin">
            ← Back to dashboard
          </Link>
          <h1 className={styles.h1}>Report Details</h1>
          <div style={{ marginTop: 10, color: "rgba(248,113,113,1)", fontWeight: 900 }}>
            ✖ Report not found.
          </div>
        </div>
      </main>
    );
  }

  const messages = await prisma.reportMessage.findMany({
    where: { reportId },
    orderBy: { createdAt: "asc" },
    select: { id: true, sender: true, encryptedContent: true, createdAt: true },
  });

  const audits = await prisma.auditEvent.findMany({
    where: { reportId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, actor: true, action: true, detailsJson: true, createdAt: true },
  });

  const reasons = parseReasons(report.riskReasonsJson);
  const steps = nextSteps(report.riskLevel, reasons, { isLocked: report.isLocked, status: report.status });

  const fillClass =
    report.riskLevel === "HIGH"
      ? styles.fillHigh
      : report.riskLevel === "MEDIUM"
      ? styles.fillMed
      : styles.fillLow;

  const statusPillClass =
    report.status === "NEW"
      ? styles.pillNew
      : report.status === "IN_REVIEW"
      ? styles.pillIn
      : report.status === "ESCALATED"
      ? styles.pillEsc
      : styles.pillRes;

  return (
    <main className={styles.root}>
      <div className={styles.bg} />
      <div className={styles.grid} />
      <div className={styles.scan} />

      <div className={styles.wrap}>
        <Link className={styles.back} href="/admin">
          ← Back to dashboard
        </Link>

        <div className={styles.header}>
          <div>
            <h1 className={styles.h1}>Report Details</h1>
            <div className={styles.sub}>
              Case record and encrypted thread. Risk signals are computed automatically to help triage.
            </div>
          </div>

          <div className={styles.stamp}>
            <div className={styles.mono} style={{ fontWeight: 900 }}>
              CASE FILE
            </div>
            <div className={styles.mono} style={{ opacity: 0.8, marginTop: 6 }}>
              {report.id}
            </div>
          </div>
        </div>

        {report.isLocked && (
          <div className={styles.lockBanner}>
            <div style={{ fontWeight: 950 }}>🚨 Lockdown Mode Enabled</div>
            <div style={{ opacity: 0.85, marginTop: 4, fontSize: 12 }}>
              Reporter follow-up is disabled.
              {report.lockedAt ? ` Locked at ${new Date(report.lockedAt).toLocaleString()}.` : ""}
            </div>
          </div>
        )}

        <div className={styles.topRow}>
          {/* Status control */}
          <section className={styles.card}>
            <div className={styles.cardTitle}>Status Control</div>

            <form className={styles.formRow} action={updateStatusAction}>
              <input type="hidden" name="id" value={report.id} />
              <select className={styles.select} name="status" defaultValue={report.status}>
                <option value="NEW">NEW</option>
                <option value="IN_REVIEW">IN_REVIEW</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="ESCALATED">ESCALATED</option>
              </select>

              <button className={styles.btn} type="submit">
                Save
              </button>
            </form>

            <div className={styles.sectionLine}>
              <div className={styles.pills}>
                <span className={styles.pill}>{report.category}</span>

                <span className={`${styles.pill} ${statusPillClass}`}>{report.status}</span>

                <span
                  className={`${styles.pill} ${
                    report.riskLevel === "HIGH"
                      ? styles.pillHigh
                      : report.riskLevel === "MEDIUM"
                      ? styles.pillMed
                      : styles.pillLow
                  }`}
                >
                  {report.riskLevel} RISK
                </span>

                {report.isLocked && <span className={`${styles.pill} ${styles.pillLock}`}>LOCKDOWN</span>}
              </div>

              <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
                <span className={styles.mono}>Created:</span> {new Date(report.createdAt).toLocaleString()}{" "}
                <span style={{ opacity: 0.6 }}>•</span>{" "}
                <span className={styles.mono}>Updated:</span> {new Date(report.updatedAt).toLocaleString()}
              </div>

              <div className={styles.actionRow}>
                <form action={escalateAndLockAction}>
                  <input type="hidden" name="id" value={report.id} />
                  <button className={`${styles.btn} ${styles.btnDanger}`} type="submit">
                    Escalate + Lockdown
                  </button>
                </form>

                {report.isLocked ? (
                  <form action={unlockThreadAction}>
                    <input type="hidden" name="id" value={report.id} />
                    <button className={`${styles.btn} ${styles.btnNeutral}`} type="submit">
                      Unlock thread
                    </button>
                  </form>
                ) : (
                  <form action={lockThreadAction}>
                    <input type="hidden" name="id" value={report.id} />
                    <button className={`${styles.btn} ${styles.btnNeutral}`} type="submit">
                      Lock thread
                    </button>
                  </form>
                )}
              </div>

              {report.escalatedAt && (
                <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                  <span className={styles.mono}>Escalated:</span> {new Date(report.escalatedAt).toLocaleString()}
                </div>
              )}
            </div>
          </section>

          {/* Threat meter */}
          <section className={styles.card}>
            <div className={styles.cardTitle}>Threat Meter</div>

            <div className={styles.threat}>
              <div className={styles.threatTop}>
                <div style={{ fontWeight: 950, fontSize: 14 }}>
                  {report.isLocked || report.status === "ESCALATED"
                    ? "LOCKDOWN ACTIVE"
                    : report.riskLevel === "HIGH"
                    ? "IMMEDIATE ATTENTION"
                    : report.riskLevel === "MEDIUM"
                    ? "PRIORITY TRIAGE"
                    : "STANDARD REVIEW"}
                </div>

                <div className={styles.pills}>
                  <span className={`${styles.pill} ${styles.mono}`}>{reasons.length} signals</span>
                </div>
              </div>

              <div className={styles.meter}>
                <div className={`${styles.fill} ${fillClass}`} />
              </div>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Signals are hints only — always use human judgment and policy.
              </div>
            </div>
          </section>
        </div>

        <div className={styles.cols}>
          {/* Signals */}
          <section className={styles.card}>
            <div className={styles.cardTitle}>Signals</div>

            {reasons.length === 0 ? (
              <div style={{ marginTop: 10, opacity: 0.75 }}>No auto signals for this report.</div>
            ) : (
              <div className={styles.tags}>
                {reasons.map((r, i) => (
                  <span
                    key={`${r.code}-${i}`}
                    className={`${styles.tag} ${
                      r.severity === "HIGH"
                        ? styles.tagHigh
                        : r.severity === "MEDIUM"
                        ? styles.tagMed
                        : styles.tagLow
                    }`}
                    title={r.code}
                  >
                    [{r.severity}] {r.label}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.sectionLine}>
              <div className={styles.cardTitle} style={{ marginBottom: 8 }}>
                Suggested next steps
              </div>
              <ul className={styles.steps}>
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Initial message */}
          <section className={styles.card}>
            <div className={styles.cardTitle}>Initial Message</div>

            <div className={styles.msgBox}>
              <RedactedBlock
                label="Decrypted content"
                text={safeDecrypt(report.encryptedContent)}
                defaultHidden={true}
              />
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
              Tip: Keep sensitive info inside this console. Avoid copy/pasting into external chats.
            </div>
          </section>
        </div>

        {/* Attachments */}
        <section className={styles.card} style={{ marginTop: 16 }}>
          <div className={styles.cardTitle}>Attachments</div>

          {report.attachments.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>No attachments uploaded.</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {report.attachments.map((a) => (
                <a
                  key={a.id}
                  href={`/api/admin/attachments/${a.id}`}
                  className={styles.msgBox}
                  style={{ textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 950 }}>
                        {a.originalName}{" "}
                        <span style={{ opacity: 0.65, fontSize: 12 }}>
                          • {a.mimeType} • {formatBytes(a.size)}
                        </span>
                      </div>
                      <div className={styles.mono} style={{ opacity: 0.7, fontSize: 12 }}>
                        Uploaded by: {a.uploader} • {new Date(a.createdAt).toLocaleString()}
                        {a.messageId ? ` • linked to msg ${a.messageId.slice(0, 8)}…` : ""}
                      </div>
                    </div>

                    <div className={styles.pill} style={{ alignSelf: "center" }}>
                      Download ↘
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Downloads are decrypted server-side for admins only.
          </div>
        </section>

        {/* Audit trail */}
        <section className={styles.card} style={{ marginTop: 16 }}>
          <div className={styles.cardTitle}>Audit Trail</div>

          {audits.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>No audit events yet.</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {audits.map((e) => {
                let details = "";
                try {
                  const j = JSON.parse(e.detailsJson || "{}");
                  details = j?.via ? `via ${j.via}` : "";
                } catch {
                  details = "";
                }
                return (
                  <div key={e.id} className={styles.auditRow}>
                    <div style={{ fontWeight: 950 }}>
                      {e.action} <span style={{ opacity: 0.7 }}>• {e.actor}</span>
                    </div>
                    <div className={styles.mono} style={{ opacity: 0.75, fontSize: 12 }}>
                      {new Date(e.createdAt).toLocaleString()} {details ? `• ${details}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Conversation */}
        <section className={styles.thread}>
          <div className={styles.threadTitle}>Conversation</div>

          <div className={styles.bubbles}>
            {messages.length === 0 ? (
              <div className={styles.card} style={{ marginTop: 10 }}>
                <div style={{ opacity: 0.75 }}>No messages yet.</div>
              </div>
            ) : (
              messages.map((m) => {
                const text = safeDecrypt(m.encryptedContent);
                const isAdmin = m.sender === "ADMIN";
                return (
                  <div key={m.id} className={`${styles.bubble} ${isAdmin ? styles.bubbleAdmin : ""}`}>
                    <div className={styles.bMeta}>
                      <div style={{ fontWeight: 950 }}>
                        {isAdmin ? "Admin" : "Reporter"}{" "}
                        <span style={{ opacity: 0.7 }}>• {new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <div className={styles.mono} style={{ opacity: 0.65 }}>
                        {m.sender}
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <RedactedBlock text={text} defaultHidden={true} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Admin reply */}
          <form className={styles.reply} action={sendAdminMessageAction}>
            <input type="hidden" name="reportId" value={report.id} />
            <textarea
              className={styles.textarea}
              name="message"
              placeholder="Type admin reply… (encrypted on save)"
              rows={5}
            />
            <button className={styles.btn} type="submit" style={{ width: 180 }}>
              Send reply
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}