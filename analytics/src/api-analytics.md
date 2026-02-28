# API Analytics

```js
const raw = FileAttachment("data/api-usage.json").json();
```

```js
const { hourly, daily, keys, recent_errors, endpoint_stats, summary } = raw;
const hasData = summary.total_requests_24h > 0 || keys.length > 0;

function healthColor(value, thresholds, invert = false) {
  if (value == null) return "var(--theme-foreground-muted)";
  if (invert) return value < thresholds[0] ? "#10b981" : value < thresholds[1] ? "#f59e0b" : "#ef4444";
  return value >= thresholds[1] ? "#10b981" : value >= thresholds[0] ? "#f59e0b" : "#ef4444";
}
```

<div class="kpi-row cols-5">
  <div class="kpi">
    <span class="kpi-label">Total API Keys</span>
    <span class="kpi-value">${summary.total_keys}</span>
    <span class="kpi-sub">registered</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Active Keys (24h)</span>
    <span class="kpi-value" style="color:${healthColor(summary.active_keys_24h, [1, 5])}">${summary.active_keys_24h}</span>
    <span class="kpi-sub">unique keys with requests</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Requests (24h)</span>
    <span class="kpi-value">${summary.total_requests_24h.toLocaleString()}</span>
    <span class="kpi-sub">API calls served</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Error Rate (24h)</span>
    <span class="kpi-value" style="color:${healthColor(summary.error_rate_24h, [5, 1], true)}">${summary.error_rate_24h.toFixed(2)}%</span>
    <span class="kpi-sub">5xx responses</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">p95 Latency (24h)</span>
    <span class="kpi-value" style="color:${healthColor(summary.p95_ms_24h, [2000, 500], true)}">${summary.p95_ms_24h || "—"}ms</span>
    <span class="kpi-sub">server-side response time</span>
  </div>
</div>

```js
if (summary.rate_limit_hits_24h > 0) {
  display(html`<div class="tip-box" style="border-left-color:#f59e0b">
    <strong>Upsell Signal:</strong> ${summary.rate_limit_hits_24h} rate limit hits in the last 24 hours. Some consumers may be ready for a higher tier.
  </div>`);
}
```

## Request volume over time

```js
const viewMode = view(Inputs.select(["Daily (90d)", "Hourly (7d)"], { label: "View", value: "Daily (90d)" }));
```

```js
if (viewMode === "Daily (90d)" && daily.length > 0) {
  const chartData = daily.map(d => ({
    date: new Date(d.day),
    requests: d.total_requests,
    tier: d.tier,
  }));

  display(Plot.plot({
    height: 320,
    marginLeft: 50,
    style: { fontSize: "12px" },
    x: { label: null, type: "utc" },
    y: { label: "↑ Requests", grid: true },
    color: {
      domain: ["anonymous", "public", "pro", "business", "enterprise"],
      range: ["#94a3b8", "#4f8cff", "#10b981", "#a78bfa", "#f59e0b"],
      legend: true,
    },
    marks: [
      Plot.areaY(chartData, Plot.stackY({ x: "date", y: "requests", fill: "tier", curve: "step", fillOpacity: 0.6 })),
      Plot.ruleY([0]),
    ]
  }));
} else if (viewMode === "Hourly (7d)" && hourly.length > 0) {
  const hourlyAgg = d3.rollups(
    hourly,
    v => d3.sum(v, d => d.requests),
    d => d.hour
  ).map(([hour, requests]) => ({ date: new Date(hour), requests }));

  display(Plot.plot({
    height: 320,
    marginLeft: 50,
    style: { fontSize: "12px" },
    x: { label: null, type: "utc" },
    y: { label: "↑ Requests", grid: true },
    marks: [
      Plot.areaY(hourlyAgg, { x: "date", y: "requests", fill: "#4f8cff", fillOpacity: 0.3, curve: "step" }),
      Plot.lineY(hourlyAgg, { x: "date", y: "requests", stroke: "#4f8cff", strokeWidth: 1.5, curve: "step" }),
      Plot.ruleY([0]),
    ]
  }));
} else {
  display(html`<div class="empty-state"><strong>No request data yet.</strong> API usage will appear here once requests are made.</div>`);
}
```

## Endpoint popularity

*Requests per endpoint in the last 7 days. Color indicates p95 latency.*

```js
if (endpoint_stats.length > 0) {
  display(Plot.plot({
    height: Math.max(200, endpoint_stats.length * 36),
    marginLeft: 180,
    marginRight: 60,
    style: { fontSize: "12px" },
    x: { label: "Requests →", grid: true },
    y: { label: null, domain: endpoint_stats.map(d => d.endpoint) },
    marks: [
      Plot.barX(endpoint_stats, {
        x: "requests",
        y: "endpoint",
        fill: d => d.p95_ms < 500 ? "#10b981" : d.p95_ms < 2000 ? "#f59e0b" : "#ef4444",
        fillOpacity: 0.75,
        tip: true,
        channels: {
          "Error Rate": d => `${d.error_rate_pct}%`,
          "p95 Latency": d => `${d.p95_ms}ms`,
        },
      }),
      Plot.text(endpoint_stats, {
        x: "requests",
        y: "endpoint",
        text: d => d.requests.toLocaleString(),
        dx: 4,
        textAnchor: "start",
        fill: "var(--theme-foreground)",
        fontSize: 11,
      }),
      Plot.ruleX([0]),
    ]
  }));
} else {
  display(html`<div class="empty-state">No endpoint data yet.</div>`);
}
```

