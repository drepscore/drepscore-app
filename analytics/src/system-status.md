# System Status

```js
const data = FileAttachment("data/system-status.json").json();
```

```js
const { sync, api, freshness, integrity, recentFailures, buildTime } = data;

function statusColor(ok) { return ok ? "#10b981" : "#ef4444"; }
function statusBadge(ok) { return ok ? "badge-green" : "badge-red"; }
function statusLabel(ok) { return ok ? "HEALTHY" : "DEGRADED"; }

function agoLabel(ts) {
  if (!ts) return "Never";
  const mins = (Date.now() - new Date(ts).getTime()) / 60000;
  if (mins < 60) return `${Math.round(mins)}m ago`;
  if (mins < 1440) return `${(mins / 60).toFixed(1)}h ago`;
  return `${(mins / 1440).toFixed(1)}d ago`;
}

const syncOk = sync.every(s => s.last_success === true);
const apiOk = (api.error_rate_1h ?? 0) < 5;
const freshnessOk = (freshness.median_age_hours ?? 999) < 12;
const integrityOk = integrity ? (integrity.hash_mismatch_rate_pct ?? 0) < 5 : true;
const allOk = syncOk && apiOk && freshnessOk && integrityOk;
```

```js
if (!allOk) {
  const issues = [];
  if (!syncOk) issues.push("Sync failures detected");
  if (!apiOk) issues.push(`API error rate ${api.error_rate_1h}%`);
  if (!freshnessOk) issues.push(`Data staleness ${Number(freshness.median_age_hours).toFixed(1)}h`);
  if (!integrityOk) issues.push(`Hash mismatch ${integrity.hash_mismatch_rate_pct}%`);
  display(html`<div class="alert-box" style="border-left-color: #ef4444; background: color-mix(in srgb, #ef4444 6%, transparent);">
    <strong style="color: #ef4444">System Degraded:</strong> ${issues.join(" · ")}
  </div>`);
} else {
  display(html`<div class="tip-box" style="border-left-color: #10b981; background: color-mix(in srgb, #10b981 6%, transparent);">
    <strong style="color: #10b981">All Systems Operational</strong> — last checked ${agoLabel(buildTime)}
  </div>`);
}
```

<div class="kpi-row cols-4">
  <div class="kpi">
    <span class="kpi-label">Sync Health</span>
    <span class="kpi-value" style="color:${statusColor(syncOk)}">${statusLabel(syncOk)}</span>
    <span class="kpi-sub">${sync.length} job types tracked</span>
    <div class="kpi-bar" style="background:${statusColor(syncOk)}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">API (1h)</span>
    <span class="kpi-value" style="color:${statusColor(apiOk)}">${api.error_rate_1h ?? 0}%</span>
    <span class="kpi-sub">${api.total_requests_1h} reqs · p95 ${api.p95_ms_1h ?? "—"}ms</span>
    <div class="kpi-bar" style="background:${statusColor(apiOk)}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Data Freshness</span>
    <span class="kpi-value" style="color:${statusColor(freshnessOk)}">${Number(freshness.median_age_hours ?? 0).toFixed(1)}h</span>
    <span class="kpi-sub">${freshness.stale_count} of ${freshness.total_dreps} stale (&gt;24h)</span>
    <div class="kpi-bar" style="background:${statusColor(freshnessOk)}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Data Integrity</span>
    <span class="kpi-value" style="color:${statusColor(integrityOk)}">${statusLabel(integrityOk)}</span>
    <span class="kpi-sub">${integrity ? `${integrity.hash_mismatch_rate_pct ?? 0}% mismatch` : "No snapshots"}</span>
    <div class="kpi-bar" style="background:${statusColor(integrityOk)}"></div>
  </div>
</div>

## Sync Jobs

*Last run status per sync type. Red rows indicate the most recent run failed.*

```js
const syncRows = sync.map(s => ({
  "Type": s.sync_type,
  "Status": s.last_success,
  "Last Run": s.last_run,
  "Duration": s.last_duration_ms,
  "Successes": s.success_count,
  "Failures": s.failure_count,
  "Error": s.last_error,
})).sort((a, b) => (a.Status === b.Status ? 0 : a.Status ? 1 : -1));

display(Inputs.table(syncRows, {
  format: {
    Status: d => html`<span class="badge ${d ? 'badge-green' : 'badge-red'}">${d ? 'OK' : 'FAIL'}</span>`,
    "Last Run": d => d ? `${agoLabel(d)}` : "Never",
    Duration: d => d != null ? `${(d / 1000).toFixed(1)}s` : "—",
    Error: d => d ? html`<span style="color:#ef4444;font-size:0.8rem">${d.slice(0, 80)}</span>` : "—",
  },
  rows: 20,
}));
```

## Recent Failures (24h)

```js
if (recentFailures.length > 0) {
  display(Inputs.table(recentFailures.map(f => ({
    Type: f.sync_type,
    Time: new Date(f.started_at).toLocaleString(),
    Error: f.error_message?.slice(0, 120) ?? "—",
  })), { rows: 10 }));
} else {
  display(html`<div class="empty-state" style="color:#10b981"><strong>No failures in the last 24 hours.</strong></div>`);
}
```

## Integrity Snapshot

```js
if (integrity) {
  const metrics = [
    { label: "Vote Power Coverage", value: `${integrity.vote_power_coverage_pct ?? 0}%`, ok: (integrity.vote_power_coverage_pct ?? 0) >= 90 },
    { label: "Canonical Summary", value: `${integrity.canonical_summary_pct ?? 0}%`, ok: (integrity.canonical_summary_pct ?? 0) >= 80 },
    { label: "AI Proposal Summaries", value: `${integrity.ai_proposal_pct ?? 0}%`, ok: (integrity.ai_proposal_pct ?? 0) >= 70 },
    { label: "AI Rationale Summaries", value: `${integrity.ai_rationale_pct ?? 0}%`, ok: (integrity.ai_rationale_pct ?? 0) >= 50 },
    { label: "Hash Mismatch Rate", value: `${integrity.hash_mismatch_rate_pct ?? 0}%`, ok: (integrity.hash_mismatch_rate_pct ?? 0) < 5 },
  ];

  display(Inputs.table(metrics, {
    columns: ["label", "value", "ok"],
    header: { label: "Metric", value: "Value", ok: "Status" },
    format: {
      ok: d => html`<span class="badge ${d ? 'badge-green' : 'badge-red'}">${d ? 'OK' : 'WARN'}</span>`,
    },
  }));
} else {
  display(html`<div class="empty-state">No integrity snapshots recorded yet.</div>`);
}
```

---

<span class="muted" style="font-size: 0.75rem">Dashboard built: ${new Date(buildTime).toLocaleString()}</span>
