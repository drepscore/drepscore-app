'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWallet } from '@/utils/wallet';
import { useAlignmentAlerts, AlertType } from '@/hooks/useAlignmentAlerts';
import { getStoredSession } from '@/lib/supabaseAuth';

const WalletConnectModal = dynamic(
  () => import('./WalletConnectModal').then(mod => mod.WalletConnectModal),
  { ssr: false }
);
import { ModeToggle } from './mode-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  Shield,
  User,
  LogOut,
  TrendingDown,
  Wallet,
  Info,
  BookOpen,
  ScrollText,
  AlertTriangle,
  FileText,
  Vote,
  X,
  Sparkles,
  UserCircle,
  Clock,
  Activity,
  Inbox,
} from 'lucide-react';

const ALERT_ICONS: Record<AlertType, typeof TrendingDown> = {
  'alignment-shift': TrendingDown,
  'inactivity': AlertTriangle,
  'new-proposals': FileText,
  'vote-activity': Vote,
  'drep-score-change': Sparkles,
  'drep-profile-gap': UserCircle,
  'drep-missed-epoch': Clock,
  'drep-pending-proposals': Vote,
  'drep-urgent-deadline': Clock,
  'critical-proposal-open': AlertTriangle,
  'drep-missing-votes': Vote,
};

const ALERT_COLORS: Record<AlertType, string> = {
  'alignment-shift': 'text-amber-500',
  'inactivity': 'text-amber-500',
  'new-proposals': 'text-blue-500',
  'vote-activity': 'text-primary',
  'drep-score-change': 'text-green-500',
  'drep-profile-gap': 'text-amber-500',
  'drep-missed-epoch': 'text-red-500',
  'drep-pending-proposals': 'text-blue-500',
  'drep-urgent-deadline': 'text-red-500',
  'critical-proposal-open': 'text-red-500',
  'drep-missing-votes': 'text-amber-500',
};

export function Header() {
  const { isAuthenticated, sessionAddress, address, connected, ownDRepId, logout } = useWallet();
  const { alerts, unreadCount, dismissAlert } = useAlignmentAlerts();
  const pathname = usePathname();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const navLinkClass = (href: string) =>
    `hidden sm:flex items-center gap-1 text-sm transition-colors ${
      isActive(href) ? 'font-medium text-primary' : 'text-muted-foreground hover:text-foreground'
    }`;

  useEffect(() => {
    if (!isAuthenticated) { setDisplayName(null); return; }
    const token = getStoredSession();
    if (!token) return;
    fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.display_name) setDisplayName(data.display_name); })
      .catch(() => {});
  }, [isAuthenticated]);

  const adminCheckAddress = sessionAddress || address;
  useEffect(() => {
    if (!adminCheckAddress) { setIsAdmin(false); return; }
    fetch('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: adminCheckAddress }),
    })
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [adminCheckAddress]);

  const [inboxCount, setInboxCount] = useState(0);
  useEffect(() => {
    if (!ownDRepId) { setInboxCount(0); return; }
    fetch(`/api/dashboard/inbox?drepId=${encodeURIComponent(ownDRepId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.pendingCount) setInboxCount(data.pendingCount); })
      .catch(() => {});
  }, [ownDRepId]);

  useEffect(() => {
    const handler = () => setWalletModalOpen(true);
    window.addEventListener('openWalletConnect', handler);
    return () => window.removeEventListener('openWalletConnect', handler);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-primary">$drepscore</span>
        </Link>

        <nav className="flex items-center space-x-2 sm:space-x-4">
          <Link href="/proposals" className={navLinkClass('/proposals')}>
            <ScrollText className="h-4 w-4" />
            <span>Proposals</span>
          </Link>
          <Link href="/methodology" className={navLinkClass('/methodology')}>
            <BookOpen className="h-4 w-4" />
            <span>Methodology</span>
          </Link>
          {isAuthenticated && (
            <Link href="/governance" className={navLinkClass('/governance')}>
              <Vote className="h-4 w-4" />
              <span>My Governance</span>
            </Link>
          )}
          {(ownDRepId || isAdmin) && (
            <Link href="/dashboard" className={navLinkClass('/dashboard')}>
              <Sparkles className="h-4 w-4" />
              <span>DRep Dashboard</span>
            </Link>
          )}
          {ownDRepId && (
            <Link href="/dashboard/inbox" className={navLinkClass('/dashboard/inbox')}>
              <Inbox className="h-4 w-4" />
              <span>Inbox</span>
              {inboxCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums">
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
            </Link>
          )}
          
          {isAuthenticated && sessionAddress ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative hover:text-primary hover:bg-primary/10">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Alerts</span>
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {alerts.length === 0 ? (
                    <DropdownMenuItem className="flex items-center gap-3 p-3 cursor-default text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <span className="text-sm">No alerts right now</span>
                    </DropdownMenuItem>
                  ) : (
                    alerts.map((alert) => {
                      const IconComponent = ALERT_ICONS[alert.type] || Info;
                      const colorClass = ALERT_COLORS[alert.type] || 'text-muted-foreground';

                      return (
                        <div
                          key={alert.id}
                          className="relative group"
                        >
                          <DropdownMenuItem
                            className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted pr-8"
                            asChild
                          >
                            <Link href={alert.link || '#'}>
                              <IconComponent className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
                              <div className="space-y-1 flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{alert.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {alert.description}
                                </p>
                              </div>
                            </Link>
                          </DropdownMenuItem>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                            className="absolute top-3 right-2 p-0.5 rounded hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Dismiss alert"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 hover:text-primary hover:bg-primary/10 hover:border-primary/40">
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-600 px-1.5 py-0">
                      <Shield className="h-3 w-3" />
                    </Badge>
                    <span className={`hidden sm:inline text-xs ${displayName ? '' : 'font-mono'}`}>
                      {displayName || shortenAddress(sessionAddress)}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Shield className="h-3 w-3 text-green-600" />
                        {displayName || 'Governance Guardian'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {shortenAddress(sessionAddress)}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/governance" className="cursor-pointer">
                      <Vote className="h-4 w-4 mr-2" />
                      My Governance
                    </Link>
                  </DropdownMenuItem>
                  {(ownDRepId || isAdmin) && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="cursor-pointer">
                          <Sparkles className="h-4 w-4 mr-2" />
                          DRep Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/inbox" className="cursor-pointer">
                          <Inbox className="h-4 w-4 mr-2" />
                          Governance Inbox
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin/integrity" className="cursor-pointer">
                          <Activity className="h-4 w-4 mr-2" />
                          Data Integrity
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setWalletModalOpen(true)}
              className="gap-2"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Connect Wallet</span>
            </Button>
          )}

          <ModeToggle />
        </nav>
      </div>

      <WalletConnectModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
      />
    </header>
  );
}