## Latency distribution

```js
if (hourly.length > 0) {
  const latencyData = hourly
    .filter(d => d.p50_ms != null)
    .flatMap(d => [
      { date: new Date(d.hour), percentile: "p50", ms: d.p50_ms },
      { date: new Date(d.hour), percentile: "p95", ms: d.p95_ms },
      { date: new Date(d.hour), percentile: "p99", ms: d.p99_ms },
    ]);

  if (latencyData.length > 0) {
    display(Plot.plot({
      height: 300,
      marginLeft: 50,
      style: { fontSize: "12px" },
      x: { label: null, type: "utc" },
      y: { label: "↑ Response time (ms)", grid: true },
      color: {
        domain: ["p50", "p95", "p99"],
        range: ["#4f8cff", "#f59e0b", "#ef4444"],
        legend: true,
      },
      marks: [
        Plot.lineY(latencyData, { x: "date", y: "ms", stroke: "percentile", strokeWidth: 1.5, curve: "catmull-rom" }),
        Plot.ruleY([3000], { stroke: "#ef4444", strokeDasharray: "6,4", strokeWidth: 1 }),
        Plot.text([{ y: 3000 }], { y: "y", text: () => "SLA boundary (3s)", dx: 60, fill: "#ef4444", fontSize: 10 }),
        Plot.ruleY([0]),
      ]
    }));
  } else {
    display(html`<div class="empty-state">No latency data yet.</div>`);
  }
} else {
  display(html`<div class="empty-state">No hourly data yet.</div>`);
}
```

## Error breakdown

```js
if (recent_errors.length > 0) {
  const errorCounts = d3.rollups(recent_errors, v => v.length, d => d.error_code || "unknown")
    .map(([code, count]) => {
      const sample = recent_errors.find(e => (e.error_code || "unknown") === code);
      return {
        "Error Code": code,
        Count: count,
        "% of Errors": `${(count / recent_errors.length * 100).toFixed(1)}%`,
        Endpoint: sample?.endpoint || "—",
        "Last Seen": new Date(sample?.created_at).toLocaleString(),
      };
    })
    .sort((a, b) => b.Count - a.Count);

  display(Inputs.table(errorCounts, {
    columns: ["Error Code", "Count", "% of Errors", "Endpoint", "Last Seen"],
    format: {
      "Error Code": d => d === "unknown"
        ? html`<span class="badge badge-red">unknown</span>`
        : html`<span class="badge badge-red">${d}</span>`,
    },
    rows: 20,
  }));
} else {
  display(html`<div class="empty-state" style="color:#10b981"><strong>No errors in the last 7 days.</strong></div>`);
}
```

## API key directory

```js
const tierFilter = view(Inputs.select(
  ["All", ...new Set(keys.map(d => d.tier))],
  { label: "Tier", value: "All" }
));
```

```js
if (keys.length > 0) {
  const filteredKeys = (tierFilter === "All" ? keys : keys.filter(d => d.tier === tierFilter))
    .map(d => ({
      Prefix: d.key_prefix,
      Name: d.name,
      Tier: d.tier,
      "Req (24h)": d.requests_last_day,
      "Req (7d)": d.requests_last_7d,
      "Errors (24h)": d.errors_last_day,
      "Rate Limits (24h)": d.rate_limits_last_day,
      "Rate Limit": d.rate_limit,
      "Usage %": d.rate_window === "hour"
        ? `${Math.min(100, Math.round(d.requests_last_hour / d.rate_limit * 100))}%`
        : `${Math.min(100, Math.round(d.requests_last_day / d.rate_limit * 100))}%`,
      "Last Used": d.last_used_at ? new Date(d.last_used_at).toLocaleString() : "Never",
    }));

  display(Inputs.table(filteredKeys, {
    columns: ["Prefix", "Name", "Tier", "Req (24h)", "Req (7d)", "Errors (24h)", "Rate Limits (24h)", "Usage %", "Last Used"],
    format: {
      Tier: d => html`<span class="badge badge-blue">${d}</span>`,
      "Errors (24h)": d => d > 0 ? html`<span style="color:#ef4444;font-weight:600">${d}</span>` : d,
      "Rate Limits (24h)": d => d > 0 ? html`<span style="color:#f59e0b;font-weight:600">${d}</span>` : d,
    },
    rows: 20,
  }));
} else {
  display(html`<div class="empty-state"><strong>No API keys registered yet.</strong></div>`);
}
```

<div class="tip-box">
  <strong>Note:</strong> This dashboard shows requests that hit the serverless function. Requests served from Vercel's Edge CDN cache (via <code>s-maxage</code> headers) are not counted here — check Vercel Analytics for total request volume including CDN hits.
</div>
