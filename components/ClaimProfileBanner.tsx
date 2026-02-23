'use client';

import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight, Sparkles, Share2 } from 'lucide-react';

interface ClaimProfileBannerProps {
  drepId: string;
}

export function ClaimProfileBanner({ drepId }: ClaimProfileBannerProps) {
  const { isAuthenticated, ownDRepId } = useWallet();

  // DRep owner viewing their own page — hide entirely
  if (isAuthenticated && ownDRepId === drepId) {
    return null;
  }

  // Authenticated but not this DRep — softer "share" variant
  if (isAuthenticated) {
    return (
      <Card id="claim" className="border-muted bg-muted/30 scroll-mt-20">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-full bg-muted">
              <Share2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">
                Know this DRep?
              </p>
              <p className="text-xs text-muted-foreground">
                Share this page so they can claim their profile and track their score over time.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Copy Link
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Not authenticated — original CTA
  return (
    <Card id="claim" className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 scroll-mt-20">
      <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/15">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-lg flex items-center gap-2">
              Are you this DRep?
              <Sparkles className="h-4 w-4 text-amber-500" />
            </p>
            <p className="text-sm text-muted-foreground">
              Connect your wallet to claim this profile and access your personalized DRep dashboard.
            </p>
          </div>
        </div>
        <Button asChild className="gap-2">
          <Link href="/profile">
            Claim Profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
