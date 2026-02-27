# Voting Intelligence

```js
const votes = FileAttachment("data/votes.json").json();
const dreps = FileAttachment("data/dreps.json").json();
const proposals = FileAttachment("data/proposals.json").json();
```

```js
const activeDreps = dreps.filter(d => d.is_active);
const activeDrepCount = activeDreps.length;
const totalVotes = votes.length;
const yesCount = votes.filter(d => d.vote === "Yes").length;
const noCount = votes.filter(d => d.vote === "No").length;
const abstainCount = votes.filter(d => d.vote === "Abstain").length;
const uniqueProposals = new Set(votes.map(d => `${d.proposal_tx_hash}-${d.proposal_index}`)).size;
const drepsWhoVoted = new Set(votes.map(d => d.drep_id)).size;
const avgVotesPerDrep = drepsWhoVoted > 0 ? (totalVotes / drepsWhoVoted) : 0;
const yesPct = totalVotes > 0 ? (yesCount / totalVotes * 100) : 0;
const noPct = totalVotes > 0 ? (noCount / totalVotes * 100) : 0;
const abstainPct = totalVotes > 0 ? (abstainCount / totalVotes * 100) : 0;

function scoreColor(v) { return v >= 60 ? "#10b981" : v >= 30 ? "#f59e0b" : "#ef4444"; }
function scoreTier(v) { return v >= 60 ? "good" : v >= 30 ? "warn" : "bad"; }
```

<div class="kpi-row cols-3">
  <div class="kpi">
    <span class="kpi-label">Total On-Chain Votes</span>
    <span class="kpi-value">${totalVotes.toLocaleString()}</span>
    <span class="kpi-sub">
      <span class="good">${yesCount.toLocaleString()} Yes (${Math.round(yesPct)}%)</span> ·
      <span class="bad">${noCount.toLocaleString()} No (${Math.round(noPct)}%)</span> ·
      <span class="warn">${abstainCount.toLocaleString()} Abstain (${Math.round(abstainPct)}%)</span>
    </span>
    <div class="kpi-bar" style="background: var(--accent)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Proposals Voted On</span>
    <span class="kpi-value">${uniqueProposals}</span>
    <span class="kpi-sub">${proposals.length} total proposals in system · ${proposals.length > 0 ? Math.round(uniqueProposals / proposals.length * 100) : 0}% coverage</span>
    <div class="kpi-bar" style="background: var(--accent-purple)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Avg Votes per DRep</span>
    <span class="kpi-value">${avgVotesPerDrep.toFixed(1)}</span>
    <span class="kpi-sub">${drepsWhoVoted} DReps have cast at least one vote</span>
    <div class="kpi-bar" style="background: var(--accent-green)"></div>
  </div>
</div>

## How do DReps vote?

*Overall vote split across all on-chain votes.*

```js
const voteProportions = [
  { direction: "Yes", count: yesCount },
  { direction: "No", count: noCount },
  { direction: "Abstain", count: abstainCount },
];
```

```js
Plot.plot({
  height: 70,
  marginLeft: 0,
  x: { label: null },
  y: { label: null, axis: null },
  color: {
    domain: ["Yes", "No", "Abstain"],
    range: ["#10b981", "#ef4444", "#f59e0b"],
    legend: true,
  },
  marks: [
    Plot.barX(voteProportions, Plot.stackX({
      x: "count", fill: "direction",
      tip: true,
      channels: { percentage: d => `${(d.count / totalVotes * 100).toFixed(1)}%` },
    })),
    Plot.text(voteProportions, Plot.stackX({
      x: "count",
      text: d => `${d.direction} ${(d.count / totalVotes * 100).toFixed(0)}%`,
      fill: "white", fontSize: 13, fontWeight: 600,
    })),
  ]
})
```

## Votes by proposal type

*How does voting behavior differ across governance categories? Hover for full breakdown.*

```js
const voteTypeFilter = view(Inputs.select(
  ["All", ...new Set(votes.map(d => d.proposal_type).filter(Boolean))],
  { label: "Proposal type", value: "All" }
));
```

