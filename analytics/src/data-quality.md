# Data Quality

```js
const integrity = FileAttachment("data/integrity.json").json();
const syncHealth = FileAttachment("data/sync-health.json").json();
const dreps = FileAttachment("data/dreps.json").json();
const proposals = FileAttachment("data/proposals.json").json();
```

```js
const hasIntegrity = integrity.length > 0;
const latestIntegrity = hasIntegrity
  ? integrity.sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))[0]
  : null;

function qualityColor(value, invert = false) {
  if (value == null) return "var(--theme-foreground-muted)";
  if (invert) return value < 5 ? "#10b981" : value < 15 ? "#f59e0b" : "#ef4444";
  return value >= 90 ? "#10b981" : value >= 70 ? "#f59e0b" : "#ef4444";
}
function qualityTier(value, invert = false) {
  if (value == null) return "muted";
  if (invert) return value < 5 ? "good" : value < 15 ? "warn" : "bad";
  return value >= 90 ? "good" : value >= 70 ? "warn" : "bad";
}
function fmt(v, decimals = 1) {
  return v != null ? v.toFixed(decimals) + "%" : "N/A";
}
```

```js
if (hasIntegrity) {
  display(html`<div class="kpi-row cols-5">
    <div class="kpi">
      <span class="kpi-label">Vote Power Coverage</span>
      <span class="kpi-value" style="color:${qualityColor(latestIntegrity.vote_power_coverage_pct)}">${fmt(latestIntegrity.vote_power_coverage_pct)}</span>
      <span class="kpi-sub">% of total voting power we track</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Canonical Summaries</span>
      <span class="kpi-value" style="color:${qualityColor(latestIntegrity.canonical_summary_pct)}">${fmt(latestIntegrity.canonical_summary_pct)}</span>
      <span class="kpi-sub">% of proposals with canonical summaries</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">AI Proposal Coverage</span>
      <span class="kpi-value" style="color:${qualityColor(latestIntegrity.ai_proposal_pct)}">${fmt(latestIntegrity.ai_proposal_pct)}</span>
      <span class="kpi-sub">% with AI-generated summaries</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">AI Rationale Coverage</span>
      <span class="kpi-value" style="color:${qualityColor(latestIntegrity.ai_rationale_pct)}">${fmt(latestIntegrity.ai_rationale_pct)}</span>
      <span class="kpi-sub">% of rationales processed by AI</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Hash Mismatch Rate</span>
      <span class="kpi-value" style="color:${qualityColor(latestIntegrity.hash_mismatch_rate_pct, true)}">${fmt(latestIntegrity.hash_mismatch_rate_pct, 2)}</span>
      <span class="kpi-sub">lower is better — metadata integrity</span>
    </div>
  </div>`);
} else {
  display(html`<div class="alert-box">
    <strong>No integrity data yet.</strong> The integrity_snapshots table is empty. Once the integrity check pipeline runs, this section will show vote power coverage, AI processing rates, and hash verification metrics.
  </div>`);
}
```

## Data quality over time

```js
if (hasIntegrity) {
  const metricLines = integrity.flatMap(d => [
    { date: new Date(d.snapshot_date), metric: "Vote Power Coverage", value: d.vote_power_coverage_pct },
    { date: new Date(d.snapshot_date), metric: "Canonical Summary", value: d.canonical_summary_pct },
    { date: new Date(d.snapshot_date), metric: "AI Proposal", value: d.ai_proposal_pct },
    { date: new Date(d.snapshot_date), metric: "AI Rationale", value: d.ai_rationale_pct },
  ]);

  display(Plot.plot({
    height: 360,
    marginLeft: 50,
    style: { fontSize: "12px" },
    x: { label: null, type: "utc" },
    y: { label: "↑ Coverage %", domain: [0, 100], grid: true },
    color: {
      domain: ["Vote Power Coverage", "Canonical Summary", "AI Proposal", "AI Rationale"],
      range: ["#4f8cff", "#10b981", "#a78bfa", "#f59e0b"],
      legend: true,
    },
    marks: [
      Plot.lineY(metricLines, { x: "date", y: "value", stroke: "metric", strokeWidth: 2, curve: "catmull-rom" }),
      Plot.dot(metricLines, {
        x: "date", y: "value", fill: "metric", r: 3,
        tip: true,
        channels: { Date: d => d.date.toLocaleDateString(), Value: d => `${d.value?.toFixed(1)}%` },
      }),
      Plot.ruleY([95], { stroke: "#10b981", strokeDasharray: "6,4", strokeWidth: 1.5 }),
      Plot.text([{ y: 95 }], { y: "y", text: () => "Target 95%", dx: 50, fill: "#10b981", fontSize: 11 }),
    ]
  }));
} else {
  display(html`<div class="empty-state"><strong>No trend data</strong>Integrity snapshots will appear here once the pipeline runs.</div>`);
}
```

## Sync operations

*Recent sync jobs — click column headers to sort. Red rows indicate failures.*

