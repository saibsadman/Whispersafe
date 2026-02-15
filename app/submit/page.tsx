"use client";

import { useMemo, useState } from "react";

type Category = "HARASSMENT" | "CORRUPTION" | "ACADEMIC" | "OTHER";

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB each

export default function SubmitPage() {
  const [category, setCategory] = useState<Category>("HARASSMENT");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ trackingId: string; riskLevel: string; attachments?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = useMemo(() => message.trim().length >= 10, [message]);

  function riskBadge(risk: string) {
    const r = (risk ?? "").toUpperCase();
    if (r === "HIGH") return { dot: "#fb7185", label: "HIGH RISK" };
    if (r === "MEDIUM") return { dot: "#fbbf24", label: "MEDIUM" };
    return { dot: "#22c55e", label: "LOW" };
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  async function copyTrackingId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  function handleFiles(next: FileList | null) {
    const arr = Array.from(next ?? []);
    const trimmed = arr.slice(0, MAX_FILES);

    // lightweight client checks (server still enforces)
    for (const f of trimmed) {
      if (f.size > MAX_BYTES) {
        setError(`File too large: "${f.name}". Max 10MB each.`);
        setFiles([]);
        return;
      }
    }

    setError(null);
    setFiles(trimmed);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // If user attached files, use multipart; else keep JSON (works with your current API too).
      let res: Response;

      if (files.length > 0) {
        const fd = new FormData();
        fd.set("category", category);
        fd.set("message", message);
        files.forEach((f) => fd.append("files", f));

        res = await fetch("/api/reports", {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, message }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to submit");

      setResult(data);
      setMessage("");
      setFiles([]);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const badge = riskBadge(result?.riskLevel ?? "LOW");

  return (
    <div className="ws-shell">
      <div className="ws-noise" />
      <div className="ws-container">
        <a className="ws-toplink" href="/">
          ← Home
        </a>

        <div className="ws-hero" style={{ marginTop: 16 }}>
          <div className="ws-h1">
            Submit <span className="grad">Anonymous</span> Report
          </div>
          <p className="ws-sub">
            Your message is encrypted before saving. You’ll receive a Tracking ID to follow up later — no account required.
          </p>
        </div>

        <div className="ws-card ws-borderGlow">
          <form className="ws-form" onSubmit={onSubmit}>
            <div className="ws-grid2">
              <div className="ws-field">
                <label>
                  Category
                  <span className="ws-hint">Choose the closest match (helps triage).</span>
                  <select
                    className="ws-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                  >
                    <option value="HARASSMENT">Harassment</option>
                    <option value="CORRUPTION">Corruption</option>
                    <option value="ACADEMIC">Academic</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
              </div>

              <div className="ws-field">
                <label>
                  Safety note
                  <span className="ws-hint">Avoid names/phone/email if possible — keep it anonymous.</span>
                  <div className="ws-resultBox" style={{ marginTop: 2 }}>
                    <div className="ws-badge">
                      <span className="ws-dot" />
                      Encrypted storage • Tracking ID follow-up
                    </div>
                    <div style={{ color: "rgba(203,213,225,0.8)", fontSize: 13, lineHeight: 1.5 }}>
                      If you accidentally include personal info, admins will still see it — so redact what you can.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="ws-field">
              <label>
                Message
                <span className="ws-hint">Minimum 10 characters. Be clear and specific.</span>
                <textarea
                  className="ws-control"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Describe what happened… (what/when/where)."
                />
              </label>
            </div>

            {/* ✅ NEW: attachments */}
            <div className="ws-field">
              <label>
                Attachments (optional)
                <span className="ws-hint">
                  Images or PDF only. Max {MAX_FILES} files, {formatBytes(MAX_BYTES)} each.
                </span>

                <input
                  className="ws-control"
                  style={{ padding: 10 }}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {files.length > 0 && (
                  <div className="ws-resultBox" style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Selected files</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {files.map((f) => (
                        <div key={f.name} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span className="ws-mono">{f.name}</span>
                          </div>
                          <div style={{ opacity: 0.8, fontSize: 12 }}>{formatBytes(f.size)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="ws-btnRow" style={{ marginTop: 10 }}>
                      <button className="ws-btn" type="button" onClick={() => setFiles([])}>
                        Remove files
                      </button>
                    </div>
                  </div>
                )}
              </label>
            </div>

            <div className="ws-btnRow">
              <button className="ws-btn ws-btnPrimary" disabled={loading || !canSubmit} type="submit">
                {loading ? "Submitting…" : "Submit report"}
              </button>

              <a className="ws-btn" href="/followup">
                Follow up
              </a>
            </div>
          </form>

          {error && (
            <div className="ws-result">
              <div className="ws-resultBox" style={{ borderColor: "rgba(248,113,113,0.35)" }}>
                <b style={{ color: "#fca5a5" }}>❌ {error}</b>
              </div>
            </div>
          )}

          {result && (
            <div className="ws-result">
              <div className="ws-resultBox">
                <div className="ws-kv">
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, color: "rgba(203,213,225,0.9)" }}>
                      Your Tracking ID
                    </div>
                    <div className="ws-mono" style={{ fontSize: 18, fontWeight: 900 }}>
                      {result.trackingId}
                    </div>
                    {typeof result.attachments === "number" && result.attachments > 0 && (
                      <div className="ws-hint">Attachments uploaded: <b>{result.attachments}</b></div>
                    )}
                  </div>

                  <div className="ws-badge" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                    <span
                      className="ws-dot"
                      style={{ background: badge.dot, boxShadow: `0 0 18px ${badge.dot}77` }}
                    />
                    {badge.label}
                  </div>
                </div>

                <div className="ws-btnRow">
                  <button className="ws-btn" onClick={() => copyTrackingId(result.trackingId)} type="button">
                    {copied ? "Copied ✓" : "Copy Tracking ID"}
                  </button>

                  <a className="ws-btn ws-btnPrimary" href={`/followup?t=${encodeURIComponent(result.trackingId)}`}>
                    Go to Follow-Up
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="footer" style={{ marginTop: 26 }}>
          WhisperSafe • Anonymous reporting + secure follow-up
        </div>
      </div>
    </div>
  );
}