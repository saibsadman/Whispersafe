"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type StatusReport = {
  id: string;
  category: string;
  riskLevel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function StatusPage() {
  const sp = useSearchParams();
  const preset = sp.get("t") ?? "";

  const [trackingId, setTrackingId] = useState(preset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<StatusReport | null>(null);

  useEffect(() => {
    setTrackingId(preset);
  }, [preset]);

  async function checkStatus(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
      setReport(data.report);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Check Report Status</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Enter your tracking ID to see the current status. (No message content is shown here.)
      </p>

      <form onSubmit={checkStatus} style={{ marginTop: 20, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Tracking ID
          <input
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="e.g. RXGCQ-PAU6W"
          />
        </label>

        <button disabled={loading} type="submit">
          {loading ? "Checking..." : "Check Status"}
        </button>
      </form>

      {error && <div style={{ marginTop: 16 }}>❌ {error}</div>}

      {report && (
        <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div>
            <b>{report.category}</b> • Risk: <b>{report.riskLevel}</b> • Status: <b>{report.status}</b>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Created: {new Date(report.createdAt).toLocaleString()}
            {" • "}
            Updated: {new Date(report.updatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </main>
  );
}