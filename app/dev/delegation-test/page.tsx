export const dynamic = 'force-dynamic';

import { DelegationTestClient } from './DelegationTestClient';

export default function DelegationTestPage() {
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="container mx-auto p-8 text-center">
        <p className="text-muted-foreground">This page is only available in development.</p>
      </div>
    );
  }

  return <DelegationTestClient />;
}