```js
const syncTypeFilter = view(Inputs.select(
  ["All", ...new Set(syncHealth.map(d => d.sync_type).filter(Boolean))],
  { label: "Sync type", value: "All" }
));
```

```js
function primaryMetric(d) {
  const m = d.metrics || {};
  switch (d.sync_type) {
    case "dreps": case "full": return m.dreps_synced != null ? `${m.dreps_synced} DReps` : "—";
    case "votes": return m.votes_synced != null ? `${m.votes_synced} votes` : "—";
    case "proposals": case "fast": return m.proposals_synced != null ? `${m.proposals_synced} proposals` : "—";
    case "secondary": return [m.delegators_updated && `${m.delegators_updated} delegators`, m.power_snapshots && `${m.power_snapshots} power`].filter(Boolean).join(", ") || "—";
    case "slow": return [m.rationales_fetched && `${m.rationales_fetched} rationales`, m.ai_proposal_summaries && `${m.ai_proposal_summaries} AI`].filter(Boolean).join(", ") || "—";
    default: return "—";
  }
}

const filteredSyncs = (syncTypeFilter === "All" ? syncHealth : syncHealth.filter(d => d.sync_type === syncTypeFilter))
  .sort((a, b) => b.started_at.localeCompare(a.started_at))
  .slice(0, 40)
  .map(d => ({
    Type: d.sync_type,
    Started: new Date(d.started_at).toLocaleString(),
    Duration: d.duration_ms != null
      ? (d.duration_ms < 60000 ? `${(d.duration_ms / 1000).toFixed(1)}s` : `${(d.duration_ms / 60000).toFixed(1)}m`)
      : "—",
    Metrics: primaryMetric(d),
    Status: d.success,
    Error: d.error_message || "—",
  }));
```

```js
filteredSyncs.length > 0
  ? Inputs.table(filteredSyncs, {
      columns: ["Type", "Started", "Duration", "Metrics", "Status", "Error"],
      format: {
        Status: d => d
          ? html`<span class="badge badge-green">Success</span>`
          : html`<span class="badge badge-red">Failed</span>`,
        Type: d => html`<span class="badge badge-blue">${d}</span>`,
        Error: d => d === "—"
          ? html`<span style="color:var(--theme-foreground-muted)">—</span>`
          : html`<span style="color:#ef4444;font-size:0.8rem;max-width:350px;display:inline-block;white-space:normal;word-break:break-word" title="${d}">${d.length > 120 ? d.slice(0, 120) + "…" : d}</span>`,
      },
      width: { Error: 350 },
      rows: 20,
    })
  : html`<div class="empty-state"><strong>No sync logs</strong>The sync_log table is empty.</div>`
```

## Sync performance over time

*Duration per sync job — failed runs are circled in red. Faceted by sync type.*

```js
const syncTimeline = syncHealth
  .filter(d => d.sync_type !== "integrity_check")
  .map(d => ({
    date: new Date(d.started_at),
    duration_s: (d.duration_ms ?? 0) / 1000,
    type: d.sync_type,
    success: d.success,
  }));
```

```js
syncTimeline.length > 0
  ? Plot.plot({
      height: 300,
      marginLeft: 50,
      style: { fontSize: "12px" },
      x: { label: null, type: "utc" },
      y: { label: "↑ Duration (seconds)", grid: true },
      color: { legend: true, label: "Sync Type" },
      symbol: { legend: false },
      marks: [
        Plot.dot(syncTimeline, {
          x: "date", y: "duration_s", fill: "type",
          r: d => d.success ? 5 : 8,
          stroke: d => d.success ? null : "#ef4444",
          strokeWidth: d => d.success ? 0 : 2,
          fillOpacity: 0.7,
          tip: true,
          channels: {
            Type: "type",
            Duration: d => `${d.duration_s.toFixed(1)}s`,
            Result: d => d.success ? "Success" : "FAILED",
          },
        }),
      ]
    })
  : html`<div class="empty-state">No sync data to chart.</div>`
```

## Sync reliability by type

*Success vs failure counts per sync type over the last 7 days.*

```js
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
const recentSyncs = syncHealth
  .filter(d => d.sync_type !== "integrity_check" && new Date(d.started_at) >= sevenDaysAgo);

const reliabilityData = [...new Set(recentSyncs.map(d => d.sync_type))].flatMap(type => {
  const ofType = recentSyncs.filter(d => d.sync_type === type);
  return [
    { type, result: "Success", count: ofType.filter(d => d.success).length },
    { type, result: "Failed", count: ofType.filter(d => !d.success).length },
  ];
});
```

```js
reliabilityData.length > 0
  ? Plot.plot({
      height: 260,
      marginLeft: 80,
      marginBottom: 30,
      style: { fontSize: "12px" },
      x: { label: "Count (last 7 days)", grid: true },
      y: { label: null },
      color: { domain: ["Success", "Failed"], range: ["#10b981", "#ef4444"], legend: true },
      marks: [
        Plot.barX(reliabilityData, {
          x: "count", y: "type", fill: "result",
          tip: true,
        }),
        Plot.ruleX([0]),
      ]
    })
  : html`<div class="empty-state">No recent sync data.</div>`
```

