'use client';

import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight } from 'lucide-react';

interface ClaimProfileBannerProps {
  drepId: string;
}

export function ClaimProfileBanner({ drepId }: ClaimProfileBannerProps) {
  const { isAuthenticated, sessionAddress } = useWallet();

  if (isAuthenticated && sessionAddress === drepId) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Are you this DRep?</p>
            <p className="text-sm text-muted-foreground">
              Claim your profile by connecting your wallet
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/profile">
            Claim Profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
