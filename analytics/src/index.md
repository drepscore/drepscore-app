# Executive Overview

```js
const dreps = FileAttachment("data/dreps.json").json();
const history = FileAttachment("data/score-history.json").json();
const votes = FileAttachment("data/votes.json").json();
const syncHealth = FileAttachment("data/sync-health.json").json();
const systemStatus = FileAttachment("data/system-status.json").json();
const userActivity = FileAttachment("data/user-activity.json").json();
const govEvents = FileAttachment("data/governance-events.json").json();
```

```js
const activeDreps = dreps.filter(d => d.is_active);
const avgScore = d3.mean(activeDreps, d => d.score) ?? 0;
const medianScore = d3.median(activeDreps, d => d.score) ?? 0;
const totalVotes = d3.sum(activeDreps, d => d.total_votes ?? 0);
const totalVotingPowerAda = d3.sum(activeDreps, d => (d.voting_power ?? 0));
const avgParticipation = d3.mean(activeDreps, d => d.participation_rate ?? 0) ?? 0;
const avgRationale = d3.mean(activeDreps, d => d.rationale_rate ?? 0) ?? 0;
const zeroRationale = activeDreps.filter(d => !d.rationale_rate || d.rationale_rate === 0).length;
const rationaleCoverage = activeDreps.length > 0
  ? ((activeDreps.length - zeroRationale) / activeDreps.length * 100)
  : 0;

const medianFreshnessHours = d3.median(dreps, d => {
  const ua = d.updated_at ? new Date(d.updated_at).getTime() : 0;
  return ua ? (Date.now() - ua) / 3600000 : null;
});
function freshnessColor(h) { return h == null ? "var(--theme-foreground-muted)" : h < 6 ? "#10b981" : h < 12 ? "#f59e0b" : "#ef4444"; }
function freshnessLabel(h) { return h == null ? "—" : h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`; }
function scoreColor(v) { return v >= 60 ? "#10b981" : v >= 30 ? "#f59e0b" : "#ef4444"; }
function scoreTier(v) { return v >= 60 ? "good" : v >= 30 ? "warn" : "bad"; }
function formatAda(v) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const currentEpoch = votes.length > 0 ? d3.max(votes, d => d.epoch_no) : null;
const { buildTime } = systemStatus;
const recentSyncFails = systemStatus.recentFailures?.length ?? 0;

const snapDates = [...new Set(history.map(d => d.snapshot_date))].sort();
const latestDate = snapDates.at(-1);
const prevDate = snapDates.length >= 2 ? snapDates.at(-2) : null;
const latestScoresArr = history.filter(d => d.snapshot_date === latestDate);
const prevScoresArr = prevDate ? history.filter(d => d.snapshot_date === prevDate) : [];
const latestAvgScore = d3.mean(latestScoresArr, d => d.score) ?? avgScore;
const prevAvgScore = prevScoresArr.length ? d3.mean(prevScoresArr, d => d.score) : null;
const scoreDelta = prevAvgScore != null ? latestAvgScore - prevAvgScore : null;
```

```js
if (recentSyncFails > 0) {
  display(html`<div class="alert-box" style="border-left-color: #ef4444; background: color-mix(in srgb, #ef4444 6%, transparent);">
    <strong style="color: #ef4444">Sync Alert:</strong> ${recentSyncFails} sync failure${recentSyncFails > 1 ? "s" : ""} in the last 24 hours. <a href="./system-status" style="color:#ef4444">View details →</a>
  </div>`);
}
```

```js
if (currentEpoch != null) {
  display(html`<div style="display:flex;gap:1rem;align-items:center;margin-bottom:0.5rem;">
    <span class="badge badge-blue">Epoch ${currentEpoch}</span>
    <span class="muted" style="font-size:0.78rem">Dashboard built: ${new Date(buildTime).toLocaleString()}</span>
  </div>`);
}
```

```js
const recentSyncs = syncHealth.filter(s => {
  const age = (Date.now() - new Date(s.created_at).getTime()) / 3600000;
  return age < 24;
});
const syncSuccessRate = recentSyncs.length > 0
  ? Math.round(recentSyncs.filter(s => s.success).length / recentSyncs.length * 100)
  : null;