## Coverage gaps

```js
const missingProposalSummaries = proposals.filter(d => !d.ai_summary).length;
const totalProposals = proposals.length;
const aiCoverage = totalProposals > 0 ? ((totalProposals - missingProposalSummaries) / totalProposals * 100) : 0;
const hashVerified = dreps.filter(d => d.metadata_hash_verified === true).length;
const hashTotal = dreps.filter(d => d.metadata_hash_verified != null).length;
const hashRate = hashTotal > 0 ? (hashVerified / hashTotal * 100) : 0;
const handleCount = dreps.filter(d => d.handle).length;
const handleCoverage = dreps.length > 0 ? (handleCount / dreps.length * 100) : 0;
```

<div class="kpi-row cols-5">
  <div class="kpi">
    <span class="kpi-label">AI Summary Coverage</span>
    <span class="kpi-value" style="color:${qualityColor(aiCoverage)}">${Math.round(aiCoverage)}%</span>
    <span class="kpi-sub">${totalProposals - missingProposalSummaries} of ${totalProposals} proposals</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Hash Verification</span>
    <span class="kpi-value" style="color:${qualityColor(hashRate)}">${Math.round(hashRate)}%</span>
    <span class="kpi-sub">${hashVerified} of ${hashTotal} DReps verified</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">ADA Handle Coverage</span>
    <span class="kpi-value" style="color:${qualityColor(handleCoverage)}">${Math.round(handleCoverage)}%</span>
    <span class="kpi-sub">${handleCount} of ${dreps.length} DReps with $handle</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Total DReps</span>
    <span class="kpi-value">${dreps.length}</span>
    <span class="kpi-sub">in database</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Total Proposals</span>
    <span class="kpi-value">${totalProposals}</span>
    <span class="kpi-sub">in database</span>
  </div>
</div>

## Data freshness

*How recently was each DRep's data updated? DRep sync runs every 6 hours — stale threshold is 12h (2 missed cycles).*

```js
const now = Date.now();
const staleness = dreps.map(d => {
  const updatedMs = new Date(d.updated_at).getTime();
  const hoursAgo = (now - updatedMs) / (1000 * 60 * 60);
  return { ...d, hoursAgo, stale: hoursAgo > 12 };
});
const staleCount = staleness.filter(d => d.stale).length;
const medianFreshness = d3.median(staleness, d => d.hoursAgo);
function freshnessColor(h) { return h == null ? "var(--theme-foreground-muted)" : h < 6 ? "#10b981" : h < 12 ? "#f59e0b" : "#ef4444"; }
```

<div class="kpi-row cols-3">
  <div class="kpi">
    <span class="kpi-label">Stale DReps (&gt;12h)</span>
    <span class="kpi-value" style="color:${staleCount > 0 ? '#ef4444' : '#10b981'}">${staleCount}</span>
    <span class="kpi-sub">of ${dreps.length} total</span>
    <div class="kpi-bar" style="background:${staleCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Median Freshness</span>
    <span class="kpi-value" style="color:${freshnessColor(medianFreshness)}">${medianFreshness != null ? medianFreshness.toFixed(1) : "—"}h</span>
    <span class="kpi-sub">hours since last update</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Freshest Update</span>
    <span class="kpi-value">${d3.min(staleness, d => d.hoursAgo)?.toFixed(1) ?? "—"}h</span>
    <span class="kpi-sub">most recently synced DRep</span>
  </div>
</div>

```js
Plot.plot({
  height: 280,
  marginLeft: 50,
  style: { fontSize: "12px" },
  x: { label: "Hours since last update →" },
  y: { label: "↑ DReps", grid: true },
  marks: [
    Plot.rectY(staleness, Plot.binX({ y: "count" }, {
      x: "hoursAgo", thresholds: 24,
      fill: d => d.hoursAgo > 12 ? "#ef4444" : d.hoursAgo > 8 ? "#f59e0b" : "#10b981",
      fillOpacity: 0.75,
      tip: true,
    })),
    Plot.ruleY([0]),
    Plot.ruleX([6], { stroke: "#10b981", strokeDasharray: "6,4", strokeWidth: 1.5 }),
    Plot.text([{ x: 6 }], { x: "x", text: () => "6h target", dy: -10, fill: "#10b981", fontSize: 11 }),
    Plot.ruleX([12], { stroke: "#ef4444", strokeDasharray: "6,4", strokeWidth: 1.5 }),
    Plot.text([{ x: 12 }], { x: "x", text: () => "12h stale", dy: -10, fill: "#ef4444", fontSize: 11 }),
  ]
})
```

<div class="tip-box">
  <strong>Insight:</strong> DRep sync runs every 6 hours. If many DReps exceed 12h, that means at least 2 consecutive sync cycles have failed — check the sync operations and reliability charts above.
</div>
