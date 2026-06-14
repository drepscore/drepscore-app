import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('GovernadaHeader wallet modal mounting', () => {
  it('does not mount WalletConnectModal exclusively inside the no-wallets branch', async () => {
    const source = await readFile('components/governada/GovernadaHeader.tsx', 'utf8');
    const noWalletBranchStart = source.indexOf('/* No wallets detected: open full modal */');
    const quickConnectEnd = source.indexOf('function truncateImpersonateAddress');

    expect(noWalletBranchStart).toBeGreaterThan(0);
    expect(quickConnectEnd).toBeGreaterThan(noWalletBranchStart);

    const noWalletBranch = source.slice(noWalletBranchStart, quickConnectEnd);
    expect(noWalletBranch).not.toContain('<WalletConnectModal');

    const anonymousBranch = source.slice(
      source.indexOf('<QuickConnectButton', quickConnectEnd),
      source.indexOf('</header>', quickConnectEnd),
    );
    expect(anonymousBranch).toContain('<QuickConnectButton');
    expect(anonymousBranch).toContain('<WalletConnectModal open={walletModalOpen}');
  });
});
