import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageViewTracker } from '@/components/PageViewTracker';

export const metadata: Metadata = {
  title: 'Learn — DRepScore',
  description:
    'Learn about Cardano governance, the three governing bodies, how DRepScore works, and how to participate.',
};

const sections = [
  {
    title: 'What is Cardano Governance?',
    content: [
      'Cardano entered the Voltaire era with CIP-1694, making it one of the first blockchains with fully on-chain, decentralized governance.',
      'Every ADA holder can now influence the future of the protocol — from treasury withdrawals to hard forks — by delegating their voting power to a Delegated Representative (DRep) or voting directly.',
      'Governance proposals are submitted on-chain and require approval from three independent bodies before taking effect.',
    ],
  },
  {
    title: 'The Three Governance Bodies',
    items: [
      {
        name: 'Delegated Representatives (DReps)',
        desc: 'Any ADA holder can register as a DRep and vote on behalf of delegators. They are the voice of the Cardano community.',
      },
      {
        name: 'Stake Pool Operators (SPOs)',
        desc: 'Block producers who maintain the network. They vote on critical protocol changes like hard forks and provide a technical perspective on governance.',
      },
      {
        name: 'Constitutional Committee (CC)',
        desc: 'A small group responsible for ensuring proposals comply with the Cardano Constitution. They provide a constitutional check on governance actions.',
      },
    ],
  },
  {
    title: 'How DRepScore Works',
    content: [
      'DRepScore rates every DRep across multiple dimensions: voting participation, rationale quality, community engagement, and governance consistency.',
      'Scores range from 0-100 and update after each governance epoch. Higher scores indicate DReps who consistently show up, explain their reasoning, and engage with the community.',
      'We also compute alignment scores — how closely a DRep\'s voting pattern matches your governance preferences — to help you find your ideal representative.',
    ],
  },
  {
    title: 'How to Delegate',
    steps: [
      'Connect your Cardano wallet (Eternl, Lace, Nami, Yoroi, etc.) to DRepScore.',
      'Browse DReps on the Discover page. Filter by score, alignment, or governance dimension.',
      'Review a DRep\'s profile: their score breakdown, voting record, and rationales.',
      'Click "Delegate" on your chosen DRep\'s profile and confirm the transaction in your wallet.',
      'Your voting power is now delegated! You can change your delegation at any time.',
    ],
  },
  {
    title: 'How to Participate',
    items: [
      {
        name: 'As an ADA Holder',
        desc: 'Delegate to a DRep who shares your values, or register as a DRep yourself. Every ADA of delegated stake strengthens governance.',
      },
      {
        name: 'As a DRep',
        desc: 'Vote on proposals, write rationales explaining your reasoning, and engage with your delegators. Your DRepScore reflects your governance commitment.',
      },
      {
        name: 'As an SPO',
        desc: 'Vote on protocol-level proposals (hard forks, security parameters). Your vote carries the weight of your pool\'s pledge and stake.',
      },
      {
        name: 'As a CC Member',
        desc: 'Review proposals for constitutional compliance and cast your committee vote. Transparency in your reasoning builds trust.',
      },
    ],
  },
];

export default function LearnPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="learn_page_viewed" />

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Learn</h1>
        <p className="text-sm text-muted-foreground">
          Everything you need to know about Cardano governance and how DRepScore helps you participate.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.content?.map((para, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                  {para}
                </p>
              ))}

              {section.items?.map((item) => (
                <div key={item.name} className="space-y-1">
                  <h3 className="text-sm font-semibold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}

              {section.steps?.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-bold text-cyan-500">
                    {i + 1}
                  </span>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
