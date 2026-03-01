# Voting Power & Centralization

```js
const snapshots = FileAttachment("data/power-snapshots.json").json();
const dreps = FileAttachment("data/dreps.json").json();
```

```js
function formatAda(v) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const epochs = [...new Set(snapshots.map(d => d.epoch_no))].sort((a, b) => a - b);
const latestEpoch = epochs.at(-1);
const prevEpoch = epochs.length >= 2 ? epochs.at(-2) : null;

const latestSnaps = snapshots.filter(d => d.epoch_no === latestEpoch);
const totalPowerLovelace = d3.sum(latestSnaps, d => Number(d.amount_lovelace));
const totalPowerAda = totalPowerLovelace / 1e6;
const uniqueDreps = new Set(latestSnaps.map(d => d.drep_id)).size;

const top10 = latestSnaps
  .sort((a, b) => Number(b.amount_lovelace) - Number(a.amount_lovelace))
  .slice(0, 10);
const top10Power = d3.sum(top10, d => Number(d.amount_lovelace));
const top10Pct = totalPowerLovelace > 0 ? (top10Power / totalPowerLovelace * 100) : 0;

const hhi = (() => {
  if (totalPowerLovelace === 0) return 0;
  return d3.sum(latestSnaps, d => {
    const share = Number(d.amount_lovelace) / totalPowerLovelace;
    return share * share;
  }) * 10000;
})();
```

<div class="kpi-row cols-4">
  <div class="kpi">
    <span class="kpi-label">Total Delegated</span>
    <span class="kpi-value">₳${formatAda(totalPowerAda)}</span>
    <span class="kpi-sub">across ${uniqueDreps} DReps · epoch ${latestEpoch}</span>
    <div class="kpi-bar" style="background: var(--accent-purple)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Top 10 Share</span>
    <span class="kpi-value" style="color:${top10Pct > 50 ? '#ef4444' : top10Pct > 30 ? '#f59e0b' : '#10b981'}">${top10Pct.toFixed(1)}%</span>
    <span class="kpi-sub">concentration among top 10 DReps</span>
    <div class="kpi-bar" style="background: ${top10Pct > 50 ? 'var(--accent-red)' : top10Pct > 30 ? 'var(--accent-amber)' : 'var(--accent-green)'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">HHI Index</span>
    <span class="kpi-value" style="color:${hhi > 2500 ? '#ef4444' : hhi > 1500 ? '#f59e0b' : '#10b981'}">${Math.round(hhi)}</span>
    <span class="kpi-sub">${hhi < 1500 ? "Competitive" : hhi < 2500 ? "Moderately concentrated" : "Highly concentrated"}</span>
    <div class="kpi-bar" style="background: ${hhi > 2500 ? 'var(--accent-red)' : hhi > 1500 ? 'var(--accent-amber)' : 'var(--accent-green)'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Epochs Tracked</span>
    <span class="kpi-value">${epochs.length}</span>
    <span class="kpi-sub">epoch ${epochs[0]} → ${latestEpoch}</span>
    <div class="kpi-bar" style="background: var(--accent)"></div>
  </div>
</div>

<div class="tip-box">
  <strong>Why centralization matters:</strong> A governance system where a few DReps control most voting power is fragile. HHI below 1,500 indicates healthy competition; above 2,500 signals high concentration.
</div>

## Total delegated ADA over time

```js
const epochTotals = d3.rollups(
  snapshots,
  v => d3.sum(v, d => Number(d.amount_lovelace)) / 1e6,
  d => d.epoch_no
).map(([epoch, ada]) => ({ epoch, ada })).sort((a, b) => a.epoch - b.epoch);

display(Plot.plot({
  height: 320,
  marginLeft: 70,
  style: { fontSize: "12px" },
  x: { label: "Epoch →", tickFormat: d => d.toString() },
  y: { label: "↑ Delegated ADA", grid: true, tickFormat: d => formatAda(d) },
  marks: [
    Plot.areaY(epochTotals, { x: "epoch", y: "ada", fill: "#a78bfa", fillOpacity: 0.2, curve: "catmull-rom" }),
    Plot.lineY(epochTotals, { x: "epoch", y: "ada", stroke: "#a78bfa", strokeWidth: 2, curve: "catmull-rom" }),
    Plot.dot(epochTotals, { x: "epoch", y: "ada", fill: "#a78bfa", r: 3, tip: true }),
    Plot.ruleY([0]),
  ]
}));
```

## Top 10 DReps by voting power

