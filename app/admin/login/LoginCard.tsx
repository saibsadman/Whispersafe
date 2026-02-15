"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginCard({ nextPath }: { nextPath: string }) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [shake, setShake] = useState(false);

  const router = useRouter();
  const canSubmit = useMemo(() => key.trim().length >= 4, [key]);

  function updateCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsOn(!!e.getModifierState?.("CapsLock"));
  }

  function triggerShake() {
    setShake(false); // reset so animation can replay
    requestAnimationFrame(() => setShake(true));
    window.setTimeout(() => setShake(false), 520);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Login failed");

      router.push(nextPath);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${styles.card} ${styles.cardScan} ${shake ? styles.shake : ""}`}>
      <div className={styles.scan} aria-hidden="true" />
      <div className={styles.scan2} aria-hidden="true" />

      <div className={styles.cardHeader}>
        <div className={styles.badge}>
          <span className={styles.dot} />
          Secure channel
        </div>

        <div className={styles.mini}>
          Redirect: <span className={styles.mono}>{nextPath}</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.label}>
          Admin Key
          <span className={styles.hint}>Checked server-side. Not stored in DB.</span>

          <div className={styles.inputWrap}>
            <span className={styles.icon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 11V8a5 5 0 0 1 10 0v3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M6 11h12v10H6V11Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <input
              className={`${styles.input} ${styles.mono}`}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={updateCaps}
              onKeyUp={updateCaps}
              onBlur={() => setCapsOn(false)}
              placeholder="Enter admin key…"
              autoComplete="current-password"
            />
          </div>
        </label>

        <div className={styles.warnRow} aria-live="polite">
          {capsOn ? (
            <div className={styles.warn}>
              <span className={styles.warnDot} />
              Caps Lock is <b>ON</b>
            </div>
          ) : (
            <div className={styles.warnGhost}> </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.btnPrimary} disabled={loading || !canSubmit} type="submit">
            {loading ? <span className={styles.spin} aria-hidden="true" /> : <span className={styles.spark} />}
            {loading ? "Logging in…" : "Login"}
          </button>

          <a className={styles.btnGhost} href="/followup">
            Follow-up
          </a>
        </div>

        {err && (
          <div className={styles.error}>
            <b>❌ {err}</b>
          </div>
        )}
      </form>
    </div>
  );
}