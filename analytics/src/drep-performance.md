# DRep Performance

```js
const dreps = FileAttachment("data/dreps.json").json();
const history = FileAttachment("data/score-history.json").json();
const votes = FileAttachment("data/votes.json").json();
```

```js
const activeDreps = dreps.filter(d => d.is_active);
const tiers = ["Small", "Medium", "Large", "Whale"];

function scoreColor(v) { return v >= 60 ? "#10b981" : v >= 30 ? "#f59e0b" : "#ef4444"; }
function scoreTier(v) { return v >= 60 ? "good" : v >= 30 ? "warn" : "bad"; }
function formatAda(v) {
  if (v >= 1e9) return `₳${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `₳${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `₳${(v / 1e3).toFixed(0)}K`;
  return `₳${Math.round(v)}`;
}
```

<div class="filter-bar">

```js
const nameFilter = view(Inputs.search(activeDreps, { placeholder: "Search DReps by name…", columns: ["name"] }));
```

```js
const tierFilter = view(Inputs.select(["All", ...tiers], { label: "Size tier", value: "All" }));
```

```js
const minScore = view(Inputs.range([0, 100], { label: "Min score", step: 5, value: 0 }));
```

</div>

```js
const filtered = nameFilter.filter(d =>
  (tierFilter === "All" || d.size_tier === tierFilter) &&
  (d.score ?? 0) >= minScore
);
```

## How is each DRep performing?

*Full sortable table — click column headers to sort, use filters above to narrow down.*

```js
Inputs.table(
  filtered.map(d => ({
    Name: d.name || d.drep_id.slice(0, 20) + "…",
    Score: d.score != null ? Math.round(d.score) : null,
    Participation: d.effective_participation ?? d.participation_rate ?? null,
    Rationale: d.rationale_rate ?? null,
    Reliability: d.reliability_score ?? null,
    Profile: d.profile_completeness ?? null,
    "Voting Power": d.voting_power ?? 0,
    Tier: d.size_tier || "—",
  })),
  {
    format: {
      Score: d => d != null ? html`<span class="score-pill ${scoreTier(d)}">${d}</span>` : "—",
      Participation: d => d != null ? html`<span style="color:${scoreColor(d)}">${d}%</span>` : "—",
      Rationale: d => d != null ? html`<span style="color:${scoreColor(d)}">${d}%</span>` : "—",
      Reliability: d => d != null ? html`<span style="color:${scoreColor(d)}">${d}</span>` : "—",
      Profile: d => d != null ? html`<span style="color:${scoreColor(d)}">${d}%</span>` : "—",
      "Voting Power": d => formatAda(d),
      Tier: d => html`<span class="badge badge-blue">${d}</span>`,
    },
    sort: "Score",
    reverse: true,
    rows: 20,
  }
)
```

## Where are the systemic weaknesses?

*Count of DReps scoring below 50 on each pillar — the tallest bar is the network's biggest drag.*

```js
const weaknessData = [
  { pillar: "Rationale (35%)", count: activeDreps.filter(d => (d.rationale_rate ?? 0) < 50).length },
  { pillar: "Participation (30%)", count: activeDreps.filter(d => (d.effective_participation ?? 0) < 50).length },
  { pillar: "Reliability (20%)", count: activeDreps.filter(d => (d.reliability_score ?? 0) < 50).length },
  { pillar: "Profile (15%)", count: activeDreps.filter(d => (d.profile_completeness ?? 0) < 50).length },
];
const maxWeakness = d3.max(weaknessData, d => d.count) ?? 1;
```

```js
Plot.plot({
  height: 260,
  marginLeft: 160,
  marginRight: 50,
  style: { fontSize: "12px" },
  x: { label: "DReps below 50 →", grid: true },
  y: { label: null },
  marks: [
    Plot.barX(weaknessData, {
      x: "count", y: "pillar",
      fill: d => d.count === maxWeakness ? "#ef4444" : "#4f8cff",
      fillOpacity: 0.8,
      sort: { y: "-x" },
      tip: true,
      channels: { "% of active": d => `${(d.count / activeDreps.length * 100).toFixed(0)}%` },
    }),
    Plot.text(weaknessData, {
      x: "count", y: "pillar",
      text: d => `${d.count} (${(d.count / activeDreps.length * 100).toFixed(0)}%)`,
      dx: 14, fill: "currentColor", fontSize: 12, fontWeight: 600,
    }),
    Plot.ruleX([0]),
  ]
})
```

<div class="tip-box">
  <strong>Rationale is the highest-weighted pillar at 35%.</strong> If the red bar is longest, that's the biggest lever for lifting network-wide scores. Targeted education and tooling for rationale writing would have the most impact.
</div>

## Who is voting uniformly?

*DReps penalized for casting the same vote on nearly every proposal — includes their vote percentage breakdown.*

```js
const votesByDrep = d3.group(votes, d => d.drep_id);

const uniformVoters = activeDreps
  .filter(d => d.deliberation_modifier != null && d.deliberation_modifier < 0.95)
  .map(d => {
    const dv = votesByDrep.get(d.drep_id) || [];
    const total = dv.length;
    const yesPct = total > 0 ? (dv.filter(v => v.vote === "Yes").length / total * 100) : 0;
    const noPct = total > 0 ? (dv.filter(v => v.vote === "No").length / total * 100) : 0;
    const abstainPct = total > 0 ? (dv.filter(v => v.vote === "Abstain").length / total * 100) : 0;
    const modeCounts = d3.rollup(dv, v => v.length, v => v.vote);
    const modeVote = modeCounts.size > 0
      ? [...modeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : "—";
    return {
      Name: d.name || d.drep_id.slice(0, 20) + "…",
      Score: Math.round(d.score ?? 0),
      Modifier: (d.deliberation_modifier ?? 0).toFixed(3),
      "Dominant Vote": modeVote,
      "Y / N / A": `${Math.round(yesPct)}% / ${Math.round(noPct)}% / ${Math.round(abstainPct)}%`,
      Votes: d.total_votes ?? total,
    };
  })
  .sort((a, b) => +a.Modifier - +b.Modifier);
```

<div class="tip-box">
  <strong>Deliberation penalty:</strong> DReps who vote the same direction on &gt;90% of proposals receive a modifier &lt; 1.0 on their effective participation. The "Y / N / A" column shows their vote split. A healthy distribution signals genuine deliberation.
</div>

```js
uniformVoters.length > 0
  ? Inputs.table(uniformVoters, {
      format: {
        Score: d => html`<span class="score-pill ${scoreTier(d)}">${d}</span>`,
        Modifier: d => html`<span class="badge badge-amber">${d}</span>`,
        "Dominant Vote": d => {
          const c = d === "Yes" ? "badge-green" : d === "No" ? "badge-red" : "badge-amber";
          return html`<span class="badge ${c}">${d}</span>`;
        },
      },
      sort: "Modifier",
    })
  : html`<div class="empty-state">No DReps currently flagged for uniform voting.</div>`
```

## How do scores vary by delegation size?

*Box plot of DRep scores grouped by size tier — hover dots for individual DRep details.*

```js
const tierOrder = ["Small", "Medium", "Large", "Whale"];
const tierData = activeDreps.filter(d => d.size_tier && tierOrder.includes(d.size_tier));
```

```js
Plot.plot({
  height: 380,
  marginLeft: 80,
  style: { fontSize: "12px" },
  x: { label: "Size Tier", domain: tierOrder },
  y: { label: "↑ DRep Score", domain: [0, 100], grid: true },
  marks: [
    Plot.boxY(tierData, {
      x: "size_tier", y: "score",
      fill: "#4f8cff", fillOpacity: 0.2, stroke: "#4f8cff",
    }),
    Plot.dot(tierData, {
      x: "size_tier", y: "score",
      fill: "#4f8cff", fillOpacity: 0.15, r: 3,
      tip: true,
      channels: {
        Name: d => d.name || d.drep_id.slice(0, 16),
        "Voting Power": d => formatAda(d.voting_power ?? 0),
        Participation: d => `${Math.round(d.effective_participation ?? 0)}%`,
        Rationale: d => `${Math.round(d.rationale_rate ?? 0)}%`,
      },
    }),
    Plot.ruleY([30], { stroke: "#ef4444", strokeDasharray: "4,4", strokeOpacity: 0.4 }),
    Plot.ruleY([60], { stroke: "#10b981", strokeDasharray: "4,4", strokeOpacity: 0.4 }),
  ]
})
```

<div class="metric-note">Size tiers: Small (&lt;100k₳), Medium (100k–5M₳), Large (5M–50M₳), Whale (&gt;50M₳). Dashed lines = red (30) and green (60) thresholds.</div>

## Where is the biggest rationale opportunity?

*High-voting-power DReps with rationale rate below 20% — outreach here has the most network impact.*

```js
const rationaleTargets = activeDreps
  .filter(d => (d.rationale_rate ?? 0) < 20)
  .sort((a, b) => (b.voting_power ?? 0) - (a.voting_power ?? 0))
  .slice(0, 20)
  .map(d => ({
    Name: d.name || d.drep_id.slice(0, 20) + "…",
    "Rationale Rate": Math.round(d.rationale_rate ?? 0),
    "Voting Power": d.voting_power ?? 0,
    Score: Math.round(d.score ?? 0),
    "Potential Lift": Math.round(35 * (1 - (d.rationale_rate ?? 0) / 100) * 0.5),
  }));
```

<div class="tip-box">
  <strong>Rationale = 35% of DRepScore.</strong> These DReps have significant voting power but almost never explain their votes. "Potential Lift" estimates the score improvement if they reach 50% rationale rate.
</div>

```js
rationaleTargets.length > 0
  ? Inputs.table(rationaleTargets, {
      sort: "Voting Power",
      reverse: true,
      format: {
        Score: d => html`<span class="score-pill ${scoreTier(d)}">${d}</span>`,
        "Rationale Rate": d => html`<span class="score-pill bad">${d}%</span>`,
        "Voting Power": d => formatAda(d),
        "Potential Lift": d => html`<span class="badge badge-green">+${d} pts</span>`,
      },
    })
  : html`<div class="empty-state">All DReps with significant voting power have rationale rates ≥ 20%.</div>`
```

## Who is at risk of declining?

*DReps whose score dropped more than 5 points between the two most recent snapshots.*

```js
const snapDates = [...new Set(history.map(d => d.snapshot_date))].sort();
const prevDate = snapDates.length >= 2 ? snapDates.at(-2) : null;
const lastDate = snapDates.at(-1);

const prevScores = prevDate
  ? new Map(history.filter(d => d.snapshot_date === prevDate).map(d => [d.drep_id, d]))
  : new Map();
const currScores = new Map(
  history.filter(d => d.snapshot_date === lastDate).map(d => [d.drep_id, d])
);
const drepsMap = new Map(dreps.map(d => [d.drep_id, d]));

const atRisk = Array.from(currScores, ([id, curr]) => {
  const prev = prevScores.get(id);
  if (!prev) return null;
  const delta = curr.score - prev.score;
  if (delta >= -5) return null;

  const pillarDeltas = [
    { name: "Participation", delta: (curr.effective_participation ?? 0) - (prev.effective_participation ?? 0) },
    { name: "Rationale", delta: (curr.rationale_rate ?? 0) - (prev.rationale_rate ?? 0) },
    { name: "Reliability", delta: (curr.reliability_score ?? 0) - (prev.reliability_score ?? 0) },
    { name: "Profile", delta: (curr.profile_completeness ?? 0) - (prev.profile_completeness ?? 0) },
  ];
  const biggest = pillarDeltas.sort((a, b) => a.delta - b.delta)[0];

  return {
    Name: drepsMap.get(id)?.name || id.slice(0, 20) + "…",
    Previous: Math.round(prev.score),
    Current: Math.round(curr.score),
    Delta: Math.round(delta),
    "Biggest Drop": `${biggest.name} ${biggest.delta >= 0 ? "+" : ""}${Math.round(biggest.delta)}`,
  };
}).filter(Boolean).sort((a, b) => a.Delta - b.Delta);
```

```js
atRisk.length > 0
  ? Inputs.table(atRisk, {
      format: {
        Delta: d => html`<span class="badge badge-red">${d}</span>`,
        Current: d => html`<span class="score-pill ${scoreTier(d)}">${d}</span>`,
      },
      sort: "Delta",
    })
  : html`<div class="empty-state">No DReps dropped more than 5 points since the last snapshot.</div>`
```