const totalUsers = userActivity?.users?.length ?? 0;
const recentLogins = userActivity?.users?.filter(u => {
  if (!u.last_login) return false;
  return (Date.now() - new Date(u.last_login).getTime()) / 86400000 < 7;
}).length ?? 0;
const totalPolls = govEvents?.pollActivity?.reduce((s, d) => s + d.votes, 0) ?? 0;
```

<div class="kpi-row cols-4" style="margin-bottom: 0.5rem">
  <div class="kpi" style="border-left: 3px solid ${syncSuccessRate == null ? '#888' : syncSuccessRate >= 95 ? '#10b981' : syncSuccessRate >= 80 ? '#f59e0b' : '#ef4444'}">
    <span class="kpi-label">Sync Health (24h)</span>
    <span class="kpi-value">${syncSuccessRate != null ? syncSuccessRate + '%' : '—'}</span>
    <span class="kpi-sub">${recentSyncs.length} runs · ${recentSyncs.filter(s => !s.success).length} failures</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Registered Users</span>
    <span class="kpi-value">${totalUsers}</span>
    <span class="kpi-sub">${recentLogins} active in last 7 days</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Community Poll Votes</span>
    <span class="kpi-value">${totalPolls.toLocaleString()}</span>
    <span class="kpi-sub">last 90 days</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Recent Sync Failures</span>
    <span class="kpi-value" style="color: ${recentSyncFails > 0 ? '#ef4444' : '#10b981'}">${recentSyncFails}</span>
    <span class="kpi-sub">last 24 hours</span>
  </div>
</div>

<div class="kpi-row cols-4">
  <div class="kpi">
    <span class="kpi-label">Active DReps</span>
    <span class="kpi-value">${activeDreps.length}</span>
    <span class="kpi-sub">${dreps.length} total registered</span>
    <div class="kpi-bar" style="background: var(--accent)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Network Avg Score</span>
    <span class="kpi-value" style="color: ${scoreColor(avgScore)}">${Math.round(avgScore)}</span>
    <span class="kpi-sub">median ${Math.round(medianScore)} · ${Math.round(avgScore - medianScore) >= 0 ? "+" : ""}${Math.round(avgScore - medianScore)} skew</span>
    ${scoreDelta != null
      ? html`<span class="kpi-delta ${scoreDelta >= 0 ? 'up' : 'down'}">${scoreDelta >= 0 ? '▲' : '▼'} ${Math.abs(scoreDelta).toFixed(1)} since last snapshot</span>`
      : ""}
    <div class="kpi-bar" style="background: ${scoreColor(avgScore)}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Total Voting Power</span>
    <span class="kpi-value">₳${formatAda(totalVotingPowerAda)}</span>
    <span class="kpi-sub">${totalVotes.toLocaleString()} on-chain votes cast</span>
    <div class="kpi-bar" style="background: var(--accent-purple)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Rationale Coverage</span>
    <span class="kpi-value" style="color: ${scoreColor(rationaleCoverage)}">${Math.round(rationaleCoverage)}%</span>
    <span class="kpi-sub">${zeroRationale} DReps have never posted a rationale</span>
    <div class="kpi-bar" style="background: ${scoreColor(rationaleCoverage)}"></div>
  </div>
</div>

<div class="kpi-row cols-3">
  <div class="kpi">
    <span class="kpi-label">Avg Participation</span>
    <span class="kpi-value" style="color: ${scoreColor(avgParticipation)}">${Math.round(avgParticipation)}%</span>
    <span class="kpi-sub">effective participation rate across active DReps</span>
    <div class="kpi-bar" style="background: ${scoreColor(avgParticipation)}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Avg Rationale Rate</span>
    <span class="kpi-value" style="color: ${scoreColor(avgRationale)}">${Math.round(avgRationale)}%</span>
    <span class="kpi-sub">weighted at 35% of DRepScore — biggest lever</span>
    <div class="kpi-bar" style="background: ${scoreColor(avgRationale)}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Data Freshness</span>
    <span class="kpi-value" style="color: ${freshnessColor(medianFreshnessHours)}">${freshnessLabel(medianFreshnessHours)}</span>
    <span class="kpi-sub">median DRep age · ${snapDates.length} score snapshots</span>
    <div class="kpi-bar" style="background: ${freshnessColor(medianFreshnessHours)}"></div>
  </div>
</div>

## How healthy is the network?

*Score distribution across all active DReps — hover any bar for details.*

```js
const scoreThreshold = view(Inputs.range([0, 100], { label: "Highlight below", step: 5, value: 30 }));
```

```js
Plot.plot({
  height: 340,
  marginLeft: 50,
  style: { fontSize: "12px" },
  x: { label: "DRep Score →", domain: [0, 100] },
  y: { label: "↑ Count", grid: true },
  marks: [
    Plot.rectY(
      [{ x1: 0, x2: 30 }],
      { x1: "x1", x2: "x2", y1: 0, y2: activeDreps.length * 0.35, fill: "#ef4444", fillOpacity: 0.05 }
    ),
    Plot.rectY(
      [{ x1: 30, x2: 60 }],
      { x1: "x1", x2: "x2", y1: 0, y2: activeDreps.length * 0.35, fill: "#f59e0b", fillOpacity: 0.05 }
    ),
    Plot.rectY(
      [{ x1: 60, x2: 100 }],
      { x1: "x1", x2: "x2", y1: 0, y2: activeDreps.length * 0.35, fill: "#10b981", fillOpacity: 0.05 }
    ),
    Plot.rectY(activeDreps, Plot.binX({ y: "count" }, {
      x: "score",
      thresholds: 20,
      fill: d => (d.score ?? 0) < scoreThreshold ? "#ef4444" : "#4f8cff",
      fillOpacity: 0.8,
      tip: true,
    })),
    Plot.ruleX([Math.round(avgScore)], { stroke: "#ef4444", strokeDasharray: "4,4", strokeWidth: 2 }),
    Plot.text([{ x: Math.round(avgScore) }], {
      x: "x", text: d => `Avg ${d.x}`, dy: -10, fill: "#ef4444", fontSize: 12, frameAnchor: "top"
    }),
    Plot.ruleX([Math.round(medianScore)], { stroke: "#a78bfa", strokeDasharray: "2,3", strokeWidth: 1.5 }),
    Plot.ruleY([0])
  ]
})
```

<div class="threshold-legend">
  <span class="legend-red">Below 30 — Needs work</span>
  <span class="legend-yellow">30–60 — Developing</span>
  <span class="legend-green">Above 60 — Healthy</span>
  <span class="legend-purple">Purple line — Median</span>
</div>

## Who needs attention?

*DReps scoring below 30 — sorted by voting power so you can prioritize outreach by network impact.*

```js
const pillars = [
  { key: "effective_participation", label: "Participation", weight: 0.30 },
  { key: "rationale_rate", label: "Rationale", weight: 0.35 },
  { key: "reliability_score", label: "Reliability", weight: 0.20 },
  { key: "profile_completeness", label: "Profile", weight: 0.15 }
];

