# Score Trends

```js
const history = FileAttachment("data/score-history.json").json();
const dreps = FileAttachment("data/dreps.json").json();
```

```js
const dates = [...new Set(history.map(d => d.snapshot_date))].sort();
const dailyAvg = dates.map(date => {
  const rows = history.filter(d => d.snapshot_date === date);
  return {
    date: new Date(date),
    dateLabel: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    score: d3.mean(rows, d => d.score) ?? 0,
    participation: d3.mean(rows, d => d.effective_participation) ?? 0,
    rationale: d3.mean(rows, d => d.rationale_rate) ?? 0,
    reliability: d3.mean(rows, d => d.reliability_score) ?? 0,
    profile: d3.mean(rows, d => d.profile_completeness) ?? 0,
    count: rows.length,
  };
});
const latestDate = dates.at(-1);
const earliestDate = dates[0];
const latestAvg = dailyAvg.at(-1)?.score ?? 0;
const earliestAvg = dailyAvg[0]?.score ?? 0;
const scoreChange = latestAvg - earliestAvg;
const trackedDreps = new Set(history.map(d => d.drep_id)).size;

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function scoreColor(v) { return v >= 60 ? "#10b981" : v >= 30 ? "#f59e0b" : "#ef4444"; }
function scoreTier(v) { return v >= 60 ? "good" : v >= 30 ? "warn" : "bad"; }
function formatAda(v) {
  if (v >= 1e9) return `₳${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `₳${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `₳${(v / 1e3).toFixed(0)}K`;
  return `₳${Math.round(v)}`;
}
```

<div class="kpi-row cols-4">
  <div class="kpi">
    <span class="kpi-label">Current Network Avg</span>
    <span class="kpi-value" style="color:${scoreColor(latestAvg)}">${latestAvg.toFixed(1)}</span>
    <span class="kpi-sub">as of ${fmtDate(latestDate)}</span>
    <div class="kpi-bar" style="background:${scoreColor(latestAvg)}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Score Change</span>
    <span class="kpi-value" style="color:${scoreChange >= 0 ? '#10b981' : '#ef4444'}">${scoreChange >= 0 ? '+' : ''}${scoreChange.toFixed(1)}</span>
    <span class="kpi-sub">${fmtDate(earliestDate)} → ${fmtDate(latestDate)}</span>
    <span class="kpi-delta ${scoreChange >= 0 ? 'up' : 'down'}">${scoreChange >= 0 ? '▲' : '▼'} ${Math.abs(scoreChange).toFixed(1)} pts over ${dates.length} snapshots</span>
    <div class="kpi-bar" style="background:${scoreChange >= 0 ? '#10b981' : '#ef4444'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">DReps Tracked</span>
    <span class="kpi-value">${trackedDreps.toLocaleString()}</span>
    <span class="kpi-sub">unique DReps with score history</span>
    <div class="kpi-bar" style="background:var(--accent)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Snapshots</span>
    <span class="kpi-value">${dates.length}</span>
    <span class="kpi-sub">${dates.length >= 2 ? `${dailyAvg[0]?.count} → ${dailyAvg.at(-1)?.count} DReps per snapshot` : "more data needed"}</span>
    <div class="kpi-bar" style="background:var(--accent-purple)"></div>
  </div>
</div>

## How is the network score trending?

*The overall trajectory of DRepScore across all active DReps. Hover points for exact values.*

```js
const pillarFocus = view(Inputs.select(
  ["Overall Score", "Participation (30%)", "Rationale (35%)", "Reliability (20%)", "Profile (15%)"],
  { label: "Metric", value: "Overall Score" }
));
```

```js
const pillarKeyMap = {
  "Overall Score": "score",
  "Participation (30%)": "participation",
  "Rationale (35%)": "rationale",
  "Reliability (20%)": "reliability",
  "Profile (15%)": "profile",
};
const focusKey = pillarKeyMap[pillarFocus];
const focusColor = focusKey === "score" ? "#4f8cff"
  : focusKey === "participation" ? "#4f8cff"
  : focusKey === "rationale" ? "#10b981"
  : focusKey === "reliability" ? "#f59e0b"
  : "#a78bfa";
```

```js
Plot.plot({
  height: 360,
  marginLeft: 50,
  style: { fontSize: "12px" },
  x: { label: null, type: "utc" },
  y: { label: `↑ ${pillarFocus}`, domain: [0, 100], grid: true },
  marks: [
    Plot.areaY(dailyAvg, { x: "date", y: focusKey, fill: focusColor, fillOpacity: 0.1, curve: "catmull-rom" }),
    Plot.lineY(dailyAvg, { x: "date", y: focusKey, stroke: focusColor, strokeWidth: 2.5, curve: "catmull-rom" }),
    Plot.dot(dailyAvg, {
      x: "date", y: focusKey, fill: focusColor, r: 5,
      tip: true,
      channels: {
        Date: "dateLabel",
        Value: d => d[focusKey].toFixed(1),
        DReps: "count",
      },
    }),
    Plot.ruleY([50], { stroke: "#f59e0b", strokeDasharray: "6,4", strokeWidth: 1.5 }),
    Plot.text([{ y: 50 }], { y: "y", text: () => "Target baseline", dx: 50, fill: "#f59e0b", fontSize: 11 }),
  ]
})
```

<div class="tip-box">
  <strong>Insight:</strong> A rising average reflects improving governance standards across the network. The baseline target of 50 indicates a minimally healthy governance threshold. Use the metric selector above to drill into individual pillars.
</div>

## Which pillars are improving?

*Track each scoring pillar independently to see what's driving overall trends.*

```js
const pillarData = dailyAvg.flatMap(d => [
  { date: d.date, dateLabel: d.dateLabel, pillar: "Participation (30%)", value: d.participation },
  { date: d.date, dateLabel: d.dateLabel, pillar: "Rationale (35%)", value: d.rationale },
  { date: d.date, dateLabel: d.dateLabel, pillar: "Reliability (20%)", value: d.reliability },
  { date: d.date, dateLabel: d.dateLabel, pillar: "Profile (15%)", value: d.profile },
]);
```

```js
Plot.plot({
  height: 360,
  marginLeft: 50,
  style: { fontSize: "12px" },
  x: { label: null, type: "utc" },
  y: { label: "↑ Average Value", domain: [0, 100], grid: true },
  color: {
    domain: ["Participation (30%)", "Rationale (35%)", "Reliability (20%)", "Profile (15%)"],
    range: ["#4f8cff", "#10b981", "#f59e0b", "#a78bfa"],
    legend: true,
  },
  marks: [
    Plot.lineY(pillarData, { x: "date", y: "value", stroke: "pillar", strokeWidth: 2, curve: "catmull-rom" }),
    Plot.dot(pillarData, {
      x: "date", y: "value", fill: "pillar", r: 3,
      tip: true,
      channels: { Date: "dateLabel", Value: d => d.value?.toFixed(1) },
    }),
  ]
})
```

## How do size tiers compare?

*Are larger DReps outperforming smaller ones — or vice versa?*

```js
const tierFocus = view(Inputs.select(
  ["All Tiers", "Small", "Medium", "Large", "Whale"],
  { label: "Filter tier", value: "All Tiers" }
));
```

```js
const drepTierMap = new Map(dreps.map(d => [d.drep_id, d.size_tier]));
const tierHistory = history
  .filter(d => drepTierMap.has(d.drep_id) && drepTierMap.get(d.drep_id))
  .map(d => ({ ...d, tier: drepTierMap.get(d.drep_id) }));

const tierDates = d3.flatRollup(
  tierHistory,
  v => d3.mean(v, d => d.score),
  d => d.snapshot_date,
  d => d.tier
).map(([date, tier, score]) => ({
  date: new Date(date),
  dateLabel: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  tier,
  score,
}));

const filteredTierDates = tierFocus === "All Tiers"
  ? tierDates
  : tierDates.filter(d => d.tier === tierFocus);
```

```js
Plot.plot({
  height: 360,
  marginLeft: 50,
  style: { fontSize: "12px" },
  x: { label: null, type: "utc" },
  y: { label: "↑ Average Score", domain: [0, 100], grid: true },
  color: {
    domain: ["Small", "Medium", "Large", "Whale"],
    range: ["#a78bfa", "#4f8cff", "#10b981", "#f59e0b"],
    legend: true,
  },
  marks: [
    Plot.lineY(filteredTierDates, {
      x: "date", y: "score", stroke: "tier", strokeWidth: 2, curve: "catmull-rom",
    }),
    Plot.dot(filteredTierDates, {
      x: "date", y: "score", fill: "tier", r: 3,
      tip: true,
      channels: { Date: "dateLabel", Score: d => d.score?.toFixed(1) },
    }),
  ]
})
```

<div class="tip-box">
  <strong>Insight:</strong> If smaller DReps consistently lag, it may signal resource or awareness gaps addressable through targeted outreach. If whales lag, it may indicate complacency.
</div>

## Who improved the most?

*Diverging bar chart — biggest improvers on the right, biggest decliners on the left. Hover to see which pillar drove the change.*

```js
const drepScoreChange = d3.rollups(
  history,
  v => {
    const sorted = v.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const first = sorted[0];
    const latest = sorted.at(-1);
    return {
      first: first.score, latest: latest.score,
      partDelta: (latest.effective_participation ?? 0) - (first.effective_participation ?? 0),
      ratDelta: (latest.rationale_rate ?? 0) - (first.rationale_rate ?? 0),
      relDelta: (latest.reliability_score ?? 0) - (first.reliability_score ?? 0),
      profDelta: (latest.profile_completeness ?? 0) - (first.profile_completeness ?? 0),
    };
  },
  d => d.drep_id
).map(([id, d]) => {
  const drep = dreps.find(dd => dd.drep_id === id);
  const deltas = [
    { name: "Participation", val: d.partDelta },
    { name: "Rationale", val: d.ratDelta },
    { name: "Reliability", val: d.relDelta },
    { name: "Profile", val: d.profDelta },
  ];
  const biggest = deltas.sort((a, b) => Math.abs(b.val) - Math.abs(a.val))[0];
  return {
    id, name: drep?.name || id.slice(0, 16) + "…",
    change: d.latest - d.first, first: d.first, latest: d.latest,
    vp: drep?.voting_power ?? 0,
    mainDriver: biggest.name,
    mainDelta: biggest.val,
    partDelta: d.partDelta, ratDelta: d.ratDelta,
    relDelta: d.relDelta, profDelta: d.profDelta,
  };
});

const topImprovers = drepScoreChange.filter(d => d.change > 0).sort((a, b) => b.change - a.change).slice(0, 12);
const topDecliners = drepScoreChange.filter(d => d.change < 0).sort((a, b) => a.change - b.change).slice(0, 12);
const diverging = [...topImprovers, ...topDecliners].sort((a, b) => b.change - a.change);
```

```js
diverging.length > 0
  ? Plot.plot({
      height: Math.max(400, diverging.length * 26),
      marginLeft: 170,
      marginRight: 60,
      style: { fontSize: "11px" },
      x: { label: "← Declined · Improved →", grid: true },
      y: { label: null },
      marks: [
        Plot.barX(diverging, {
          x: "change", y: "name",
          fill: d => d.change >= 0 ? "#10b981" : "#ef4444",
          fillOpacity: 0.8,
          sort: { y: "-x" },
          tip: true,
          channels: {
            "Score": d => `${d.first.toFixed(0)} → ${d.latest.toFixed(0)}`,
            "Main Driver": d => `${d.mainDriver} ${d.mainDelta >= 0 ? "+" : ""}${d.mainDelta.toFixed(0)}`,
            "Participation Δ": d => `${d.partDelta >= 0 ? "+" : ""}${d.partDelta.toFixed(0)}`,
            "Rationale Δ": d => `${d.ratDelta >= 0 ? "+" : ""}${d.ratDelta.toFixed(0)}`,
            "Reliability Δ": d => `${d.relDelta >= 0 ? "+" : ""}${d.relDelta.toFixed(0)}`,
            "Profile Δ": d => `${d.profDelta >= 0 ? "+" : ""}${d.profDelta.toFixed(0)}`,
            "Voting Power": d => formatAda(d.vp),
          },
        }),
        Plot.text(diverging, {
          x: "change", y: "name",
          text: d => `${d.change >= 0 ? '+' : ''}${d.change.toFixed(0)}`,
          dx: d => d.change >= 0 ? 6 : -6,
          textAnchor: d => d.change >= 0 ? "start" : "end",
          fontSize: 10, fill: "currentColor",
        }),
        Plot.ruleX([0], { stroke: "var(--theme-foreground-muted)" }),
      ]
    })
  : html`<div class="empty-state">Need ≥ 2 snapshots to show score changes.</div>`
```

## Score distribution over time

*How the bell curve is shifting across snapshots. Each panel is one snapshot date.*

```js
const sampleDates = dates.length <= 6 ? dates : dates.filter((_, i) => i % Math.ceil(dates.length / 6) === 0 || i === dates.length - 1);
const distData = history
  .filter(d => sampleDates.includes(d.snapshot_date))
  .map(d => ({
    ...d,
    dateLabel: new Date(d.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }),
  }));
```

```js
if (distData.length > 0) {
  display(Plot.plot({
    height: 300,
    marginLeft: 45,
    marginBottom: 35,
    style: { fontSize: "12px" },
    x: { label: "Score →", domain: [0, 100] },
    y: { label: "↑ Count", grid: true },
    fx: { label: null, padding: 0.12 },
    marks: [
      Plot.rectY(distData, Plot.binX({ y: "count" }, {
        x: "score", fx: "dateLabel",
        thresholds: 12, fill: "#4f8cff", fillOpacity: 0.7,
        tip: true,
      })),
      Plot.ruleY([0]),
    ]
  }));
} else {
  display(html`<div class="empty-state">Need score history data to show distributions.</div>`);
}
```

<div class="metric-note">Each facet shows the score distribution at a snapshot date. A tightening distribution means DReps are converging; a widening one means growing disparity.</div>

## Pillar correlations

*Do pillars move together or independently? Select a pair to explore.*

```js
const activeDreps = dreps.filter(d => d.is_active);
```

```js
const corrPairOptions = [
  "Participation vs Rationale",
  "Reliability vs Profile",
  "Participation vs Reliability",
  "Rationale vs Reliability",
  "Rationale vs Profile",
  "Participation vs Profile",
];
const selectedCorr = view(Inputs.select(corrPairOptions, { label: "Compare pillars", value: corrPairOptions[0] }));
```

```js
const corrMap = {
  "Participation vs Rationale": ["effective_participation", "rationale_rate", "Participation", "Rationale Rate"],
  "Reliability vs Profile": ["reliability_score", "profile_completeness", "Reliability", "Profile Completeness"],
  "Participation vs Reliability": ["effective_participation", "reliability_score", "Participation", "Reliability"],
  "Rationale vs Reliability": ["rationale_rate", "reliability_score", "Rationale Rate", "Reliability"],
  "Rationale vs Profile": ["rationale_rate", "profile_completeness", "Rationale Rate", "Profile Completeness"],
  "Participation vs Profile": ["effective_participation", "profile_completeness", "Participation", "Profile Completeness"],
};
const [corrXk, corrYk, corrXl, corrYl] = corrMap[selectedCorr];
const corrData = activeDreps.filter(d => d[corrXk] != null && d[corrYk] != null);

const corrR = (() => {
  const n = corrData.length;
  if (n < 3) return null;
  const xm = d3.mean(corrData, d => d[corrXk]);
  const ym = d3.mean(corrData, d => d[corrYk]);
  const num = d3.sum(corrData, d => (d[corrXk] - xm) * (d[corrYk] - ym));
  const denX = Math.sqrt(d3.sum(corrData, d => (d[corrXk] - xm) ** 2));
  const denY = Math.sqrt(d3.sum(corrData, d => (d[corrYk] - ym) ** 2));
  return denX && denY ? num / (denX * denY) : null;
})();
```

```js
Plot.plot({
  height: 450,
  marginLeft: 55,
  marginBottom: 45,
  style: { fontSize: "12px" },
  x: { label: `${corrXl} →`, domain: [0, 100] },
  y: { label: `↑ ${corrYl}`, domain: [0, 100], grid: true },
  marks: [
    Plot.dot(corrData, {
      x: corrXk, y: corrYk,
      fill: "#4f8cff", fillOpacity: 0.35, r: 4,
      tip: true,
      channels: {
        Name: d => d.name || d.drep_id.slice(0, 16),
        Score: d => Math.round(d.score ?? 0),
        "Voting Power": d => formatAda(d.voting_power ?? 0),
        [corrXl]: d => d[corrXk]?.toFixed(0),
        [corrYl]: d => d[corrYk]?.toFixed(0),
      },
    }),
    Plot.linearRegressionY(corrData, { x: corrXk, y: corrYk, stroke: "#f59e0b", strokeDasharray: "4,4", strokeWidth: 2 }),
  ]
})
```

```js
if (corrR != null) {
  const strength = Math.abs(corrR) >= 0.7 ? "strong" : Math.abs(corrR) >= 0.4 ? "moderate" : "weak";
  const direction = corrR >= 0 ? "positive" : "negative";
  display(html`<div class="tip-box">
    <strong>Correlation: r = ${corrR.toFixed(2)}</strong> — ${strength} ${direction} relationship between ${corrXl} and ${corrYl}. ${
      strength === "weak"
        ? "These pillars capture genuinely independent behavior — good design."
        : strength === "strong"
        ? "These pillars move together — improvements in one likely drive the other."
        : "Some relationship exists, but the pillars still capture partly independent behavior."
    }
  </div>`);
}
```
