import FollowUpForm from "./FollowUpForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FollowUpPage({ searchParams }: Props) {
  const sp = await Promise.resolve(searchParams);
  const t = (first(sp?.t) ?? first(sp?.trackingId) ?? "").toString().trim();

  return (
    <div className="ws-shell">
      <div className="ws-noise" />
      <div className="ws-container">
        <a className="ws-toplink" href="/">
          ← Home
        </a>

        <div className="ws-hero" style={{ marginTop: 16 }}>
          <div className="ws-h1">
            Add More Details <span className="grad">(Follow-Up)</span>
          </div>
          <p className="ws-sub">
            Enter your Tracking ID to view status and exchange encrypted messages with the admin team.
          </p>
        </div>

        <div className="ws-card ws-borderGlow">
          <FollowUpForm initialTrackingId={t} />
        </div>

        <div className="footer" style={{ marginTop: 26 }}>
          Tip: Save your Tracking ID somewhere private.
        </div>
      </div>
    </div>
  );
}