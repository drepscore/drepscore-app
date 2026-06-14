import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Privacy - Governada',
  description:
    'Privacy baseline for Governada, including analytics behavior, wallet interactions, and browser Do Not Track support.',
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border/50 pt-6">
      {eyebrow && (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="space-y-8">
        <header className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Privacy
          </p>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              A plain-English privacy baseline
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Governada helps people understand Cardano governance using public data, optional
              wallet context, and product telemetry when it is enabled for a deployment. This page
              describes the current in-product baseline.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Last updated: June 14, 2026</p>
        </header>

        <Section eyebrow="Data sources" title="What Governada uses">
          <p>
            Governada reads public governance information such as proposals, votes, representative
            profiles, stake pool data, public statements, and derived scores used to explain the
            governance landscape.
          </p>
          <p>
            When you use interactive features, the app can process the information you intentionally
            provide, including preview choices, feedback, saved preferences, workspace actions, and
            wallet-connection state needed to personalize the interface.
          </p>
        </Section>

        <Section eyebrow="Wallets" title="What changes when you connect a wallet">
          <p>
            Connecting a wallet lets Governada show a more personal view of representation,
            delegation, voting context, and governance readiness. The app does not custody ADA and
            cannot approve on-chain actions for you.
          </p>
          <p>
            Any wallet prompt should be reviewed in your wallet extension or wallet app. Governada
            only treats an on-chain action as intentional after you approve it through that wallet
            flow.
          </p>
        </Section>

        <Section eyebrow="Telemetry" title="Current analytics baseline">
          <p>
            Analytics may be enabled in production deployments. When configured, Governada uses
            PostHog to understand product usage, such as page views, feature clicks, onboarding
            steps, and whether important flows are working.
          </p>
          <p>
            Telemetry is used to improve the product, find broken experiences, and understand which
            public-governance tools are useful. It is not a substitute for wallet records, on-chain
            data, or a user-controlled consent system.
          </p>
          <p>
            Governada respects browser Do Not Track. If your browser sends that signal, the PostHog
            browser client does not initialize.
          </p>
        </Section>

        <Section eyebrow="Choices" title="What you can control">
          <p>
            You can browse public governance pages without connecting a wallet. You can also decline
            wallet prompts, clear local browser storage, use browser privacy controls, or send a Do
            Not Track signal through your browser.
          </p>
          <p>
            Some personalized views require wallet context. If you disconnect or clear local state,
            those views may return to the public, anonymous experience until you connect again.
          </p>
        </Section>

        <Section eyebrow="Scope" title="What this page is and is not">
          <p>
            Governada is an independent community project. This page is a product-facing privacy
            baseline, not a jurisdiction-specific legal notice and not legal advice.
          </p>
          <p>
            If the analytics, wallet, consent, or data-retention posture changes materially, this
            page should be updated alongside the code that implements the change.
          </p>
        </Section>
      </div>
    </div>
  );
}
