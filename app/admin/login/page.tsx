import styles from "./login.module.css";
import LoginCard from "./LoginCard";

type Props = {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const sp = await Promise.resolve(searchParams);
  const next = first(sp?.next) ?? "/admin";

  return (
    <div className={`page-root ${styles.page}`}>
      <div className="gradient-bg" />
      <div className={`container ${styles.container}`}>
        <a className={styles.toplink} href="/">
          ← Home
        </a>

        <div className={`hero ${styles.hero}`}>
          <div className={styles.title}>
            Admin <span className={styles.grad}>Login</span>
          </div>
          <p className={`subtitle ${styles.subtitle}`}>
            Enter the admin key to access the dashboard. Users don’t need accounts.
          </p>
        </div>

        <div className={styles.grid}>
          <LoginCard nextPath={next} />

          <aside className={styles.side}>
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>WhisperSafe Ops</div>
              <div className={styles.sideText}>
                Minimal access surface. Admin authentication + encrypted report threads + tracking IDs.
              </div>

              <div className={styles.rule} />

              <div className={styles.meta}>
                <div>
                  <div className={styles.k}>Mode</div>
                  <div className={styles.v}>Admin-only</div>
                </div>
                <div>
                  <div className={styles.k}>Data</div>
                  <div className={styles.v}>Encrypted</div>
                </div>
                <div>
                  <div className={styles.k}>Follow-up</div>
                  <div className={styles.v}>Tracking ID</div>
                </div>
              </div>
            </div>

            <div className={styles.footNote}>
              Tip: next we can add rate-limit + lockout timer for realism.
            </div>
          </aside>
        </div>

        <div className={`footer ${styles.footer}`}>WhisperSafe • Admin-only access</div>
      </div>
    </div>
  );
}