const atRiskDreps = activeDreps
  .filter(d => d.score < 30)
  .map(d => {
    const weakest = pillars.reduce((min, p) =>
      (d[p.key] ?? 100) < (d[min.key] ?? 100) ? p : min, pillars[0]);
    return {
      Name: d.name || d.drep_id.slice(0, 20) + "…",
      _drepId: d.drep_id,
      Score: Math.round(d.score),
      "Voting Power": d.voting_power ?? 0,
      "Weakest Pillar": weakest.label,
      "Pillar Value": Math.round(d[weakest.key] ?? 0),
      "Participation": Math.round(d.effective_participation ?? 0),
      "Rationale": Math.round(d.rationale_rate ?? 0),
    };
  })
  .sort((a, b) => a.Score - b.Score);
```

<div class="tip-box">
  <strong>Why this matters:</strong> DReps below 30 hold delegator trust but aren't meeting minimum governance standards. Prioritize outreach by voting power for maximum network impact. The "Weakest Pillar" column tells you exactly where to focus the conversation.
</div>

```js
atRiskDreps.length > 0
  ? Inputs.table(atRiskDreps, {
      sort: "Voting Power",
      reverse: true,
      columns: ["Name", "Score", "Voting Power", "Weakest Pillar", "Pillar Value", "Participation", "Rationale"],
      format: {
        Name: (d, i) => html`<a href="https://drepscore.io/drep/${atRiskDreps[i]._drepId}" target="_blank" style="color:var(--accent)">${d}</a>`,
        Score: d => html`<span class="score-pill ${d >= 60 ? 'good' : d >= 30 ? 'warn' : 'bad'}">${d}</span>`,
        "Voting Power": d => formatAda(d),
        "Pillar Value": d => html`<span class="score-pill bad">${d}</span>`,
        "Weakest Pillar": d => html`<span class="badge badge-red">${d}</span>`,
      },
      rows: 15,
    })
  : html`<div class="empty-state"><strong>All clear</strong>No DReps currently below 30 — great news!</div>`
```

## Who's improving and who's slipping?

*Top risers and decliners comparing first vs latest score snapshot — with the pillar that changed most.*

```js
const firstDate = snapDates[0];
const firstScores = new Map(
  history.filter(d => d.snapshot_date === firstDate).map(d => [d.drep_id, d])
);
const latestScores = new Map(
  history.filter(d => d.snapshot_date === latestDate).map(d => [d.drep_id, d])
);
const drepsMap = new Map(dreps.map(d => [d.drep_id, d]));

