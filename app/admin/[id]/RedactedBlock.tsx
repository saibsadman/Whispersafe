"use client";

import { useMemo, useState } from "react";

function maskPII(s: string) {
  let out = s;

  // Email
  const emailRe = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
  out = out.replace(emailRe, (m) => {
    const [u, d] = m.split("@");
    const u2 = u.length <= 2 ? "••" : `${u.slice(0, 2)}•••`;
    return `${u2}@${d}`;
  });

  // BD phone: 01XXXXXXXXX / +8801XXXXXXXXX (also handles spaces by pre-cleaning in caller)
  const bdPhoneRe = /\b(?:\+?8801|01)\d{9}\b/g;
  out = out.replace(bdPhoneRe, (m) => m.slice(0, 3) + "••••••••");

  return out;
}

export default function RedactedBlock({
  text,
  label,
  defaultHidden = true,
}: {
  text: string;
  label?: string;
  defaultHidden?: boolean;
}) {
  const [show, setShow] = useState(!defaultHidden);
  const [copied, setCopied] = useState(false);

  const masked = useMemo(() => maskPII(text.replace(/\s+/g, " ")), [text]);
  const hasPII = masked !== text.replace(/\s+/g, " ");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {label ? <div style={{ fontWeight: 900, opacity: 0.9 }}>{label}</div> : null}

        {hasPII && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(239,68,68,0.55)",
              background: "rgba(0,0,0,0.18)",
            }}
          >
            Sensitive info detected
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            style={{
              cursor: "pointer",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              padding: "8px 10px",
              fontWeight: 900,
            }}
          >
            {show ? "Hide" : "Reveal"}
          </button>

          <button
            type="button"
            onClick={copy}
            style={{
              cursor: "pointer",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              padding: "8px 10px",
              fontWeight: 900,
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
        {show ? text : masked}
      </div>
    </div>
  );
}