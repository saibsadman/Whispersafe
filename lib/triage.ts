import { MessageSender, ReportStatus, RiskLevel } from "@prisma/client";

export const SLA_HOURS_BY_RISK: Record<RiskLevel, number> = {
  HIGH: 1,
  MEDIUM: 24,
  LOW: 72,
};

const DUE_SOON_MS_BY_RISK: Record<RiskLevel, number> = {
  HIGH: 15 * 60 * 1000, // 15 min
  MEDIUM: 2 * 60 * 60 * 1000, // 2 hours
  LOW: 8 * 60 * 60 * 1000, // 8 hours
};

export type SlaState = "RESOLVED" | "OVERDUE" | "DUE_SOON" | "OK";

export type SlaInfo = {
  dueAt: Date;
  state: SlaState;
  label: string; // "OVERDUE • 1h 12m" or "DUE SOON • 12m left" or "OK • 10h left"
  msRemaining: number; // negative means overdue
};

export type TriageInfo = {
  score: number; // bigger = more urgent
  priority: "P0" | "P1" | "P2" | "P3";
  sla: SlaInfo;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmt(ms: number) {
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;

  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (!d && m) parts.push(`${m}m`);
  if (parts.length === 0) return "0m";
  return parts.join(" ");
}

export function computeSla({
  riskLevel,
  status,
  createdAt,
  now = new Date(),
}: {
  riskLevel: RiskLevel;
  status: ReportStatus;
  createdAt: Date;
  now?: Date;
}): SlaInfo {
  const dueAt = new Date(createdAt.getTime() + SLA_HOURS_BY_RISK[riskLevel] * 3600 * 1000);

  if (status === "RESOLVED") {
    return {
      dueAt,
      state: "RESOLVED",
      label: "RESOLVED",
      msRemaining: 0,
    };
  }

  const msRemaining = dueAt.getTime() - now.getTime();

  if (msRemaining <= 0) {
    return {
      dueAt,
      state: "OVERDUE",
      label: `OVERDUE • ${fmt(msRemaining)}`,
      msRemaining,
    };
  }

  const dueSoonWindow = DUE_SOON_MS_BY_RISK[riskLevel];
  if (msRemaining <= dueSoonWindow) {
    return {
      dueAt,
      state: "DUE_SOON",
      label: `DUE SOON • ${fmt(msRemaining)} left`,
      msRemaining,
    };
  }

  return {
    dueAt,
    state: "OK",
    label: `OK • ${fmt(msRemaining)} left`,
    msRemaining,
  };
}

export function computePriorityScore({
  riskLevel,
  status,
  createdAt,
  now = new Date(),
  hasAdminReply,
  lastMessageSender,
  lastMessageAt,
}: {
  riskLevel: RiskLevel;
  status: ReportStatus;
  createdAt: Date;
  now?: Date;
  hasAdminReply: boolean;
  lastMessageSender?: MessageSender | null;
  lastMessageAt?: Date | null;
}): number {
  // Base by risk
  const base =
    riskLevel === "HIGH" ? 100 : riskLevel === "MEDIUM" ? 65 : 35;

  // Status weight
  const statusW =
    status === "NEW" ? 22 : status === "IN_REVIEW" ? 10 : -1000;

  // No admin reply increases urgency
  const noReplyW = hasAdminReply ? 0 : 18;

  // Reporter recently replied?
  let reporterRecentW = 0;
  if (lastMessageSender === "REPORTER" && lastMessageAt) {
    const ageMs = now.getTime() - new Date(lastMessageAt).getTime();
    if (ageMs <= 6 * 60 * 60 * 1000) reporterRecentW = 14; // last 6 hours
    else if (ageMs <= 24 * 60 * 60 * 1000) reporterRecentW = 8; // last 24 hours
  }

  // SLA pressure: as you approach/past due time, add points
  const slaMs = SLA_HOURS_BY_RISK[riskLevel] * 3600 * 1000;
  const elapsedMs = now.getTime() - createdAt.getTime();

  // 0..30 as it approaches due
  const pressure = clamp(Math.floor((elapsedMs / slaMs) * 30), 0, 30);

  const sla = computeSla({ riskLevel, status, createdAt, now });
  const slaBoost = sla.state === "OVERDUE" ? 40 : sla.state === "DUE_SOON" ? 15 : 0;

  return base + statusW + noReplyW + reporterRecentW + pressure + slaBoost;
}

export function triageInfo(args: {
  riskLevel: RiskLevel;
  status: ReportStatus;
  createdAt: Date;
  now?: Date;
  hasAdminReply: boolean;
  lastMessageSender?: MessageSender | null;
  lastMessageAt?: Date | null;
}): TriageInfo {
  const now = args.now ?? new Date();
  const sla = computeSla({
    riskLevel: args.riskLevel,
    status: args.status,
    createdAt: args.createdAt,
    now,
  });

  const score = computePriorityScore({ ...args, now });

  const priority: TriageInfo["priority"] =
    score >= 140 ? "P0" : score >= 105 ? "P1" : score >= 75 ? "P2" : "P3";

  return { score, priority, sla };
}