```js
const filteredVotes = voteTypeFilter === "All" ? votes : votes.filter(d => d.proposal_type === voteTypeFilter);

const typeVoteData = d3.flatRollup(
  filteredVotes.filter(d => d.proposal_type),
  v => v.length,
  d => d.proposal_type,
  d => d.vote
).map(([type, vote, count]) => ({ type, vote, count }));
```

```js
Plot.plot({
  height: Math.max(250, new Set(typeVoteData.map(d => d.type)).size * 40),
  marginLeft: 200,
  style: { fontSize: "11px" },
  x: { label: "Votes →", grid: true },
  y: { label: null },
  color: {
    domain: ["Yes", "No", "Abstain"],
    range: ["#10b981", "#ef4444", "#f59e0b"],
    legend: true,
  },
  marks: [
    Plot.barX(typeVoteData, Plot.stackX({
      x: "count", y: "type", fill: "vote",
      sort: { y: "-x", reduce: "sum" },
      tip: true,
      channels: {
        "% of type": d => {
          const typeTotal = d3.sum(typeVoteData.filter(t => t.type === d.type), t => t.count);
          return `${(d.count / typeTotal * 100).toFixed(0)}%`;
        },
      },
    })),
    Plot.ruleX([0]),
  ]
})
```

<div class="tip-box">
  <strong>Critical types</strong> (HardForkInitiation, NoConfidence, NewCommittee, NewConstitution) affect the chain's fundamental operation. High No/Abstain rates on these categories may signal healthy deliberation — or insufficient engagement.
</div>

## Monthly voting activity

*Is governance participation growing over time?*

```js
const monthlyVotes = d3.flatRollup(
  votes,
  v => v.length,
  d => {
    const date = new Date(d.block_time * 1000);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  },
  d => d.vote
).map(([month, vote, count]) => ({ month, vote, count })).sort((a, b) => a.month - b.month);
```

```js
Plot.plot({
  height: 320,
  style: { fontSize: "12px" },
  x: { label: null, type: "utc" },
  y: { label: "↑ Votes", grid: true },
  color: {
    domain: ["Yes", "No", "Abstain"],
    range: ["#10b981", "#ef4444", "#f59e0b"],
    legend: true,
  },
  marks: [
    Plot.areaY(monthlyVotes, Plot.stackY({
      x: "month", y: "count", fill: "vote",
      curve: "monotone-x", fillOpacity: 0.7,
      order: ["Yes", "No", "Abstain"],
      tip: true,
      channels: {
        month: d => d3.utcFormat("%B %Y")(d.month),
      },
    })),
    Plot.ruleY([0]),
  ]
})
```

## How contentious are proposals?

*Distribution of consensus rates — lower = more contentious. Only proposals with ≥ 3 votes included.*

```js
const proposalVotes = d3.group(votes, d => `${d.proposal_tx_hash}-${d.proposal_index}`);
const proposalMap = new Map(proposals.map(p => [`${p.tx_hash}-${p.proposal_index}`, p]));

const consensusData = Array.from(proposalVotes, ([key, pvotes]) => {
  const total = pvotes.length;
  if (total < 3) return null;
  const yes = pvotes.filter(d => d.vote === "Yes").length;
  const no = pvotes.filter(d => d.vote === "No").length;
  const abstain = pvotes.filter(d => d.vote === "Abstain").length;
  const majority = Math.max(yes, no, abstain);
  const p = proposalMap.get(key);
  return {
    proposal: p?.title || key.slice(0, 30),
    consensus: majority / total,
    total,
  };
}).filter(Boolean);
```