```js
const drepsMap = new Map(dreps.map(d => [d.drep_id, d]));

const top10Table = top10.map((s, i) => {
  const info = drepsMap.get(s.drep_id);
  const ada = Number(s.amount_lovelace) / 1e6;
  return {
    Rank: i + 1,
    Name: info?.name || s.drep_id.slice(0, 20) + "…",
    ID: s.drep_id,
    "Voting Power (ADA)": ada,
    "Share %": totalPowerLovelace > 0 ? (Number(s.amount_lovelace) / totalPowerLovelace * 100) : 0,
    Score: info?.score ?? "—",
    Tier: info?.size_tier ?? "—",
  };
});

display(Inputs.table(top10Table, {
  format: {
    "Voting Power (ADA)": d => `₳${formatAda(d)}`,
    "Share %": d => `${d.toFixed(1)}%`,
    Score: d => typeof d === "number" ? html`<span class="score-pill ${d >= 60 ? 'good' : d >= 30 ? 'warn' : 'bad'}">${Math.round(d)}</span>` : d,
    Tier: d => html`<span class="badge badge-purple">${d}</span>`,
    Name: (d, i) => html`<a href="https://drepscore.io/drep/${top10Table[i].ID}" target="_blank" style="color:var(--accent)">${d}</a>`,
  },
}));
```

## Power by size tier

```js
const tierPower = d3.rollups(
  latestSnaps,
  v => ({ ada: d3.sum(v, d => Number(d.amount_lovelace)) / 1e6, count: v.length }),
  d => {
    const info = drepsMap.get(d.drep_id);
    return info?.size_tier ?? "Unknown";
  }
).map(([tier, { ada, count }]) => ({ tier, ada, count }))
 .sort((a, b) => b.ada - a.ada);

display(Plot.plot({
  height: 280,
  marginLeft: 100,
  style: { fontSize: "12px" },
  x: { label: "ADA Delegated →", grid: true, tickFormat: d => formatAda(d) },
  y: { label: null, domain: tierPower.map(d => d.tier) },
  marks: [
    Plot.barX(tierPower, {
      x: "ada",
      y: "tier",
      fill: d => ({ Whale: "#ef4444", Large: "#f59e0b", Medium: "#10b981", Small: "#4f8cff" }[d.tier] ?? "#94a3b8"),
      fillOpacity: 0.75,
      tip: true,
      channels: { "DReps": "count" },
    }),
    Plot.text(tierPower, {
      x: "ada",
      y: "tier",
      text: d => `₳${formatAda(d.ada)} (${d.count})`,
      dx: 4,
      textAnchor: "start",
      fill: "var(--theme-foreground)",
      fontSize: 11,
    }),
    Plot.ruleX([0]),
  ]
}));
```

## Biggest power movers (epoch over epoch)

```js
if (prevEpoch != null) {
  const prevSnaps = new Map(
    snapshots.filter(d => d.epoch_no === prevEpoch).map(d => [d.drep_id, Number(d.amount_lovelace)])
  );

  const movers = latestSnaps.map(d => {
    const prev = prevSnaps.get(d.drep_id) ?? 0;
    const curr = Number(d.amount_lovelace);
    const info = drepsMap.get(d.drep_id);
    return {
      Name: info?.name || d.drep_id.slice(0, 20) + "…",
      ID: d.drep_id,
      Previous: prev / 1e6,
      Current: curr / 1e6,
      Change: (curr - prev) / 1e6,
    };
  }).filter(d => Math.abs(d.Change) > 1000)
    .sort((a, b) => b.Change - a.Change);

  const gainers = movers.filter(d => d.Change > 0).slice(0, 10);
  const losers = movers.filter(d => d.Change < 0).sort((a, b) => a.Change - b.Change).slice(0, 10);

  display(html`<div class="grid grid-cols-2">
    <div class="card">
      <h3 style="color: #10b981; margin-top: 0">▲ Biggest Gainers (Epoch ${prevEpoch} → ${latestEpoch})</h3>
      ${gainers.length > 0
        ? Inputs.table(gainers, {
            columns: ["Name", "Previous", "Current", "Change"],
            format: {
              Previous: d => `₳${formatAda(d)}`,
              Current: d => `₳${formatAda(d)}`,
              Change: d => html`<span class="badge badge-green">+₳${formatAda(Math.abs(d))}</span>`,
              Name: (d, i) => html`<a href="https://drepscore.io/drep/${gainers[i].ID}" target="_blank" style="color:var(--accent)">${d}</a>`,
            },
          })
        : html`<div class="empty-state">No significant gainers.</div>`}
    </div>
    <div class="card">
      <h3 style="color: #ef4444; margin-top: 0">▼ Biggest Losers (Epoch ${prevEpoch} → ${latestEpoch})</h3>
      ${losers.length > 0
        ? Inputs.table(losers, {
            columns: ["Name", "Previous", "Current", "Change"],
            format: {
              Previous: d => `₳${formatAda(d)}`,
              Current: d => `₳${formatAda(d)}`,
              Change: d => html`<span class="badge badge-red">-₳${formatAda(Math.abs(d))}</span>`,
              Name: (d, i) => html`<a href="https://drepscore.io/drep/${losers[i].ID}" target="_blank" style="color:var(--accent)">${d}</a>`,
            },
          })
        : html`<div class="empty-state">No significant losers.</div>`}
    </div>
  </div>`);
} else {
  display(html`<div class="empty-state">Need ≥ 2 epochs of data to show power migration.</div>`);
}
```
