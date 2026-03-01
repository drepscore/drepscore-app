# Rationale Quality

```js
const stats = FileAttachment("data/rationale-stats.json").json();
const dreps = FileAttachment("data/dreps.json").json();
const integrity = FileAttachment("data/integrity.json").json();
```

```js
const drepsMap = new Map(dreps.map(d => [d.drep_id, d]));
const totalRationales = d3.sum(stats, d => d.total_rationales);
const totalVerified = d3.sum(stats, d => d.hash_verified_count);
const totalFailed = d3.sum(stats, d => d.hash_failed_count);
const totalSummarized = d3.sum(stats, d => d.ai_summarized_count);
const avgLength = d3.mean(stats.filter(d => d.avg_rationale_length > 0), d => d.avg_rationale_length) ?? 0;
const verifyRate = totalRationales > 0 ? ((totalVerified / (totalVerified + totalFailed)) * 100) : 0;
const summaryRate = totalRationales > 0 ? ((totalSummarized / totalRationales) * 100) : 0;
const drepsWithRationales = stats.filter(d => d.total_rationales > 0).length;
const activeDreps = dreps.filter(d => d.is_active).length;
const coveragePct = activeDreps > 0 ? (drepsWithRationales / activeDreps * 100) : 0;
```

<div class="kpi-row cols-4">
  <div class="kpi">
    <span class="kpi-label">Total Rationales</span>
    <span class="kpi-value">${totalRationales.toLocaleString()}</span>
    <span class="kpi-sub">${drepsWithRationales} of ${activeDreps} DReps (${Math.round(coveragePct)}%)</span>
    <div class="kpi-bar" style="background: var(--accent)"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Hash Verification</span>
    <span class="kpi-value" style="color:${verifyRate >= 90 ? '#10b981' : verifyRate >= 70 ? '#f59e0b' : '#ef4444'}">${verifyRate.toFixed(1)}%</span>
    <span class="kpi-sub">${totalVerified} verified · ${totalFailed} mismatched</span>
    <div class="kpi-bar" style="background: ${verifyRate >= 90 ? 'var(--accent-green)' : 'var(--accent-amber)'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">AI Summarized</span>
    <span class="kpi-value" style="color:${summaryRate >= 80 ? '#10b981' : summaryRate >= 50 ? '#f59e0b' : '#ef4444'}">${summaryRate.toFixed(1)}%</span>
    <span class="kpi-sub">${totalSummarized.toLocaleString()} rationales with AI summary</span>
    <div class="kpi-bar" style="background: ${summaryRate >= 80 ? 'var(--accent-green)' : 'var(--accent-amber)'}"></div>
  </div>
  <div class="kpi">
    <span class="kpi-label">Avg Length</span>
    <span class="kpi-value">${Math.round(avgLength)}</span>
    <span class="kpi-sub">characters per rationale</span>
    <div class="kpi-bar" style="background: var(--accent-purple)"></div>
  </div>
</div>

## Rationale length distribution

*How long are DReps' rationales on average? Longer rationales generally indicate more thoughtful governance participation.*

```js
const lengthData = stats
  .filter(d => d.avg_rationale_length > 0)
  .map(d => ({ length: d.avg_rationale_length, drep_id: d.drep_id }));

if (lengthData.length > 0) {
  display(Plot.plot({
    height: 320,
    marginLeft: 50,
    style: { fontSize: "12px" },
    x: { label: "Avg Rationale Length (chars) →" },
    y: { label: "↑ DRep Count", grid: true },
    marks: [
      Plot.rectY(lengthData, Plot.binX({ y: "count" }, {
        x: "length",
        thresholds: 30,
        fill: d => d.length > 500 ? "#10b981" : d.length > 200 ? "#f59e0b" : "#ef4444",
        fillOpacity: 0.75,
        tip: true,
      })),
      Plot.ruleX([Math.round(avgLength)], { stroke: "#a78bfa", strokeDasharray: "4,4", strokeWidth: 2 }),
      Plot.text([{ x: Math.round(avgLength) }], {
        x: "x", text: d => `Avg ${d.x}`, dy: -10, fill: "#a78bfa", fontSize: 12, frameAnchor: "top"
      }),
      Plot.ruleY([0]),
    ]
  }));
} else {
  display(html`<div class="empty-state">No rationale length data available.</div>`);
}
```

<div class="threshold-legend">
  <span class="legend-red">Below 200 chars — Minimal</span>
  <span class="legend-yellow">200–500 chars — Adequate</span>
  <span class="legend-green">Above 500 chars — Thorough</span>
</div>

## Hash verification by DRep

*DReps with the highest and lowest hash verification success rates. Failed hashes indicate tampered or stale metadata.*