const movers = Array.from(latestScores, ([id, latest]) => {
  const first = firstScores.get(id);
  if (!first) return null;
  const change = latest.score - first.score;
  if (change === 0) return null;
  const drepInfo = drepsMap.get(id);

  const pillarDeltas = [
    { name: "Participation", delta: (latest.effective_participation ?? 0) - (first.effective_participation ?? 0) },
    { name: "Rationale", delta: (latest.rationale_rate ?? 0) - (first.rationale_rate ?? 0) },
    { name: "Reliability", delta: (latest.reliability_score ?? 0) - (first.reliability_score ?? 0) },
    { name: "Profile", delta: (latest.profile_completeness ?? 0) - (first.profile_completeness ?? 0) },
  ];
  const biggestPillar = pillarDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  return {
    Name: drepInfo?.name || id.slice(0, 20) + "…",
    Previous: Math.round(first.score),
    Current: Math.round(latest.score),
    Change: Math.round(change),
    "Main Driver": `${biggestPillar.name} ${biggestPillar.delta >= 0 ? "+" : ""}${Math.round(biggestPillar.delta)}`,
  };
}).filter(Boolean);

const risers = movers.filter(d => d.Change > 0).sort((a, b) => b.Change - a.Change).slice(0, 10);
const decliners = movers.filter(d => d.Change < 0).sort((a, b) => a.Change - b.Change).slice(0, 10);
```

<div class="grid grid-cols-2">
  <div class="card">
    <h3 style="color: #10b981; margin-top: 0">▲ Top 10 Risers</h3>

```js
risers.length > 0
  ? Inputs.table(risers, {
      columns: ["Name", "Previous", "Current", "Change", "Main Driver"],
      format: {
        Change: d => html`<span class="badge badge-green">+${d}</span>`,
        Current: d => html`<span class="score-pill ${d >= 60 ? 'good' : d >= 30 ? 'warn' : 'bad'}">${d}</span>`,
      }
    })
  : html`<div class="empty-state">Need ≥ 2 snapshots to show movers.</div>`
```

  </div>
  <div class="card">
    <h3 style="color: #ef4444; margin-top: 0">▼ Top 10 Decliners</h3>

```js
decliners.length > 0
  ? Inputs.table(decliners, {
      columns: ["Name", "Previous", "Current", "Change", "Main Driver"],
      format: {
        Change: d => html`<span class="badge badge-red">${d}</span>`,
        Current: d => html`<span class="score-pill ${d >= 60 ? 'good' : d >= 30 ? 'warn' : 'bad'}">${d}</span>`,
      }
    })
  : html`<div class="empty-state">Need ≥ 2 snapshots to show movers.</div>`
```

  </div>
</div>

## What should we act on right now?

*Quick pulse on systemic issues across the network.*

```js
const uniformVoters = activeDreps.filter(d => d.deliberation_modifier != null && d.deliberation_modifier < 0.95).length;
const lowReliability = activeDreps.filter(d => (d.reliability_score ?? 0) < 30).length;
const incompleteProfile = activeDreps.filter(d => (d.profile_completeness ?? 0) < 50).length;
```

<div class="kpi-row cols-4">
  <div class="kpi">
    <span class="kpi-label">Zero Rationale</span>
    <span class="kpi-value ${zeroRationale > 0 ? 'bad' : 'good'}">${zeroRationale}</span>
    <span class="kpi-sub">never explained a vote — 35% weight drag</span>
    <div class="kpi-bar" style="background: ${zeroRationale > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Uniform Voters</span>
    <span class="kpi-value ${uniformVoters > 0 ? 'warn' : 'good'}">${uniformVoters}</span>
    <span class="kpi-sub">deliberation modifier &lt; 0.95</span>
    <div class="kpi-bar" style="background: ${uniformVoters > 0 ? 'var(--accent-amber)' : 'var(--accent-green)'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Low Reliability</span>
    <span class="kpi-value ${lowReliability > 0 ? 'warn' : 'good'}">${lowReliability}</span>
    <span class="kpi-sub">reliability score below 30</span>
    <div class="kpi-bar" style="background: ${lowReliability > 0 ? 'var(--accent-amber)' : 'var(--accent-green)'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Incomplete Profiles</span>
    <span class="kpi-value ${incompleteProfile > 0 ? 'warn' : 'good'}">${incompleteProfile}</span>
    <span class="kpi-sub">profile completeness below 50%</span>
    <div class="kpi-bar" style="background: ${incompleteProfile > 0 ? 'var(--accent-amber)' : 'var(--accent-green)'}"></div>
  </div>
</div>

---

<span class="muted" style="font-size: 0.75rem">Dashboard built: ${new Date(buildTime).toLocaleString()}</span>
