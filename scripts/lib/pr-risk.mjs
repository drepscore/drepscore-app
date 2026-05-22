// Pure PR risk-tier classification for the risk-tiered merge policy (B4).
// See brain/plans/horizon-2-backlog-and-merge-policy.md.
//
// Tiers:
//   low      — auto-merge eligible. The risk-tiered-auto-merge workflow
//              enables GitHub native auto-merge; required checks still gate
//              the actual merge.
//   standard — human chat-approval gate via `npm run github:merge` (today's
//              default for everything).
//   high     — explicit handling required (migrations, auth, scoring engine,
//              instrumentation, breaking changes).

const HIGH_RISK_PATTERNS = [
  /^supabase\/migrations\//,
  /^lib\/auth(\.|\/)/,
  /^lib\/scoring(\.|\/)/,
  /^lib\/alignment(\.|\/)/,
  /^lib\/ghi(\.|\/)/,
  /^lib\/matching(\.|\/)/,
  /^lib\/featureFlags\./,
  /^lib\/data(\.|\/)/,
  /^app\/api\/auth(\.|\/)/,
  /^app\/\(auth\)(\.|\/)/,
  /^instrumentation/,
  /^next\.config\./,
  /^\.github\/CODEOWNERS$/,
];

// All files in a PR must match one of these for the PR to be low-risk.
// Anything outside this allowlist falls to standard (or high, if also matched
// by HIGH_RISK_PATTERNS).
const LOW_RISK_PATTERNS = [
  /^docs\//,
  /\.md$/i,
  /^__tests__\//,
  /^e2e\//,
  /^tests\//,
  /^tasks\//,
  /^\.gitignore$/,
  /^\.gitattributes$/,
  /^\.prettier(ignore|rc.*)$/,
  /^\.editorconfig$/,
  /^LICENSE$/,
];

const MAX_LOW_FILES = 15;
const MAX_LOW_LINES = 300;

export function matchesAny(path, patterns) {
  return patterns.some((pattern) => pattern.test(path));
}

export function hasBreakingMarker(title, body) {
  if (/^[a-z]+(\([^)]*\))?!:/.test(title || '')) {
    return true;
  }
  return /BREAKING CHANGE/.test(`${title || ''}\n${body || ''}`);
}

// Classify a PR into low / standard / high. Pure — takes the PR metadata that
// `gh pr view --json number,title,body,additions,deletions,files` returns.
export function classifyPrRisk(pr) {
  const files = Array.isArray(pr?.files) ? pr.files : [];
  const title = pr?.title || '';
  const body = pr?.body || '';
  const additions = Number(pr?.additions ?? 0);
  const deletions = Number(pr?.deletions ?? 0);
  const totalLines = additions + deletions;
  const reasons = [];

  const highMatches = files.filter((file) => matchesAny(file.path, HIGH_RISK_PATTERNS));
  if (highMatches.length > 0) {
    reasons.push(
      `high-risk paths touched: ${highMatches
        .slice(0, 3)
        .map((file) => file.path)
        .join(', ')}`,
    );
    return { tier: 'high', reasons };
  }

  if (hasBreakingMarker(title, body)) {
    reasons.push('breaking-change marker present in title or body');
    return { tier: 'high', reasons };
  }

  if (files.length === 0) {
    reasons.push('no files in diff (unexpected)');
    return { tier: 'standard', reasons };
  }

  if (files.length > MAX_LOW_FILES) {
    reasons.push(`${files.length} files exceeds low-risk cap of ${MAX_LOW_FILES}`);
    return { tier: 'standard', reasons };
  }

  if (totalLines > MAX_LOW_LINES) {
    reasons.push(`${totalLines} lines (add+del) exceeds low-risk cap of ${MAX_LOW_LINES}`);
    return { tier: 'standard', reasons };
  }

  const offenders = files.filter((file) => !matchesAny(file.path, LOW_RISK_PATTERNS));
  if (offenders.length > 0) {
    reasons.push(
      `paths outside low-risk allowlist: ${offenders
        .slice(0, 3)
        .map((file) => file.path)
        .join(', ')}`,
    );
    return { tier: 'standard', reasons };
  }

  reasons.push(
    `${files.length} file(s) / ${totalLines} line(s); all paths in low-risk allowlist; no breaking-change marker`,
  );
  return { tier: 'low', reasons };
}

export const PR_RISK_CONSTANTS = {
  HIGH_RISK_PATTERNS,
  LOW_RISK_PATTERNS,
  MAX_LOW_FILES,
  MAX_LOW_LINES,
};
