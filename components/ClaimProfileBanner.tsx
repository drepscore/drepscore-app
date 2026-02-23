'use client';

import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight, Sparkles } from 'lucide-react';

interface ClaimProfileBannerProps {
  drepId: string;
}

export function ClaimProfileBanner({ drepId }: ClaimProfileBannerProps) {
  const { isAuthenticated } = useWallet();

  // Hide banner if user is authenticated (they either are this DRep or aren't)
  if (isAuthenticated) {
    return null;
  }

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
              Claim your profile to verify ownership and customize your page. 
              Future: Link your $drepscore ADA Handle.
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