```js
if (consensusData.length > 0) {
  const buckets = [
    { label: "Contentious (<60%)", count: consensusData.filter(d => d.consensus < 0.6).length, color: "#ef4444" },
    { label: "Moderate (60–90%)", count: consensusData.filter(d => d.consensus >= 0.6 && d.consensus < 0.9).length, color: "#f59e0b" },
    { label: "High consensus (≥90%)", count: consensusData.filter(d => d.consensus >= 0.9).length, color: "#10b981" },
  ];
  display(Plot.plot({
    height: 200,
    marginLeft: 200,
    marginRight: 50,
    style: { fontSize: "12px" },
    x: { label: "Proposals →", grid: true },
    y: { label: null },
    marks: [
      Plot.barX(buckets, {
        x: "count", y: "label",
        fill: d => d.color,
        fillOpacity: 0.8,
        tip: true,
        channels: { "% of analyzed": d => `${(d.count / consensusData.length * 100).toFixed(0)}%` },
      }),
      Plot.text(buckets, {
        x: "count", y: "label",
        text: d => `${d.count} (${(d.count / consensusData.length * 100).toFixed(0)}%)`,
        dx: 8, textAnchor: "start", fontSize: 11, fill: "currentColor",
      }),
      Plot.ruleX([0]),
    ]
  }));
  display(html`<div class="metric-note">${consensusData.length} proposals with ≥ 3 votes analyzed</div>`);
} else {
  display(html`<div class="empty-state"><strong>Not enough data</strong>Need proposals with ≥ 3 votes to analyze contentiousness.</div>`);
}
```

<div class="threshold-legend">
  <span class="legend-red">&lt;60% — Contentious</span>
  <span class="legend-yellow">60–90% — Moderate consensus</span>
  <span class="legend-green">&gt;90% — High consensus</span>
</div>

<div class="tip-box">
  <strong>Reading this chart:</strong> Proposals &lt;60% consensus indicate genuine deliberation. Consistently high consensus (&gt;90%) across all proposals might indicate rubber-stamping rather than independent analysis. A healthy network shows a spread.
</div>

## Which proposal types get the most engagement?

```js
const proposalsByType = d3.group(proposals, d => d.proposal_type);
const engagementByType = Array.from(proposalsByType, ([type, props]) => {
  const proposalKeys = new Set(props.map(p => `${p.tx_hash}-${p.proposal_index}`));
  const typeVotes = votes.filter(v => proposalKeys.has(`${v.proposal_tx_hash}-${v.proposal_index}`));
  const avgVotes = props.length > 0 ? typeVotes.length / props.length : 0;
  const engagementRate = activeDrepCount > 0 ? (avgVotes / activeDrepCount * 100) : 0;
  return { type, avgVotes: Math.round(avgVotes), engagementRate, proposalCount: props.length };
}).filter(d => d.proposalCount > 0).sort((a, b) => b.engagementRate - a.engagementRate);
```

```js
Plot.plot({
  height: Math.max(200, engagementByType.length * 40),
  marginLeft: 200,
  marginRight: 60,
  style: { fontSize: "11px" },
  x: { label: "Engagement Rate (%) →", grid: true },
  y: { label: null },
  marks: [
    Plot.barX(engagementByType, {
      x: "engagementRate", y: "type",
      fill: d => d.engagementRate >= 70 ? "#10b981" : d.engagementRate >= 40 ? "#f59e0b" : "#ef4444",
      fillOpacity: 0.8,
      sort: { y: "-x" },
      tip: true,
      channels: {
        "Avg votes": d => d.avgVotes,
        Proposals: d => d.proposalCount,
      },
    }),
    Plot.text(engagementByType, {
      x: "engagementRate", y: "type",
      text: d => `${d.engagementRate.toFixed(0)}% (${d.proposalCount})`,
      dx: 5, textAnchor: "start", fontSize: 11, fill: "currentColor",
    }),
    Plot.ruleX([0]),
  ]
})
```

## Independent thinkers

*DReps who vote against the majority most often — a sign of independent analysis. High contrarian + high rationale = strong deliberator.*

