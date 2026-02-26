# Governance Activity

```js
const proposals = FileAttachment("data/proposals.json").json();
const votes = FileAttachment("data/votes.json").json();
const dreps = FileAttachment("data/dreps.json").json();
const pollResponses = FileAttachment("data/poll-responses.json").json();
```

```js
const activeDreps = dreps.filter(d => d.is_active);
const activeDrepCount = activeDreps.length;

function formatAda(v) {
  if (v >= 1e9) return `₳${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `₳${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `₳${(v / 1e3).toFixed(0)}K`;
  return `₳${Math.round(v)}`;
}

const proposalTypes = ["All", ...new Set(proposals.map(p => p.proposal_type).filter(Boolean))];
const statuses = ["All", "open", "ratified", "enacted", "dropped", "expired"];
const statusColors = { open: "#4f8cff", ratified: "#a78bfa", enacted: "#10b981", dropped: "#ef4444", expired: "#6b7280" };
```

<div class="kpi-row cols-4">
  <div class="kpi">
    <span class="kpi-label">Total Proposals</span>
    <span class="kpi-value">${proposals.length}</span>
    <span class="kpi-sub">${new Set(proposals.map(p => p.proposal_type)).size} distinct types</span>
    <div class="kpi-bar" style="background: var(--accent)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Open / Active</span>
    <span class="kpi-value" style="color: #4f8cff">${proposals.filter(d => d.status === "open").length}</span>
    <span class="kpi-sub">awaiting votes or ratification</span>
    <div class="kpi-bar" style="background: #4f8cff"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Enacted</span>
    <span class="kpi-value good">${proposals.filter(d => d.status === "enacted").length}</span>
    <span class="kpi-sub">${proposals.length > 0 ? Math.round(proposals.filter(d => d.status === "enacted").length / proposals.length * 100) : 0}% pass rate</span>
    <div class="kpi-bar" style="background: var(--accent-green)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Treasury Proposals</span>
    <span class="kpi-value">${proposals.filter(d => d.proposal_type === "TreasuryWithdrawals").length}</span>
    <span class="kpi-sub">${proposals.filter(p => p.proposal_type === "TreasuryWithdrawals" && p.status === "enacted").length} enacted · ${proposals.filter(p => p.proposal_type === "TreasuryWithdrawals" && p.status === "open").length} open</span>
    <div class="kpi-bar" style="background: var(--accent-purple)"></div>
  </div>
</div>

## What's the proposal pipeline?

*All proposals by current status — hover for counts.*

```js
const statusOrder = ["open", "ratified", "enacted", "dropped", "expired"];
const statusCounts = statusOrder.map(s => ({
  status: s.charAt(0).toUpperCase() + s.slice(1),
  count: proposals.filter(d => d.status === s).length,
  key: s,
})).filter(d => d.count > 0);
```

```js
Plot.plot({
  height: 80,
  marginLeft: 0,
  marginTop: 0,
  x: { label: null },
  y: { label: null, axis: null },
  color: {
    domain: statusCounts.map(d => d.status),
    range: statusCounts.map(d => statusColors[d.key]),
    legend: true,
    label: "Status",
  },
  marks: [
    Plot.barX(statusCounts, Plot.stackX({
      x: "count", fill: "status",
      tip: true,
      channels: { "% of total": d => `${(d.count / proposals.length * 100).toFixed(0)}%` },
    })),
    Plot.text(statusCounts, Plot.stackX({
      x: "count",
      text: d => d.count > 0 ? `${d.count}` : "",
      fill: "white", fontSize: 14, fontWeight: 700,
    })),
  ]
})
```

<div class="tip-box">
  <strong>Proposal lifecycle:</strong> <em>Open</em> → <em>Ratified</em> (governance approved) → <em>Enacted</em> (on-chain). Failures become <em>Dropped</em>; timeouts become <em>Expired</em>.
</div>

## Explore proposals

*Filter by type and status, then sort by any column.*

<div class="filter-bar">

```js
const typeFilter = view(Inputs.select(proposalTypes, { label: "Type", value: "All" }));
```

```js
const statusFilter = view(Inputs.select(statuses, { label: "Status", value: "All" }));
```

</div>

```js
const filteredProposals = proposals.filter(p =>
  (typeFilter === "All" || p.proposal_type === typeFilter) &&
  (statusFilter === "All" || p.status === statusFilter)
);

const maxEpoch = d3.max(votes, d => d.epoch_no) || 0;
const proposalVoteCounts = d3.rollup(votes, v => v.length, d => `${d.proposal_tx_hash}-${d.proposal_index}`);

const proposalTable = filteredProposals.map(p => {
  const key = `${p.tx_hash}-${p.proposal_index}`;
  const voteCount = proposalVoteCounts.get(key) || 0;
  const engPct = activeDrepCount > 0 ? Math.round(voteCount / activeDrepCount * 100) : 0;
  return {
    Title: (p.title || `${p.tx_hash.slice(0, 16)}…`).slice(0, 55),
    Type: p.proposal_type,
    Status: p.status,
    Votes: voteCount,
    "Engagement": engPct,
    "Proposed Epoch": p.proposed_epoch,
    "Expires": p.expiration_epoch ?? "—",
  };
});
```

```js
Inputs.table(proposalTable, {
  sort: "Engagement",
  reverse: true,
  rows: 15,
  format: {
    Status: d => {
      const c = statusColors[d] || "inherit";
      const badge = d === "open" ? "badge-blue" : d === "enacted" ? "badge-green" : d === "dropped" ? "badge-red" : d === "expired" ? "badge-amber" : "badge-purple";
      return html`<span class="badge ${badge}">${d}</span>`;
    },
    "Engagement": d => {
      const c = d >= 70 ? "good" : d >= 40 ? "warn" : "bad";
      return html`<span class="score-pill ${c}">${d}%</span>`;
    },
    Type: d => html`<span style="font-size:0.78rem">${d}</span>`,
  },
})
```

## Which proposals need more engagement?

*Open proposals ranked by DRep participation rate — low engagement with few epochs remaining needs attention.*

```js
const proposalVoteBreakdown = d3.rollup(
  votes,
  v => d3.rollup(v, vv => vv.length, dd => dd.vote),
  d => `${d.proposal_tx_hash}-${d.proposal_index}`
);

const openProposals = proposals.filter(d => d.status === "open");
const openWithEngagement = openProposals.map(p => {
  const key = `${p.tx_hash}-${p.proposal_index}`;
  const totalVotes = proposalVoteCounts.get(key) || 0;
  const pct = activeDrepCount > 0 ? (totalVotes / activeDrepCount * 100) : 0;
  const bd = proposalVoteBreakdown.get(key) || new Map();
  const epochsLeft = (p.expiration_epoch || 0) - maxEpoch;
  return {
    title: p.title || `${p.tx_hash.slice(0, 12)}…#${p.proposal_index}`,
    type: p.proposal_type,
    pct: Math.round(pct),
    epochsLeft,
    yes: bd.get("Yes") || 0,
    no: bd.get("No") || 0,
    abstain: bd.get("Abstain") || 0,
    totalVotes,
    urgent: pct < 50 && epochsLeft <= 3 && epochsLeft > 0,
  };
}).sort((a, b) => a.pct - b.pct);
```

```js
openWithEngagement.length > 0
  ? html`<div style="display:flex;flex-direction:column;gap:0.75rem">
      ${openWithEngagement.map(d => {
        const barColor = d.pct >= 70 ? "#10b981" : d.pct >= 40 ? "#f59e0b" : "#ef4444";
        const title = d.title.length > 60 ? d.title.slice(0, 60) + "…" : d.title;
        return html`<div class="engagement-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
            <span style="font-size:0.85rem;font-weight:500">${title} ${d.urgent ? html`<span class="badge badge-red" style="margin-left:0.5rem">URGENT</span>` : ""}</span>
            <span style="font-size:0.72rem;color:var(--theme-foreground-muted)">${d.type} · ${d.epochsLeft > 0 ? `${d.epochsLeft} epochs left` : "expired"}</span>
          </div>
          <div class="progress-bar" style="margin-bottom:0.35rem">
            <div class="progress-fill" style="width:${Math.min(d.pct, 100)}%;background:${barColor}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--theme-foreground-muted)">
            <span><strong style="color:${barColor}">${d.pct}%</strong> of active DReps voted (${d.totalVotes})</span>
            <span><span class="good">${d.yes}Y</span> · <span class="bad">${d.no}N</span> · <span class="warn">${d.abstain}A</span></span>
          </div>
        </div>`;
      })}
    </div>`
  : html`<div class="empty-state"><strong>No open proposals</strong>All proposals have been resolved.</div>`
