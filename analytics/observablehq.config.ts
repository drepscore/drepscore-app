export default {
  title: "DRepScore Analytics",
  root: "src",
  theme: ["dashboard", "near-midnight"],
  head: `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<style>
@font-face {
  font-family: 'Geist Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url(https://cdn.jsdelivr.net/fontsource/fonts/geist:vf@latest/latin-wght-normal.woff2) format('woff2-variations');
}
@font-face {
  font-family: 'Geist Mono Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url(https://cdn.jsdelivr.net/fontsource/fonts/geist-mono:vf@latest/latin-wght-normal.woff2) format('woff2-variations');
}

:root {
  --theme-foreground-focus: #4f8cff;
  --accent: #4f8cff;
  --accent-green: #10b981;
  --accent-red: #ef4444;
  --accent-amber: #f59e0b;
  --accent-purple: #a78bfa;
  --surface-1: color-mix(in srgb, var(--theme-background) 94%, var(--theme-foreground) 6%);
  --surface-2: color-mix(in srgb, var(--theme-background) 88%, var(--theme-foreground) 12%);
  --radius: 12px;
  --glow-blue: rgba(79, 140, 255, 0.12);
  --glow-green: rgba(16, 185, 129, 0.12);
  --glow-red: rgba(239, 68, 68, 0.10);
  --glow-purple: rgba(167, 139, 250, 0.10);
}

body, input, select, button, table {
  font-family: 'Geist Variable', system-ui, -apple-system, sans-serif;
}
code, pre, .monospace, [style*="monospace"] {
  font-family: 'Geist Mono Variable', ui-monospace, monospace;
}

/* Sidebar polish */
#observablehq-sidebar { font-family: 'Geist Variable', system-ui, sans-serif; }
#observablehq-sidebar a { border-radius: 6px; }

/* Observable Framework manages sidebar toggle/backdrop positioning internally.
   Do not override #observablehq-sidebar-toggle or its adjacent label
   (#observablehq-sidebar-backdrop) — they control the sidebar open/close
   click target and must remain invisible. */

/* ─── KPI Cards ─── */
.kpi-row { display: grid; gap: 1rem; margin: 1.5rem 0; }
.kpi-row.cols-3 { grid-template-columns: repeat(3, 1fr); }
.kpi-row.cols-4 { grid-template-columns: repeat(4, 1fr); }
.kpi-row.cols-5 { grid-template-columns: repeat(5, 1fr); }
@media (max-width: 768px) { .kpi-row { grid-template-columns: 1fr 1fr !important; } }

.kpi {
  background: var(--surface-1);
  border: 1px solid color-mix(in srgb, var(--theme-foreground) 8%, transparent);
  border-radius: var(--radius);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s cubic-bezier(0.22,1,0.36,1),
              box-shadow 0.25s cubic-bezier(0.22,1,0.36,1),
              border-color 0.2s;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px var(--glow-blue), 0 2px 8px rgba(0,0,0,0.08);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
.kpi-label {
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--theme-foreground-muted);
}
.kpi-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.kpi-sub {
  font-size: 0.78rem;
  color: var(--theme-foreground-muted);
  margin-top: 0.125rem;
  line-height: 1.4;
}
.kpi-delta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.55rem;
  border-radius: 6px;
  width: fit-content;
  margin-top: 0.35rem;
}
.kpi-delta.up { color: #10b981; background: rgba(16,185,129,0.1); }
.kpi-delta.down { color: #ef4444; background: rgba(239,68,68,0.1); }
.kpi-delta.neutral { color: var(--theme-foreground-muted); background: var(--surface-2); }
.kpi-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 0 0 var(--radius) var(--radius);
  opacity: 0.8;
}

/* ─── Status colors ─── */
.good { color: #10b981; }
.warn { color: #f59e0b; }
.bad { color: #ef4444; }
.muted { color: var(--theme-foreground-muted); }

/* ─── Informational boxes ─── */
.tip-box {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border-left: 3px solid var(--accent);
  padding: 0.85rem 1.15rem;
  border-radius: 0 var(--radius) var(--radius) 0;
  margin: 1rem 0;
  font-size: 0.84rem;
  line-height: 1.6;
}
.tip-box strong { color: var(--accent); }

.alert-box {
  background: color-mix(in srgb, var(--accent-amber) 6%, transparent);
  border-left: 3px solid var(--accent-amber);
  padding: 0.85rem 1.15rem;
  border-radius: 0 var(--radius) var(--radius) 0;
  margin: 1rem 0;
  font-size: 0.84rem;
  line-height: 1.6;
}
.alert-box strong { color: var(--accent-amber); }

.metric-note {
  font-size: 0.72rem;
  color: var(--theme-foreground-muted);
  font-style: italic;
  margin-top: 0.25rem;
}

/* ─── Section headers ─── */
h2 {
  margin-top: 2.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-foreground) 10%, transparent);
  letter-spacing: -0.01em;
}
h2 + p { margin-top: 0.25rem; }
h2 + p > em { color: var(--theme-foreground-muted); font-size: 0.88rem; }

/* ─── Threshold legend ─── */
.threshold-legend {
  display: flex;
  gap: 1.25rem;
  font-size: 0.75rem;
  margin: 0.5rem 0;
  color: var(--theme-foreground-muted);
}
.threshold-legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.threshold-legend span::before {
  content: '';
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 3px;
}
.legend-green::before { background: #10b981; }
.legend-yellow::before { background: #f59e0b; }
.legend-red::before { background: #ef4444; }
.legend-blue::before { background: #4f8cff; }
.legend-purple::before { background: #a78bfa; }

/* ─── Tables (Inputs.table) ─── */
table {
  border-collapse: separate;
  border-spacing: 0;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-foreground) 8%, transparent);
  width: 100%;
}
table thead th {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--theme-foreground-muted);
  font-weight: 600;
  background: var(--surface-1);
  padding: 0.65rem 0.75rem;
  position: sticky;
  top: 0;
  z-index: 2;
  cursor: pointer;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-foreground) 10%, transparent);
  transition: background 0.15s;
  white-space: nowrap;
}
table thead th:hover {
  background: var(--surface-2);
}
table td {
  font-variant-numeric: tabular-nums;
  padding: 0.55rem 0.75rem;
  font-size: 0.84rem;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-foreground) 5%, transparent);
  transition: background 0.1s;
}
table tbody tr {
  transition: background 0.12s;
}
table tbody tr:nth-child(even) td {
  background: color-mix(in srgb, var(--theme-foreground) 2%, transparent);
}
table tbody tr:hover td {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

/* ─── Observable Inputs styling ─── */
form[class*="Input"] {
  font-family: 'Geist Variable', system-ui, sans-serif;
}
input[type="search"], input[type="text"], select {
  font-family: 'Geist Variable', system-ui, sans-serif;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--theme-foreground) 12%, transparent);
  background: var(--surface-1);
  padding: 0.5rem 0.75rem;
  font-size: 0.84rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
input[type="search"]:focus, input[type="text"]:focus, select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--glow-blue);
}

/* ─── Chart tooltip styling ─── */
figure[class*="plot"] [class*="tip"],
.plot-tip,
[class*="plot-"] g[aria-label="tip"] g {
  font-family: 'Geist Variable', system-ui, sans-serif !important;
  font-size: 12px !important;
}
[class*="plot-"] g[aria-label="tip"] rect {
  rx: 10 !important;
  ry: 10 !important;
  fill-opacity: 0.95 !important;
  stroke-opacity: 0.3 !important;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2)) !important;
}

/* ─── Observable Plot SVG polish ─── */
figure[class*="plot"] {
  font-family: 'Geist Variable', system-ui, sans-serif;
}

/* ─── Cards (grid items) ─── */
.card {
  background: var(--surface-1);
  border: 1px solid color-mix(in srgb, var(--theme-foreground) 8%, transparent);
  border-radius: var(--radius);
  padding: 1.25rem;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.card:hover {
  box-shadow: 0 4px 20px var(--glow-blue);
  border-color: color-mix(in srgb, var(--accent) 20%, transparent);
}
.card h3 {
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* ─── Empty state ─── */
.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
  color: var(--theme-foreground-muted);
  font-size: 0.88rem;
  border: 1px dashed color-mix(in srgb, var(--theme-foreground) 12%, transparent);
  border-radius: var(--radius);
  margin: 1rem 0;
}
.empty-state strong {
  display: block;
  font-size: 1.05rem;
  margin-bottom: 0.5rem;
  color: var(--theme-foreground-faint);
}

/* ─── Progress bar ─── */
.progress-bar {
  background: var(--surface-2);
  border-radius: 6px;
  height: 8px;
  overflow: hidden;
  position: relative;
}
.progress-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.4s cubic-bezier(0.22,1,0.36,1);
}

/* ─── Filter bar ─── */
.filter-bar {
  display: flex;
  gap: 0.75rem;
  align-items: end;
  flex-wrap: wrap;
  margin: 1rem 0 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--surface-1);
  border: 1px solid color-mix(in srgb, var(--theme-foreground) 6%, transparent);
  border-radius: var(--radius);
}
.filter-bar label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--theme-foreground-muted);
  font-weight: 500;
}

/* ─── Badge ─── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.55rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.badge-red { background: rgba(239,68,68,0.12); color: #ef4444; }
.badge-green { background: rgba(16,185,129,0.12); color: #10b981; }
.badge-amber { background: rgba(245,158,11,0.12); color: #f59e0b; }
.badge-blue { background: rgba(79,140,255,0.12); color: #4f8cff; }
.badge-purple { background: rgba(167,139,250,0.12); color: #a78bfa; }

/* ─── Score pill (inline) ─── */
.score-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}
.score-pill.good { background: rgba(16,185,129,0.12); color: #10b981; }
.score-pill.warn { background: rgba(245,158,11,0.12); color: #f59e0b; }
.score-pill.bad { background: rgba(239,68,68,0.12); color: #ef4444; }

/* ─── Engagement card ─── */
.engagement-card {
  background: var(--surface-1);
  border: 1px solid color-mix(in srgb, var(--theme-foreground) 8%, transparent);
  border-radius: var(--radius);
  padding: 0.85rem 1rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.engagement-card:hover {
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
  box-shadow: 0 4px 16px var(--glow-blue);
}
</style>`,
  pager: false,
  pages: [
    {
      name: "Analytics",
      open: true,
      pages: [
        { name: "Executive Overview", path: "/" },
        { name: "DRep Performance", path: "/drep-performance" },
        { name: "Governance Activity", path: "/governance" },
        { name: "Voting Intelligence", path: "/voting" },
        { name: "Score Trends", path: "/trends" },
        { name: "DRep Engagement", path: "/engagement" },
      ],
    },
    {
      name: "Operations",
      open: false,
      pages: [
        { name: "Data Quality", path: "/data-quality" },
      ],
    },
  ],
};
