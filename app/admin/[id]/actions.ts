import { prisma } from "@/lib/prisma";

export type AuditActor = "ADMIN" | "SYSTEM";
export type AuditAction = "ESCALATE" | "UNLOCK" | "LOCK" | "UNLOCK_THREAD";

export async function logAudit(params: {
  reportId: string;
  actor: AuditActor;
  action: AuditAction;
  details?: Record<string, any>;
}) {
  const { reportId, actor, action, details } = params;

  // NOTE: requires AuditEvent model in Prisma (we’ll add it in schema update)
  await prisma.auditEvent.create({
    data: {
      reportId,
      actor,
      action,
      detailsJson: JSON.stringify(details ?? {}),
    },
  });
}