```js
const verifyData = stats
  .filter(d => d.hash_verified_count + d.hash_failed_count > 0)
  .map(d => {
    const total = d.hash_verified_count + d.hash_failed_count;
    const rate = (d.hash_verified_count / total) * 100;
    const info = drepsMap.get(d.drep_id);
    return {
      Name: info?.name || d.drep_id.slice(0, 20) + "…",
      ID: d.drep_id,
      "Verified": d.hash_verified_count,
      "Failed": d.hash_failed_count,
      "Rate %": rate,
      "Rationales": d.total_rationales,
    };
  })
  .sort((a, b) => a["Rate %"] - b["Rate %"]);

if (verifyData.length > 0) {
  display(Plot.plot({
    height: Math.max(300, Math.min(verifyData.length, 30) * 22),
    marginLeft: 160,
    style: { fontSize: "11px" },
    x: { label: "Verification Rate % →", domain: [0, 100] },
    y: { label: null, domain: verifyData.slice(0, 30).map(d => d.Name) },
    marks: [
      Plot.barX(verifyData.slice(0, 30), {
        x: "Rate %",
        y: "Name",
        fill: d => d["Rate %"] >= 90 ? "#10b981" : d["Rate %"] >= 70 ? "#f59e0b" : "#ef4444",
        fillOpacity: 0.75,
        tip: true,
        channels: { "Verified": "Verified", "Failed": "Failed" },
      }),
      Plot.ruleX([0]),
    ]
  }));
}
```

## Top DReps by rationale quality

*Ranked by a composite of length, hash verification, and AI summary coverage.*

```js
const qualityTable = stats
  .filter(d => d.total_rationales >= 3)
  .map(d => {
    const info = drepsMap.get(d.drep_id);
    const verifiedTotal = d.hash_verified_count + d.hash_failed_count;
    const verifyPct = verifiedTotal > 0 ? (d.hash_verified_count / verifiedTotal * 100) : 0;
    const summaryPct = d.total_rationales > 0 ? (d.ai_summarized_count / d.total_rationales * 100) : 0;
    const lengthScore = Math.min(100, (d.avg_rationale_length ?? 0) / 5);
    const quality = (verifyPct * 0.3) + (summaryPct * 0.3) + (lengthScore * 0.4);
    return {
      Name: info?.name || d.drep_id.slice(0, 20) + "…",
      ID: d.drep_id,
      Score: info?.score != null ? Math.round(info.score) : "—",
      Rationales: d.total_rationales,
      "Avg Length": d.avg_rationale_length ?? 0,
      "Verify %": Math.round(verifyPct),
      "AI Summary %": Math.round(summaryPct),
      Quality: Math.round(quality),
    };
  })
  .sort((a, b) => b.Quality - a.Quality)
  .slice(0, 30);

display(Inputs.table(qualityTable, {
  columns: ["Name", "Score", "Rationales", "Avg Length", "Verify %", "AI Summary %", "Quality"],
  format: {
    Score: d => typeof d === "number" ? html`<span class="score-pill ${d >= 60 ? 'good' : d >= 30 ? 'warn' : 'bad'}">${d}</span>` : d,
    Quality: d => html`<span class="score-pill ${d >= 60 ? 'good' : d >= 30 ? 'warn' : 'bad'}">${d}</span>`,
    Name: (d, i) => html`<a href="https://drepscore.io/drep/${qualityTable[i].ID}" target="_blank" style="color:var(--accent)">${d}</a>`,
  },
  sort: "Quality",
  reverse: true,
  rows: 30,
}));
```

## AI Summary Coverage Trend

```js
const integrityData = integrity.map(d => ({
  date: new Date(d.snapshot_date),
  "AI Rationale %": Number(d.ai_rationale_pct ?? 0),
  "AI Proposal %": Number(d.ai_proposal_pct ?? 0),
  "Hash Mismatch %": Number(d.hash_mismatch_rate_pct ?? 0),
}));

if (integrityData.length > 1) {
  display(Plot.plot({
    height: 300,
    marginLeft: 50,
    style: { fontSize: "12px" },
    x: { label: null, type: "utc" },
    y: { label: "↑ Percentage", domain: [0, 100], grid: true },
    color: {
      domain: ["AI Rationale %", "AI Proposal %", "Hash Mismatch %"],
      range: ["#4f8cff", "#a78bfa", "#ef4444"],
      legend: true,
    },
    marks: [
      Plot.lineY(integrityData, { x: "date", y: "AI Rationale %", stroke: "#4f8cff", strokeWidth: 2 }),
      Plot.lineY(integrityData, { x: "date", y: "AI Proposal %", stroke: "#a78bfa", strokeWidth: 2 }),
      Plot.lineY(integrityData, { x: "date", y: "Hash Mismatch %", stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "4,4" }),
      Plot.ruleY([0]),
    ]
  }));
} else {
  display(html`<div class="empty-state">Need ≥ 2 integrity snapshots to show trends.</div>`);
}
```
