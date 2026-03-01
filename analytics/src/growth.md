# User Growth & Engagement

```js
const userActivity = FileAttachment("data/user-activity.json").json();
const govEvents = FileAttachment("data/governance-events.json").json();
const notifications = FileAttachment("data/notification-log.json").json();
```

```js
const { users, dailySignups } = userActivity;
const { pollActivity, watchlistActivity } = govEvents;

const totalUsers = users.length;
const claimedDReps = users.filter(u => u.has_claimed).length;
const claimRate = totalUsers > 0 ? Math.round(claimedDReps / totalUsers * 100) : 0;
const recentActive = users.filter(u => {
  if (!u.last_login) return false;
  return (Date.now() - new Date(u.last_login).getTime()) / 86400000 < 7;
}).length;

const totalNotifications = notifications.length;
const readNotifications = notifications.filter(n => n.read).length;
const readRate = totalNotifications > 0 ? Math.round(readNotifications / totalNotifications * 100) : 0;
```

<div class="kpi-row cols-4">
  <div class="kpi">
    <span class="kpi-label">Total Users</span>
    <span class="kpi-value">${totalUsers}</span>
    <span class="kpi-sub">${claimedDReps} DReps claimed (${claimRate}%)</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">7-Day Active</span>
    <span class="kpi-value">${recentActive}</span>
    <span class="kpi-sub">${totalUsers > 0 ? Math.round(recentActive / totalUsers * 100) : 0}% return rate</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Total Poll Votes</span>
    <span class="kpi-value">${pollActivity.reduce((s, d) => s + d.votes, 0).toLocaleString()}</span>
    <span class="kpi-sub">${pollActivity.reduce((s, d) => s + d.unique_voters, 0)} unique voters (90d)</span>
  </div>
  <div class="kpi">
    <span class="kpi-label">Notification Read Rate</span>
    <span class="kpi-value">${readRate}%</span>
    <span class="kpi-sub">${readNotifications}/${totalNotifications} read</span>
  </div>
</div>

## Daily Signups & Claims

```js
Plot.plot({
  height: 300,
  marginLeft: 50,
  style: { fontSize: "12px" },
  x: { type: "utc", label: "Date →" },
  y: { label: "↑ Count", grid: true },
  marks: [
    Plot.rectY(dailySignups, Plot.binX({ y: "sum" }, {
      x: d => new Date(d.day),
      y: "signups",
      fill: "var(--accent)",
      fillOpacity: 0.7,
      interval: "day",
      tip: true,
    })),
    Plot.line(dailySignups, {
      x: d => new Date(d.day),
      y: "claims",
      stroke: "#10b981",
      strokeWidth: 2,
      tip: true,
    }),
    Plot.ruleY([0]),
  ]
})
```

<div class="threshold-legend">
  <span style="color: var(--accent)">■ Signups</span>
  <span style="color: #10b981">— Claims</span>
</div>

## Community Poll Activity (90 days)

```js
Plot.plot({
  height: 300,
  marginLeft: 50,
  style: { fontSize: "12px" },
  x: { type: "utc", label: "Date →" },
  y: { label: "↑ Votes", grid: true },
  marks: [
    Plot.areaY(pollActivity, {
      x: d => new Date(d.day),
      y: "votes",
      fill: "var(--accent-purple)",
      fillOpacity: 0.3,
      curve: "step",
    }),
    Plot.line(pollActivity, {
      x: d => new Date(d.day),
      y: "votes",
      stroke: "var(--accent-purple)",
      strokeWidth: 2,
    }),
    Plot.line(pollActivity, {
      x: d => new Date(d.day),
      y: "unique_voters",
      stroke: "#f59e0b",
      strokeWidth: 1.5,
      strokeDasharray: "4,2",
    }),
    Plot.ruleY([0]),
  ]
})
```

<div class="threshold-legend">
  <span style="color: var(--accent-purple)">■ Total Votes</span>
  <span style="color: #f59e0b">- - Unique Voters</span>
</div>

## Notification Breakdown

```js
const notifByType = d3.rollups(notifications, v => v.length, d => d.event_type)
  .map(([type, count]) => ({ type, count }))
  .sort((a, b) => b.count - a.count);
```

```js
Plot.plot({
  height: 300,
  marginLeft: 140,
  style: { fontSize: "12px" },
  x: { label: "Count →", grid: true },
  y: { label: null },
  marks: [
    Plot.barX(notifByType, {
      y: "type",
      x: "count",
      fill: "var(--accent)",
      fillOpacity: 0.8,
      sort: { y: "-x" },
      tip: true,
    }),
    Plot.ruleX([0]),
  ]
})
```
