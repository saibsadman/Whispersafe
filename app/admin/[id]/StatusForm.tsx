"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function StatusForm({
  id,
  current,
}: {
  id: string;
  current: string;
}) {
  const [status, setStatus] = useState(current);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function save() {
    setErr(null);
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update status");

      startTransition(() => router.refresh());
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="NEW">NEW</option>
          <option value="IN_REVIEW">IN_REVIEW</option>
          <option value="RESOLVED">RESOLVED</option>
        </select>
      </label>

      <button onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>

      {err && <div style={{ color: "crimson" }}>❌ {err}</div>}
    </div>
  );
}