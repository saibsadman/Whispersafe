import crypto from "crypto";

function getKeyFromBase64(envName: string): Buffer {
  const v = process.env[envName];
  if (!v) throw new Error(`${envName} is missing in .env`);
  const buf = Buffer.from(v, "base64");
  if (buf.length !== 32) throw new Error(`${envName} must be 32 bytes base64`);
  return buf;
}

const ENC_KEY = () => getKeyFromBase64("ENCRYPTION_KEY");
const TRACK_SECRET = () => getKeyFromBase64("TRACKING_SECRET");

// ========================
// ✅ Binary encryption (for attachments)
// Format: [iv(12)][tag(16)][ciphertext...]
// ========================
export function encryptBytes(data: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY(), iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptBytes(payload: Buffer): Buffer {
  if (!Buffer.isBuffer(payload)) payload = Buffer.from(payload);
  if (payload.length < 28) throw new Error("Bad encrypted payload (too short).");

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ========================
// Text encryption (reuses bytes functions)
// ========================
export function encryptText(plain: string): string {
  const enc = encryptBytes(Buffer.from(plain, "utf8"));
  return enc.toString("base64");
}

export function decryptText(payloadB64: string): string {
  const buf = Buffer.from(payloadB64, "base64");
  const plain = decryptBytes(buf);
  return plain.toString("utf8");
}

// ========================
// Tracking
// ========================
export function trackingId(): string {
  const raw = crypto.randomBytes(9).toString("base64url");
  return raw.slice(0, 12).toUpperCase();
}

export function trackingHash(trackingId: string): string {
  return crypto.createHmac("sha256", TRACK_SECRET()).update(trackingId).digest("hex");
}

// ========================
// Risk scoring + explainability
// ========================
export function riskScore(text: string): "LOW" | "MEDIUM" | "HIGH" {
  const t = text.toLowerCase();

  const high = ["kill", "weapon", "suicide", "rape", "bomb", "threat", "violence"];
  const med = ["harass", "abuse", "blackmail", "bribe", "corruption", "stalk"];

  if (high.some((w) => t.includes(w))) return "HIGH";
  if (med.some((w) => t.includes(w))) return "MEDIUM";
  return "LOW";
}

export type RiskReason = {
  code: string;
  label: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

function hasAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

export function riskExplain(message: string) {
  const text = message.toLowerCase();
  const reasons: RiskReason[] = [];

  if (
    hasAny(text, ["kill", "murder", "attack", "bomb", "weapon", "gun", "knife", "threat"]) ||
    hasAny(text, ["মারবো", "খুন", "হামলা", "বোমা", "অস্ত্র", "গুলি", "ছুরি", "হুমকি"])
  ) {
    reasons.push({
      code: "THREAT_VIOLENCE",
      label: "Contains threat/violence indicators",
      severity: "HIGH",
    });
  }

  if (
    hasAny(text, ["idiot", "slut", "bitch", "fuck", "harass"]) ||
    hasAny(text, ["গালি", "হয়রানি", "অশ্লীল", "ধর্ষণ"])
  ) {
    reasons.push({
      code: "HARASSMENT_LANGUAGE",
      label: "Possible harassment/abusive language",
      severity: "MEDIUM",
    });
  }

  if (
    hasAny(text, ["bribe", "kickback", "commission", "extort", "under the table"]) ||
    hasAny(text, ["ঘুষ", "দুর্নীতি", "কমিশন", "চাঁদা"]) ||
    text.includes("৳") ||
    text.includes("taka")
  ) {
    reasons.push({
      code: "CORRUPTION_SIGNAL",
      label: "Mentions bribery/corruption or money exchange",
      severity: "MEDIUM",
    });
  }

  if (
    hasAny(text, ["exam leak", "question leak", "cheat", "plagiarism"]) ||
    hasAny(text, ["প্রশ্নফাঁস", "নকল", "প্লেজারিজম", "চিটিং"])
  ) {
    reasons.push({
      code: "ACADEMIC_MISCONDUCT",
      label: "Mentions academic misconduct signals",
      severity: "LOW",
    });
  }

  const emailRe = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  if (emailRe.test(message)) {
    reasons.push({
      code: "PII_EMAIL",
      label: "May contain an email address (PII)",
      severity: "MEDIUM",
    });
  }

  const bdPhoneRe = /\b(?:\+?8801|01)\d{9}\b/;
  if (bdPhoneRe.test(message.replace(/\s+/g, ""))) {
    reasons.push({
      code: "PII_PHONE",
      label: "May contain a phone number (PII)",
      severity: "MEDIUM",
    });
  }

  if (
    hasAny(text, ["urgent", "asap", "immediately", "today", "now"]) ||
    hasAny(text, ["জরুরি", "এখনই", "আজ", "তৎক্ষণাৎ"])
  ) {
    reasons.push({
      code: "URGENCY",
      label: "Contains urgency indicators",
      severity: "LOW",
    });
  }

  const riskLevel = riskScore(message);
  return { riskLevel, reasons };
}