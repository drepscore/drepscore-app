/**
 * Methodology Page
 * Explains scoring system transparently — V3 model with Reliability pillar
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Methodology | DRepScore',
  description: 'How DRepScore calculates accountability scores and value alignment',
};

export default function MethodologyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Scoring Methodology</h1>
        <p className="text-muted-foreground">
          Transparency is core to DRepScore. This page explains exactly how we calculate scores
          so you can trust and verify our methodology.
        </p>
      </div>

      <div className="space-y-8">
        {/* Philosophy */}
        <Card>
          <CardHeader>
            <CardTitle>Our Philosophy: Rationale-Forward Governance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              We believe the most important thing a DRep can do is <strong>explain their reasoning</strong>.
              Participation matters, but a DRep who shows up and votes without explanation is less
              accountable than one who clearly articulates why they voted the way they did.
            </p>
            <p>
              Our scoring model reflects this belief: <strong>Rationale is the highest-weighted pillar</strong> at 35%.
              This rewards DReps who invest in transparency and gives delegators the information
              they need to evaluate whether a DRep truly represents their values.
            </p>
          </CardContent>
        </Card>

        {/* DRep Score Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              DRep Score
              <Badge variant="outline">Objective</Badge>
            </CardTitle>
            <CardDescription>
              A 0-100 accountability metric measuring how well a DRep fulfills governance responsibilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2">Formula</h4>
              <code className="block bg-muted p-3 rounded-lg text-sm">
                DRep Score = (Effective Participation × 0.30) + (Adjusted Rationale × 0.35) + (Reliability × 0.20) + (Profile Completeness × 0.15)
              </code>
            </div>

            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h5 className="font-medium">Effective Participation (30% weight)</h5>
                <p className="text-sm text-muted-foreground mt-1">
                  Raw participation rate adjusted by a <strong>Deliberation Modifier</strong> that penalizes uniform voting patterns.
                </p>
                <code className="block bg-muted p-2 rounded text-xs mt-2">
                  Effective Participation = Participation Rate × Deliberation Modifier
                </code>
                <div className="mt-2 text-sm">
                  <p className="font-medium">Deliberation Modifier:</p>
                  <ul className="list-disc pl-6 text-muted-foreground">
                    <li>&gt;95% same direction: 0.70 (30% discount)</li>
                    <li>&gt;90% same direction: 0.85 (15% discount)</li>
                    <li>&gt;85% same direction: 0.95 (5% discount)</li>
                    <li>≤85% same direction: 1.00 (no discount)</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Why?</strong> A DRep who votes Yes on 98% of proposals isn&apos;t demonstrating thoughtful deliberation — they&apos;re rubber-stamping.
                  We reward DReps who engage with proposals individually.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h5 className="font-medium">Rationale Rate (35% weight)</h5>
                <p className="text-sm text-muted-foreground mt-1">
                  Measures how often a DRep provides meaningful on-chain rationale for <em>binding governance decisions</em>,
                  weighted by proposal importance and adjusted with a forgiving curve.
                </p>
                <div className="mt-2 text-sm">
                  <p className="font-medium">Proposal Importance Weights:</p>
                  <ul className="list-disc pl-6 text-muted-foreground">
                    <li><strong>Critical (3×)</strong>: Hard forks, no confidence motions, constitutional committee changes, constitution updates</li>
                    <li><strong>Important (2×)</strong>: Significant/major treasury withdrawals, parameter changes</li>
                    <li><strong>Standard (1×)</strong>: Routine treasury withdrawals</li>
                    <li><strong>Excluded</strong>: InfoActions (non-binding sentiment polls)</li>
                  </ul>
                </div>
                <div className="mt-2 text-sm">
                  <p className="font-medium">Forgiving Curve:</p>
                  <ul className="list-disc pl-6 text-muted-foreground">
                    <li>0-20% raw → 0-30 adjusted (rewards initial effort)</li>
                    <li>20-60% raw → 30-70 adjusted (linear middle)</li>
                    <li>60-100% raw → 70-100 adjusted (diminishing returns)</li>
                  </ul>
                  <p className="text-muted-foreground mt-1">
                    The displayed rate is curve-adjusted to match what the algorithm uses.
                  </p>
                </div>
                <div className="mt-2 text-sm">
                  <p className="font-medium">Quality Threshold:</p>
                  <p className="text-muted-foreground">
                    Rationale must be at least 50 characters to count. Votes with externally-hosted rationale
                    (IPFS/HTTP) that hasn&apos;t been fetched yet are given benefit of the doubt.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Why 35%?</strong> Rationale is the highest-weighted pillar because it&apos;s the single best signal
                  of accountability. A DRep who explains their reasoning enables delegators to verify alignment —
                  without rationale, votes are opaque. We want to heavily incentivize the practice of public reasoning.
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h5 className="font-medium">Reliability (20% weight)</h5>
                <p className="text-sm text-muted-foreground mt-1">
                  Measures whether a DRep can be <em>counted on to keep showing up</em> — distinct from participation
                  (which measures how many proposals they voted on). Reliability tracks the <strong>pattern of engagement over time</strong>.
                </p>
                <div className="mt-2 text-sm">
                  <p className="font-medium">Four Components:</p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                    <li>
                      <strong>Active Streak (35%)</strong>: Consecutive recent epochs where the DRep voted.
                      Epochs with no active proposals are skipped. Scores 10 points per consecutive epoch, capped at 100.
                    </li>
                    <li>
                      <strong>Recency (30%)</strong>: Exponential decay based on how many epochs since the last vote.
                      Voting this epoch = 100; each epoch of inactivity decays the score (half-life ~5 epochs).
                    </li>
                    <li>
                      <strong>Gap Penalty (20%)</strong>: Penalizes the longest continuous stretch of inactivity
                      during proposal epochs. Each epoch of gap costs 12 points from a starting 100.
                    </li>
                    <li>
                      <strong>Tenure (15%)</strong>: Time since first vote, with diminishing returns (logarithmic curve).
                      Rewards sustained presence in governance without over-weighting longevity alone.
                    </li>
                  </ul>
                </div>
                <code className="block bg-muted p-2 rounded text-xs mt-2">
                  Reliability = (Streak × 0.35) + (Recency × 0.30) + (GapPenalty × 0.20) + (Tenure × 0.15)
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Why?</strong> A DRep who voted on every proposal (100% participation) but only during a single month
                  before disappearing would score high on participation but low on reliability. Delegators need to know
                  their representative will be there for the <em>next</em> vote, not just past ones. Reliability measures
                  that forward-looking trustworthiness.
                </p>
              </div>

              <div className="border-l-4 border-cyan-500 pl-4">
                <h5 className="font-medium">Profile Completeness (15% weight)</h5>
                <p className="text-sm text-muted-foreground mt-1">
                  Measures how thoroughly a DRep has filled out their CIP-119 governance metadata profile.
                </p>
                <div className="mt-2 text-sm">
                  <p className="font-medium">Point Allocation (100 total):</p>
                  <ul className="list-disc pl-6 text-muted-foreground">
                    <li>Name (givenName): 15 points</li>
                    <li>Governance objectives: 20 points</li>
                    <li>Motivations: 15 points</li>
                    <li>Qualifications: 10 points</li>
                    <li>Bio: 10 points</li>
                    <li>Verified social links: 25 points (1 link) or 30 points (2+ links)</li>
                  </ul>
                </div>
                <div className="mt-2 text-sm">
                  <p className="font-medium">Broken Link Detection:</p>
                  <p className="text-muted-foreground">
                    Social links are validated periodically. Links that return errors or point to non-existent accounts
                    (including soft-404s on platforms like X/Twitter) are flagged as broken and reduce the profile score.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Why?</strong> DReps who invest in their public profile provide delegators with context for informed
                  delegation decisions. Listing working communication channels signals ongoing engagement and gives
                  delegators ways to follow a DRep&apos;s reasoning beyond on-chain activity.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Match Score Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Match Score
              <Badge variant="outline">Personal</Badge>
            </CardTitle>
            <CardDescription>
              A 0-100% alignment score based on your selected value preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2">How It Works</h4>
              <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground">
                <li>You select value preferences that matter to you (e.g., Treasury Conservative, Decentralization First)</li>
                <li>We classify each governance proposal using its CIP-1694 type and on-chain data</li>
                <li>For each preference you selected, we calculate how aligned a DRep&apos;s voting record is (0-100%)</li>
                <li>Your Match Score is the average of only the categories you selected</li>
              </ol>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Preference Categories</h4>

              <div className="grid gap-4">
                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    Treasury Conservative
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps who vote No on large (&gt;20M ADA) treasury withdrawals and show restraint with ecosystem funds.
                    Routine withdrawals (&lt;1M ADA) have minimal impact.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    Treasury Growth
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps who vote Yes on treasury funding proposals, supporting ecosystem development and innovation investment.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    Decentralization First
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps with moderate voting power (not whales) who don&apos;t concentrate too much influence in one entity.
                    Based on the DRep&apos;s size tier.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    Security Focus
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps who take conservative positions on protocol parameter changes and hard forks, prioritizing network stability.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    Innovation Forward
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps who vote Yes on hard forks and protocol upgrades, embracing technological progress.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    Transparency Advocate
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps with high rationale rates who consistently explain their voting decisions.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Treasury Amount Tiering</h4>
              <p className="text-sm text-muted-foreground mb-2">
                We classify treasury withdrawals by amount to provide nuanced scoring:
              </p>
              <ul className="list-disc pl-6 text-sm text-muted-foreground">
                <li><strong>Routine</strong>: &lt;1M ADA — minimal impact on alignment</li>
                <li><strong>Significant</strong>: 1M-20M ADA — moderate impact</li>
                <li><strong>Major</strong>: &gt;20M ADA — high impact on treasury preferences</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Section */}
        <Card>
          <CardHeader>
            <CardTitle>Governance Alerts</CardTitle>
            <CardDescription>
              How we keep you informed about your DRep and governance activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When you connect your wallet, we monitor your delegated and watchlisted DReps to surface
              the information that matters most. All alerts appear in the bell icon in the header.
            </p>
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div>
                <p className="font-medium mb-1">Alignment Shift Alerts</p>
                <p className="text-sm text-muted-foreground">
                  You&apos;ll be notified when a DRep&apos;s alignment score drops by more than <strong>8 percentage points</strong> from
                  their previous score. This filters out noise from individual votes while catching meaningful pattern changes.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">Inactivity Warnings</p>
                <p className="text-sm text-muted-foreground">
                  If your delegated DRep hasn&apos;t voted in over 30 days, you&apos;ll see a warning so you can
                  review their activity and consider whether they&apos;re still representing your interests.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">New Proposals</p>
                <p className="text-sm text-muted-foreground">
                  See how many new governance proposals have been submitted since your last visit.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">Vote Activity Summary</p>
                <p className="text-sm text-muted-foreground">
                  Recent votes by your DRep are evaluated against your preferences so you can see
                  whether their voting aligns with your values.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              A persistent insight banner below the header summarizes your current DRep&apos;s compatibility
              and highlights how many alternatives score higher for your preferences.
            </p>
          </CardContent>
        </Card>

        {/* Data Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Data Sources</CardTitle>
            <CardDescription>
              Where our data comes from
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="font-medium min-w-[120px]">DRep Data:</span>
                <span className="text-muted-foreground">Koios API (mainnet) — refreshed periodically</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium min-w-[120px]">Vote History:</span>
                <span className="text-muted-foreground">Koios /drep_votes endpoint</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium min-w-[120px]">Proposals:</span>
                <span className="text-muted-foreground">Koios /proposal_list endpoint with CIP-1694 type classification</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium min-w-[120px]">Metadata:</span>
                <span className="text-muted-foreground">IPFS/HTTP URLs from on-chain metadata references</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Limitations */}
        <Card>
          <CardHeader>
            <CardTitle>Known Limitations</CardTitle>
            <CardDescription>
              What our scores can and cannot tell you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong>Catalyst voting</strong> is on a separate system and not yet integrated into our scoring.
              </li>
              <li>
                <strong>Rationale quality</strong> uses a minimum length threshold (50 characters) but does not assess
                depth or thoughtfulness beyond that.
              </li>
              <li>
                <strong>New DReps</strong> may have low reliability scores due to limited voting history rather than genuine disengagement.
                The tenure component partially mitigates this, but new DReps should focus on building their streak.
              </li>
              <li>
                <strong>Rationale text</strong> is fetched from IPFS and cached on demand; the first time you view a DRep,
                some rationales may show as &quot;hosted externally&quot; until they are cached.
              </li>
              <li>
                <strong>Proposal classification</strong> relies on CIP-1694 types and treasury amounts; some edge cases may be imperfectly categorized.
              </li>
              <li>
                <strong>Social link validation</strong> uses platform-specific detection for soft-404s (e.g., X/Twitter accounts that
                return HTTP 200 for non-existent profiles). Detection may have false positives if platforms change their response format.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Contact */}
        <div className="text-center py-8 border-t">
          <p className="text-muted-foreground">
            Questions about our methodology? Suggestions for improvement?
          </p>
          <p className="mt-2">
            Reach out via <strong>$drepscore</strong> on Cardano or open an issue on our GitHub.
          </p>
        </div>
      </div>
    </div>
  );
}
