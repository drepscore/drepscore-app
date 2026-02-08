'use client';

/**
 * Global Header Component
 * Features $drepscore branding and wallet connection
 */

import Link from 'next/link';
import { WalletConnect } from './WalletConnect';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-primary">$drepscore</span>
          </div>
        </Link>
        
        <nav className="flex items-center space-x-6">
          <Link
            href="/"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Home
          </Link>
          {/* Future navigation items */}
          <WalletConnect />
        </nav>
      </div>
    </header>
  );
}