```

<div class="threshold-legend">
  <span class="legend-red">&lt;40% engagement — low</span>
  <span class="legend-yellow">40–70% — moderate</span>
  <span class="legend-green">&gt;70% — healthy</span>
</div>

## How is voting power distributed across proposals?

```js
const proposalVoteData = d3.group(votes, d => `${d.proposal_tx_hash}-${d.proposal_index}`);
const proposalMap = new Map(proposals.map(p => [`${p.tx_hash}-${p.proposal_index}`, p]));

const powerByProposal = Array.from(proposalVoteData, ([key, pvotes]) => {
  const p = proposalMap.get(key);
  const label = (p?.title || key.slice(0, 30)).slice(0, 40);
  const yesPower = d3.sum(pvotes.filter(v => v.vote === "Yes"), v => (v.voting_power_lovelace ?? 0)) / 1e6;
  const noPower = d3.sum(pvotes.filter(v => v.vote === "No"), v => (v.voting_power_lovelace ?? 0)) / 1e6;
  const abPower = d3.sum(pvotes.filter(v => v.vote === "Abstain"), v => (v.voting_power_lovelace ?? 0)) / 1e6;
  return { label, yesPower, noPower, abPower, total: yesPower + noPower + abPower };
}).filter(d => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);

const powerFlat = powerByProposal.flatMap(d => [
  { proposal: d.label, direction: "Yes", power: d.yesPower },
  { proposal: d.label, direction: "No", power: d.noPower },
  { proposal: d.label, direction: "Abstain", power: d.abPower },
]);
```

```js
powerFlat.length > 0
  ? Plot.plot({
      height: Math.max(200, powerByProposal.length * 36),
      marginLeft: 260,
      style: { fontSize: "11px" },
      x: { label: "Voting Power (ADA) →", grid: true, tickFormat: d => formatAda(d) },
      y: { label: null },
      color: {
        domain: ["Yes", "No", "Abstain"],
        range: ["#10b981", "#ef4444", "#f59e0b"],
        legend: true,
      },
      marks: [
        Plot.barX(powerFlat, Plot.stackX({
          x: "power", y: "proposal", fill: "direction",
          tip: true,
          channels: { "ADA amount": d => formatAda(d.power) },
        })),
        Plot.ruleX([0]),
      ]
    })
  : html`<div class="empty-state"><strong>No voting power data</strong>Voting power per vote isn't available yet.</div>`
