// lib/attachments.ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { encryptBytes, decryptBytes } from "@/lib/security";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

// Safe limits (adjust as you want)
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

export type SavedAttachment = {
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
  storagePath: string; // stored like "uploads/<id>.bin"
};

export function safeName(name: string) {
  const base = (name || "attachment").split(/[\\/]/).pop() || "attachment";
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function assertAllowed(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Only PNG/JPG/WEBP images or PDF files are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large. Max ${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB.`);
  }
}

function toRelPath(fileId: string) {
  return `uploads/${fileId}.bin`;
}

/**
 * Resolve storagePath safely and ensure it stays inside /uploads.
 * Works reliably on Windows (no startsWith issues).
 */
function resolveStoragePath(storagePath: string) {
  const sp = (storagePath || "").trim();
  if (!sp) throw new Error("Missing storagePath.");

  // If DB stored an absolute path, keep it; otherwise resolve from project root
  const abs = path.isAbsolute(sp) ? path.resolve(sp) : path.resolve(process.cwd(), sp);

  // Ensure abs is inside UPLOAD_DIR
  const rel = path.relative(UPLOAD_DIR, abs);

  // rel starting with ".." means it escapes uploads; also block weird absolute rel
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid storagePath.");
  }

  return abs;
}

export async function saveEncryptedUpload(file: File): Promise<SavedAttachment> {
  await ensureUploadDir();
  assertAllowed(file);

  const rawBuf = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(rawBuf).digest("hex");

  const encrypted = encryptBytes(rawBuf);

  const fileId = crypto.randomUUID().replace(/-/g, "");
  const storagePath = toRelPath(fileId);
  const abs = resolveStoragePath(storagePath);

  await fs.writeFile(abs, encrypted);

  return {
    originalName: safeName(file.name || "attachment"),
    mimeType: (file.type || "application/octet-stream").toLowerCase(),
    size: rawBuf.length,
    sha256,
    storagePath,
  };
}

export async function readDecryptedUpload(storagePath: string): Promise<Buffer> {
  const abs = resolveStoragePath(storagePath);
  const enc = await fs.readFile(abs);
  return decryptBytes(enc);
}