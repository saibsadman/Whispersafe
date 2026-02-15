"use client";

import { useEffect, useMemo, useState } from "react";

type Msg = {
  id: string;
  sender: "REPORTER" | "ADMIN";
  message: string;
  createdAt: string;
};

type AttachmentMeta = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: "REPORTER" | "ADMIN";
  messageId?: string | null;
};

type ApiState = {
  report?: {
    category: string;
    riskLevel: string;
    status: string;
    isLocked?: boolean;
    lockedAt?: string | null;
    escalatedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  messages?: Msg[];
  attachments?: AttachmentMeta[];
  error?: string;
};

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024;

export default function FollowUpForm({ initialTrackingId }: { initialTrackingId?: string }) {
  const [trackingId, setTrackingId] = useState(initialTrackingId ?? "");
  const [loadedFor, setLoadedFor] = useState("");
  const [data, setData] = useState<ApiState>({});
  const [loading, setLoading] = useState(false);

  const [newMsg, setNewMsg] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const canLoad = useMemo(() => trackingId.trim().length >= 6, [trackingId]);

  const isLocked = Boolean(data.report?.isLocked);

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  function handleFiles(next: FileList | null) {
    if (isLocked) return;

    const arr = Array.from(next ?? []).slice(0, MAX_FILES);
    for (const f of arr) {
      if (f.size > MAX_BYTES) {
        setData((p) => ({ ...p, error: `File too large: "${f.name}" (max 10MB each).` }));
        setNewFiles([]);
        return;
      }
    }
    setData((p) => ({ ...p, error: undefined }));
    setNewFiles(arr);
  }

  async function load(t: string) {
    const clean = t.trim();
    if (!clean) return;

    setLoading(true);
    setData({});
    try {
      const res = await fetch(`/api/followup?t=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load.");
      setData(json);
      setLoadedFor(clean);
    } catch (e: any) {
      setData({ error: e?.message ?? "Failed to load." });
      setLoadedFor(clean);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const t = trackingId.trim();
    const m = newMsg.trim();

    if (!t) return;
    if (isLocked) return;
    if (m.length < 5 && newFiles.length === 0) return;

    setSending(true);
    try {
      let res: Response;

      if (newFiles.length > 0) {
        const fd = new FormData();
        fd.set("trackingId", t);
        fd.set("message", m); // can be empty (server allows attachments-only)
        newFiles.forEach((f) => fd.append("files", f));

        res = await fetch("/api/followup", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingId: t, message: m }),
        });
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to send.");

      setNewMsg("");
      setNewFiles([]);
      await load(t);
    } catch (e: any) {
      setData((prev) => ({ ...prev, error: e?.message ?? "Failed to send." }));
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (initialTrackingId) load(initialTrackingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="ws-grid2">
        <div className="ws-field">
          <label>
            Tracking ID
            <span className="ws-hint">Example: SLNIWFJ6YSB_</span>
            <input
              className="ws-control ws-mono"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              placeholder="Enter your Tracking ID"
              autoComplete="off"
            />
          </label>

          <div className="ws-btnRow" style={{ marginTop: 10 }}>
            <button
              className={`ws-btn ${loading ? "" : "ws-btnPrimary"}`}
              onClick={() => load(trackingId)}
              disabled={!canLoad || loading}
              type="button"
            >
              {loading ? "Loading…" : "Load thread"}
            </button>

            <a className="ws-btn" href="/submit">
              New report
            </a>
          </div>

          {data.error && (
            <div className="ws-result">
              <div className="ws-resultBox" style={{ borderColor: "rgba(248,113,113,0.35)" }}>
                <b style={{ color: "#fca5a5" }}>❌ {data.error}</b>
              </div>
            </div>
          )}
        </div>

        <div className="ws-resultBox">
          <div className="ws-badge">
            <span className="ws-dot" />
            End-to-end local encryption (stored encrypted)
          </div>
          <div style={{ color: "rgba(203,213,225,0.85)", fontSize: 13, lineHeight: 1.6 }}>
            Messages here are meant for follow-up details. Keep your Tracking ID private.
          </div>

          {data.report && (
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900 }}>
                {data.report.category} • Risk: {data.report.riskLevel} • Status: {data.report.status}
              </div>
              <div className="ws-hint">
                Loaded for: <b className="ws-mono">{loadedFor}</b>
              </div>

              {isLocked && (
                <div
                  style={{
                    marginTop: 8,
                    border: "1px solid rgba(248,113,113,0.35)",
                    background: "rgba(248,113,113,0.10)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>🚨 Lockdown active</div>
                  <div className="ws-hint" style={{ marginTop: 4 }}>
                    Follow-up is temporarily disabled for safety.
                    {data.report.lockedAt ? ` Locked at ${new Date(data.report.lockedAt).toLocaleString()}.` : ""}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* attachments list (metadata only) */}
      {data.attachments && data.attachments.length > 0 && (
        <div className="ws-resultBox">
          <div style={{ fontWeight: 950, fontSize: 16 }}>Attachments</div>
          <div className="ws-hint" style={{ marginTop: 6 }}>
            For safety, downloads are available only to admins in this version.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {data.attachments.map((a) => (
              <div
                key={a.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 900 }}>{a.originalName}</div>
                <div className="ws-hint" style={{ marginTop: 4 }}>
                  {a.mimeType} • {formatBytes(a.size)} • {new Date(a.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.messages && (
        <div className="ws-resultBox">
          <div style={{ fontWeight: 950, fontSize: 16 }}>Conversation</div>

          <div className="ws-chat">
            {data.messages.length === 0 ? (
              <div className="ws-hint">No messages yet.</div>
            ) : (
              data.messages.map((m) => {
                const isAdmin = m.sender === "ADMIN";
                return (
                  <div key={m.id} className="ws-bubbleRow">
                    <div className={`ws-bubble ${isAdmin ? "ws-bubbleAdmin" : "ws-bubbleReporter"}`}>
                      <div className="ws-meta">
                        <b>{isAdmin ? "Admin" : "You"}</b> • {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{m.message}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.10)", marginTop: 12, paddingTop: 12 }}>
            <div className="ws-field">
              <label>
                Add more details
                <span className="ws-hint">
                  {isLocked ? "Disabled during lockdown." : "Minimum 5 characters (or attach a file)."}
                </span>
                <textarea
                  className="ws-control"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder={isLocked ? "Lockdown active — follow-up disabled." : "Write an update…"}
                  rows={4}
                  disabled={isLocked}
                />
              </label>
            </div>

            {/* attach in follow-up */}
            <div className="ws-field" style={{ marginTop: 10 }}>
              <label>
                Attach files (optional)
                <span className="ws-hint">
                  {isLocked ? "Disabled during lockdown." : `Images/PDF only. Max ${MAX_FILES} files, 10MB each.`}
                </span>

                <input
                  className="ws-control"
                  style={{ padding: 10 }}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  disabled={isLocked}
                />

                {newFiles.length > 0 && (
                  <div className="ws-hint" style={{ marginTop: 8 }}>
                    Selected:{" "}
                    <b>
                      {newFiles.length} file{newFiles.length > 1 ? "s" : ""}
                    </b>{" "}
                    •{" "}
                    <button
                      className="ws-btn"
                      style={{ padding: "6px 10px", marginLeft: 8 }}
                      type="button"
                      onClick={() => setNewFiles([])}
                      disabled={isLocked}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </label>
            </div>

            <div className="ws-btnRow" style={{ marginTop: 10 }}>
              <button
                className="ws-btn ws-btnPrimary"
                onClick={send}
                disabled={
                  sending ||
                  isLocked ||
                  !trackingId.trim() ||
                  (newMsg.trim().length < 5 && newFiles.length === 0)
                }
                type="button"
              >
                {sending ? "Sending…" : "Send update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}