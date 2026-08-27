import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Terms - Governada',
  description:
    'Basic terms for Governada, including independent-project status, informational-use limits, and user responsibilities.',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border/50 pt-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="space-y-8">
        <header className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Terms
          </p>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Terms for using Governada
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Governada is built to make Cardano governance easier to understand and act on. These
              terms set the baseline expectations for using the app.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Last updated: June 14, 2026</p>
        </header>

        <Section title="Independent community project">
          <p>
            Governada is an independent community project. Unless a page clearly says otherwise, it
            is not affiliated with, endorsed by, sponsored by, or acting on behalf of the Cardano
            Foundation, IOG, EMURGO, Intersect, or any other governance body.
          </p>
        </Section>

        <Section title="Informational, not advice">
          <p>
            The app provides governance intelligence, summaries, rankings, matching, alerts, and
            workflow tools for informational and productivity purposes. It is not legal, financial,
            tax, investment, or voting advice.
          </p>
          <p>
            Governance decisions can affect real funds, reputation, and protocol outcomes. Review
            source materials, proposal details, representative statements, and wallet prompts before
            deciding what to do.
          </p>
        </Section>

        <Section title="Wallet and account responsibility">
          <p>
            You are responsible for your wallet, keys, connected accounts, delegation choices,
            votes, and any transaction or signature you approve. Governada does not custody ADA and
            cannot recover funds or reverse on-chain actions.
          </p>
          <p>
            If something in the app looks inconsistent with your wallet, the chain, or official
            proposal source material, treat the official source and your wallet confirmation as the
            higher-authority signal.
          </p>
        </Section>

        <Section title="Use the product respectfully">
          <p>
            Do not use Governada to attack the service, interfere with other users, scrape or abuse
            endpoints, submit malicious content, impersonate people, or misrepresent governance
            activity.
          </p>
          <p>
            Public governance is stronger when disagreement stays inspectable, sourced, and civil.
            The app may change, limit, or remove features that are being abused or that put the
            community experience at risk.
          </p>
        </Section>

        <Section title="Availability and changes">
          <p>
            Governada is provided as-is. Features, data sources, scoring models, explanations, and
            workflows may change as the product improves and as Cardano governance evolves.
          </p>
          <p>
            The team may update these terms when the product changes materially. Continued use of
            the app means you accept the current baseline terms shown here.
          </p>
        </Section>
      </div>
    </div>
  );
}
