import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

export default function HomePage() {
  const d = (ms: number) => ({ ["--d" as any]: `${ms}ms` });

  return (
    <main className="page-root">
      <div className="gradient-bg" />
      <div className="home-noise" />

      <ScrollReveal />

      <div className="container">
        <header className="hero" data-reveal style={d(0)}>
          <h1 className="title">
            <span>WhisperSafe</span>
          </h1>

          <p className="subtitle">Anonymous reporting + secure follow-up with Tracking ID.</p>
          <p className="hero-description">Speak up safely. Track securely. Stay anonymous.</p>
        </header>

        <section className="card-grid" data-reveal style={d(80)}>
          <Card
            icon="📝"
            title="Submit a Report"
            desc="Create an anonymous report. You will receive a secure Tracking ID."
            href="/submit"
          />
          <Card
            icon="🔁"
            title="Follow Up"
            desc="Use your Tracking ID to view status and exchange encrypted messages."
            href="/followup"
          />
          <Card
            icon="🛡️"
            title="Admin Login"
            desc="Secure dashboard to review, respond, and manage reports."
            href="/admin/login"
          />
        </section>

        <div className="trustbar" data-reveal style={d(140)}>
          <span className="trustPill">AES-256-GCM encryption</span>
          <span className="trustPill">No user accounts</span>
          <span className="trustPill">Secure Tracking ID follow-up</span>
          <span className="trustPill">Admin triage + queue</span>
        </div>

        <section className="how" data-reveal style={d(200)}>
          <div className="howTitle">How it works</div>
          <div className="howGrid">
            <div className="howItem" data-reveal style={d(260)}>
              <div className="howItemTitle">
                <span className="howBadge">1</span> Submit anonymously
              </div>
              <div className="howItemText">
                Write your report and optionally attach files. Everything is stored encrypted.
              </div>
            </div>

            <div className="howItem" data-reveal style={d(320)}>
              <div className="howItemTitle">
                <span className="howBadge">2</span> Get a Tracking ID
              </div>
              <div className="howItemText">
                Use your Tracking ID later to check status and send follow-up details securely.
              </div>
            </div>

            <div className="howItem" data-reveal style={d(380)}>
              <div className="howItemTitle">
                <span className="howBadge">3</span> Admin reviews & responds
              </div>
              <div className="howItemText">
                Admins triage by risk signals and reply inside an encrypted thread.
              </div>
            </div>
          </div>
        </section>

        <footer className="footer" data-reveal style={d(440)}>
          Users don’t need an account — only admins log in.
        </footer>
      </div>
    </main>
  );
}

function Card({
  icon,
  title,
  desc,
  href,
}: {
  icon: string;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link href={href} className="card">
      <div className="cardTop">
        <div className="cardIcon">{icon}</div>
        <h3>{title}</h3>
      </div>
      <p>{desc}</p>
      <span className="cta">Explore →</span>
    </Link>
  );
}