```js
const proposalMajorities = new Map();
for (const [key, pvotes] of proposalVotes) {
  const yes = pvotes.filter(d => d.vote === "Yes").length;
  const no = pvotes.filter(d => d.vote === "No").length;
  const abstain = pvotes.filter(d => d.vote === "Abstain").length;
  if (yes >= no && yes >= abstain) proposalMajorities.set(key, "Yes");
  else if (no >= yes && no >= abstain) proposalMajorities.set(key, "No");
  else proposalMajorities.set(key, "Abstain");
}

const drepMap = new Map(dreps.map(d => [d.drep_id, d]));
const drepVoteGroups = d3.group(votes, d => d.drep_id);

function formatAda(v) {
  if (v >= 1e9) return `₳${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `₳${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `₳${(v / 1e3).toFixed(0)}K`;
  return `₳${Math.round(v)}`;
}

const contrarianData = Array.from(drepVoteGroups, ([drepId, drepVotes]) => {
  const total = drepVotes.length;
  if (total < 5) return null;
  const against = drepVotes.filter(v => {
    const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
    const majority = proposalMajorities.get(key);
    return majority && v.vote !== majority;
  }).length;
  const drep = drepMap.get(drepId);
  const yesPct = Math.round(drepVotes.filter(v => v.vote === "Yes").length / total * 100);
  const noPct = Math.round(drepVotes.filter(v => v.vote === "No").length / total * 100);
  const abstainPct = 100 - yesPct - noPct;
  const contrRate = against / total * 100;
  const ratRate = drep?.rationale_rate ?? 0;
  const verdict = contrRate >= 20 && ratRate >= 50 ? "Strong deliberator"
    : contrRate >= 20 && ratRate < 20 ? "Contrarian but silent"
    : contrRate < 10 ? "Consensus-aligned"
    : "Independent";
  return {
    Name: drep?.name || drepId.slice(0, 20) + "…",
    "Contrarian Rate": contrRate,
    "Rationale Rate": drep?.rationale_rate ?? null,
    Score: drep?.score != null ? Math.round(drep.score) : null,
    "Voting Power": drep?.voting_power ?? 0,
    "Vote Split": `${yesPct}Y / ${noPct}N / ${abstainPct}A`,
    "Total Votes": total,
    Assessment: verdict,
  };
}).filter(Boolean).sort((a, b) => b["Contrarian Rate"] - a["Contrarian Rate"]).slice(0, 20);
```

```js
const contrarianSearch = view(Inputs.search(contrarianData, { placeholder: "Search DRep…", columns: ["Name"] }));
```

```js
contrarianSearch.length > 0
  ? Inputs.table(contrarianSearch, {
      columns: ["Name", "Assessment", "Contrarian Rate", "Rationale Rate", "Vote Split", "Score", "Voting Power", "Total Votes"],
      format: {
        "Contrarian Rate": d => html`<span class="badge badge-purple">${d.toFixed(1)}%</span>`,
        Score: d => d != null ? html`<span class="score-pill ${scoreTier(d)}">${d}</span>` : "—",
        "Rationale Rate": d => d != null ? html`<span style="color:${scoreColor(d)}">${d}%</span>` : "—",
        "Voting Power": d => formatAda(d),
        Assessment: d => {
          const cls = d === "Strong deliberator" ? "badge-green"
            : d === "Contrarian but silent" ? "badge-red"
            : d === "Consensus-aligned" ? "badge-blue"
            : "badge-amber";
          return html`<span class="badge ${cls}">${d}</span>`;
        },
      },
      sort: "Contrarian Rate",
      reverse: true,
    })
  : html`<div class="empty-state">Need DReps with ≥ 5 votes to analyze contrarian patterns.</div>`
```

<div class="tip-box">
  <strong>How to read this:</strong> <span class="badge badge-green" style="font-size:0.72rem">Strong deliberator</span> = votes independently AND explains why (high contrarian + high rationale). <span class="badge badge-red" style="font-size:0.72rem">Contrarian but silent</span> = votes against consensus but rarely explains — worth outreach. <span class="badge badge-blue" style="font-size:0.72rem">Consensus-aligned</span> = generally agrees with majority.
</div>
