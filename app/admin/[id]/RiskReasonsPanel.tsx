type RiskReason = {
  code: string;
  label: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

function safeParse(json: string): RiskReason[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function RiskReasonsPanel({ riskReasonsJson }: { riskReasonsJson: string }) {
  const reasons = safeParse(riskReasonsJson);

  if (!reasons.length) return null;

  const suggestions: string[] = [];
  if (reasons.some((r) => r.code === "THREAT_VIOLENCE")) suggestions.push("Escalate immediately / treat as urgent.");
  if (reasons.some((r) => r.code.startsWith("PII_"))) suggestions.push("Ask reporter to remove personal identifiers.");
  if (reasons.some((r) => r.code === "CORRUPTION_SIGNAL")) suggestions.push("Preserve evidence; consider investigator review.");
  if (reasons.some((r) => r.code === "HARASSMENT_LANGUAGE")) suggestions.push("Check context; consider policy/disciplinary workflow.");

  return (
    <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Risk reasons (auto)</div>

      <div style={{ display: "grid", gap: 6 }}>
        {reasons.map((r, i) => (
          <div key={i} style={{ fontSize: 14 }}>
            <b>[{r.severity}]</b> {r.label}
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Suggested next steps</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}