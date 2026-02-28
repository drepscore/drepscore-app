# DRep Engagement & Inbox

*Governance inbox activity, DRep responsiveness, and notification delivery.*

```js
const data = FileAttachment("data/inbox-metrics.json").json();
```

```js
const { currentEpoch, totalActiveDreps, openProposals, drepActivity, notifications } = data;

const criticalOpen = openProposals.filter(p =>
  ["HardForkInitiation", "NoConfidence", "NewCommittee", "NewConstitutionalCommittee", "NewConstitution", "UpdateConstitution"].includes(p.proposal_type)
);
const urgentOpen = openProposals.filter(p => p.epochsRemaining != null && p.epochsRemaining <= 2);
const drepsVotedThisEpoch = drepActivity.filter(d => d.votesThisEpoch > 0).length;
const avgVotesThisEpoch = drepActivity.length > 0
  ? (drepActivity.reduce((s, d) => s + d.votesThisEpoch, 0) / drepActivity.length).toFixed(1)
  : "0";
const epochResponseRate = totalActiveDreps > 0
  ? Math.round((drepsVotedThisEpoch / totalActiveDreps) * 100)
  : 0;
```

<div class="kpi-row cols-5">
  <div class="kpi">
    <div class="kpi-label">Open Proposals</div>
    <div class="kpi-value">${openProposals.length}</div>
    <div class="kpi-sub">${criticalOpen.length} critical, ${urgentOpen.length} urgent</div>
    <div class="kpi-bar" style="background: var(--accent)"></div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Active DReps</div>
    <div class="kpi-value">${totalActiveDreps}</div>
    <div class="kpi-sub">${drepsVotedThisEpoch} voted this epoch</div>
    <div class="kpi-bar" style="background: var(--accent-green)"></div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Epoch Response Rate</div>
    <div class="kpi-value">${epochResponseRate}%</div>
    <div class="kpi-sub">DReps who voted in epoch ${currentEpoch}</div>
    <div class="kpi-bar" style="background: ${epochResponseRate >= 60 ? 'var(--accent-green)' : epochResponseRate >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)'}"></div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Avg Votes / DRep</div>
    <div class="kpi-value">${avgVotesThisEpoch}</div>
    <div class="kpi-sub">This epoch</div>
    <div class="kpi-bar" style="background: var(--accent-purple)"></div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Current Epoch</div>
    <div class="kpi-value">${currentEpoch}</div>
    <div class="kpi-sub">Cardano governance</div>
    <div class="kpi-bar" style="background: var(--accent)"></div>
  </div>
</div>

## Open Proposals by Type

```js
import * as Plot from "npm:@observablehq/plot";

const typeCounts = {};
for (const p of openProposals) {
  typeCounts[p.proposal_type] = (typeCounts[p.proposal_type] || 0) + 1;
}
const typeData = Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
```

```js
Plot.plot({
  marginLeft: 160,
  height: Math.max(200, typeData.length * 40),
  x: { label: "Count", grid: true },
  y: { label: null },
  marks: [
    Plot.barX(typeData, {
      y: "type",
      x: "count",
      fill: d => ["HardForkInitiation", "NoConfidence", "NewCommittee", "NewConstitutionalCommittee", "NewConstitution", "UpdateConstitution"].includes(d.type)
        ? "var(--accent-red)"
        : d.type === "ParameterChange"
        ? "var(--accent-amber)"
        : "var(--accent)",
      sort: { y: "-x" },
      tip: true,
    }),
    Plot.ruleX([0]),
  ],
})
```

## DRep Vote Coverage This Epoch

*How many open proposals each active DRep has voted on this epoch.*

```js
const buckets = [
  { label: "0 votes", count: drepActivity.filter(d => d.votesThisEpoch === 0).length },
  { label: "1-2 votes", count: drepActivity.filter(d => d.votesThisEpoch >= 1 && d.votesThisEpoch <= 2).length },
  { label: "3-5 votes", count: drepActivity.filter(d => d.votesThisEpoch >= 3 && d.votesThisEpoch <= 5).length },
  { label: "6+ votes", count: drepActivity.filter(d => d.votesThisEpoch >= 6).length },
];
```

```js
Plot.plot({
  marginLeft: 80,
  height: 200,
  x: { label: "DReps", grid: true },
  y: { label: null },
  marks: [
    Plot.barX(buckets, {
      y: "label",
      x: "count",
      fill: d => d.label === "0 votes" ? "var(--accent-red)" : d.label === "1-2 votes" ? "var(--accent-amber)" : "var(--accent-green)",
      tip: true,
    }),
    Plot.ruleX([0]),
  ],
})
```

## Urgent Proposals (≤ 2 Epochs Remaining)

```js
const urgentTable = urgentOpen.map(p => ({
  Title: p.title || "(untitled)",
  Type: p.proposal_type,
  "Epochs Left": p.epochsRemaining ?? "—",
  "DRep Votes": p.total_drep_votes,
  "Coverage %": totalActiveDreps > 0 ? Math.round((p.total_drep_votes / totalActiveDreps) * 100) + "%" : "—",
}));
```

```js
urgentTable.length > 0
  ? Inputs.table(urgentTable, { sort: "Epochs Left" })
  : html`<div class="empty-state"><strong>No urgent proposals</strong>All open proposals have 3+ epochs remaining.</div>`
```

## Top DReps by This-Epoch Activity

```js
const topDreps = drepActivity
  .filter(d => d.votesThisEpoch > 0)
  .slice(0, 20)
  .map(d => ({
    DRep: d.name || d.drepId.slice(0, 20) + "…",
    Score: d.score,
    "Votes This Epoch": d.votesThisEpoch,
    "Total Votes": d.totalVotes,
    "Participation %": Math.round(d.participationRate) + "%",
  }));
```

```js
topDreps.length > 0
  ? Inputs.table(topDreps)
  : html`<div class="empty-state"><strong>No votes yet</strong>No DReps have voted in epoch ${currentEpoch}.</div>`
```

## Notification Delivery (Last 7 Days)

```js
const notifTable = notifications.map(n => ({
  "Event Type": n.eventType,
  Channel: n.channel,
  Sent: n.count,
  Delivered: n.delivered,
  "Delivery %": n.count > 0 ? Math.round((n.delivered / n.count) * 100) + "%" : "—",
}));
```

```js
notifTable.length > 0
  ? Inputs.table(notifTable, { sort: "Sent", reverse: true })
  : html`<div class="empty-state"><strong>No notifications sent</strong>No notification events in the last 7 days.</div>`
```

<div class="tip-box">
  <strong>Engagement funnel</strong> — Track inbox opens → proposal clicks → rationale generated → vote submitted in PostHog for the full conversion funnel. This dashboard covers the operational/governance side; PostHog covers user behavior analytics.
</div>