```

## Treasury proposals

*All treasury withdrawal proposals by status. Withdrawal amounts are not yet populated in our data pipeline.*

```js
const treasuryProposals = proposals.filter(d => d.proposal_type === "TreasuryWithdrawals");
const treasuryTable = treasuryProposals.map(p => ({
  Title: (p.title || `${p.tx_hash.slice(0, 16)}…`).slice(0, 50),
  Status: p.status,
  "Proposed Epoch": p.proposed_epoch,
  "Expires": p.expiration_epoch ?? "—",
})).sort((a, b) => {
  const order = { open: 0, ratified: 1, enacted: 2, dropped: 3, expired: 4 };
  return (order[a.Status] ?? 5) - (order[b.Status] ?? 5);
});
```

```js
treasuryTable.length > 0
  ? Inputs.table(treasuryTable, {
      format: {
        Status: d => {
          const badge = d === "open" ? "badge-blue" : d === "enacted" ? "badge-green" : d === "dropped" ? "badge-red" : d === "expired" ? "badge-amber" : "badge-purple";
          return html`<span class="badge ${badge}">${d}</span>`;
        }
      }
    })
  : html`<div class="empty-state">No treasury proposals found.</div>`
```

<div class="alert-box">
  <strong>Note:</strong> Withdrawal amounts are not yet populated by the sync pipeline. Once available, this section will show ADA amounts and approval rates.
</div>

## Are delegators represented?

```js
const pollsWithMatch = pollResponses.filter(d => d.user_vote && d.drep_vote);
const alignmentRate = pollsWithMatch.length > 0
  ? (pollsWithMatch.filter(d => d.user_vote === d.drep_vote).length / pollsWithMatch.length * 100)
  : null;
```

```js
if (alignmentRate !== null) {
  const color = alignmentRate >= 70 ? "#10b981" : alignmentRate >= 50 ? "#f59e0b" : "#ef4444";
  display(html`<div class="kpi-row cols-3">
    <div class="kpi">
      <span class="kpi-label">Delegator–DRep Alignment</span>
      <span class="kpi-value" style="color:${color}">${alignmentRate.toFixed(0)}%</span>
      <span class="kpi-sub">${pollsWithMatch.length} poll responses matched to on-chain votes</span>
      <div class="kpi-bar" style="background:${color}"></div>
    </div>
    <div class="kpi">
      <span class="kpi-label">Poll Responses</span>
      <span class="kpi-value">${pollResponses.length}</span>
      <span class="kpi-sub">total poll submissions from delegators</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Matched to Votes</span>
      <span class="kpi-value">${pollsWithMatch.length}</span>
      <span class="kpi-sub">responses where DRep also voted on the proposal</span>
    </div>
  </div>`);
} else {
  display(html`<div class="empty-state"><strong>No alignment data yet</strong>Delegator polls haven't been matched to DRep votes. This will populate as delegators use the polling feature.</div>`);
}
```

<div class="tip-box">
  <strong>Representation gap:</strong> When delegators' poll votes differ significantly from their DRep's on-chain votes, it signals misalignment. Low alignment may mean DReps aren't reflecting their delegators' preferences.
</div>
