/**
 * Methodology Page
 * Explains scoring system transparently
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
                DRep Score = (Effective Participation × 0.45) + (Rationale Rate × 0.35) + (Consistency × 0.20)
              </code>
            </div>

            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h5 className="font-medium">Effective Participation (45% weight)</h5>
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
                  <strong>Why?</strong> A DRep who votes Yes on 98% of proposals isn't demonstrating thoughtful deliberation—they're rubber-stamping. 
                  We reward DReps who engage with proposals individually.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h5 className="font-medium">Rationale Rate (35% weight)</h5>
                <p className="text-sm text-muted-foreground mt-1">
                  Percentage of votes where the DRep provided a written explanation.
                </p>
                <code className="block bg-muted p-2 rounded text-xs mt-2">
                  Rationale Rate = (Votes with Rationale / Total Votes) × 100
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Why?</strong> Accountability requires justification. A DRep who explains their reasoning helps delegators 
                  understand their decision-making and holds themselves publicly accountable.
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h5 className="font-medium">Consistency (20% weight)</h5>
                <p className="text-sm text-muted-foreground mt-1">
                  Measures how steadily a DRep participates <em>across epochs that had active proposals</em>. 
                  Only epochs where governance actions were available to vote on count toward this score — 
                  gaps during quiet periods do not penalize a DRep.
                </p>
                <code className="block bg-muted p-2 rounded text-xs mt-2">
                  Consistency = 60% × (1 − CV of votes/epoch) + 40% × (active epochs / proposal epochs)
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Why?</strong> A DRep who was highly active for one month then disappeared is less reliable than 
                  one who votes consistently epoch after epoch. Governance requires sustained engagement. We only measure 
                  against epochs where proposals were live, so DReps aren't punished for quiet periods on-chain.
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
                <li>For each preference you selected, we calculate how aligned a DRep's voting record is (0-100%)</li>
                <li>Your Match Score is the average of only the categories you selected</li>
              </ol>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Preference Categories</h4>
              
              <div className="grid gap-4">
                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    💰 Treasury Conservative
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps who vote No on large (&gt;20M ADA) treasury withdrawals and show restraint with ecosystem funds.
                    Routine withdrawals (&lt;1M ADA) have minimal impact.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    📈 Treasury Growth
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps who vote Yes on treasury funding proposals, supporting ecosystem development and innovation investment.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    🌐 Decentralization First
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps with moderate voting power (not whales) who don't concentrate too much influence in one entity.
                    Based on the DRep's size tier.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    🔒 Security Focus
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps who take conservative positions on protocol parameter changes and hard forks, prioritizing network stability.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    🚀 Innovation Forward
                  </h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Favors DReps who vote Yes on hard forks and protocol upgrades, embracing technological progress.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-medium flex items-center gap-2">
                    📋 Transparency Advocate
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
                <strong>Delegator counts</strong> are not currently available via Koios API, so we cannot factor in community support metrics.
              </li>
              <li>
                <strong>Catalyst voting</strong> is on a separate system and not integrated into our scoring.
              </li>
              <li>
                <strong>Rationale quality</strong> is not assessed—we only check if rationale exists, not if it's thoughtful.
              </li>
              <li>
                <strong>New DReps</strong> may have low consistency scores due to limited voting history rather than genuine disengagement.
              </li>
              <li>
                <strong>Rationale text</strong> is fetched from IPFS and cached on demand; the first time you view a DRep, 
                some rationales may show as "hosted externally" until they are cached.
              </li>
              <li>
                <strong>Proposal classification</strong> relies on CIP-1694 types and treasury amounts; some edge cases may be imperfectly categorized.
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
