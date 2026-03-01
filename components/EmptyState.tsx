import { type LucideIcon, Search, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { posthog } from '@/lib/posthog';

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: EmptyStateAction;
  icon?: LucideIcon | 'search' | 'database';
  compact?: boolean;
  component?: string;
}

export function EmptyState({
  title = 'No Results Found',
  message = 'Try adjusting your filters or search criteria',
  action,
  icon = Search,
  compact = false,
  component,
}: EmptyStateProps) {
  const Icon = icon === 'search' ? Search : icon === 'database' ? Database : icon;

  const handleCtaClick = () => {
    if (component) {
      posthog.capture('empty_state_cta_clicked', {
        component,
        cta_action: action?.href || action?.label,
      });
    }
    action?.onClick?.();
  };

  const ctaButton = action ? (
    action.href ? (
      <Link href={action.href} onClick={handleCtaClick}>
        <Button variant="outline" size={compact ? 'sm' : 'default'}>
          {action.label}
        </Button>
      </Link>
    ) : (
      <Button variant="outline" size={compact ? 'sm' : 'default'} onClick={handleCtaClick}>
        {action.label}
      </Button>
    )
  ) : null;

  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
        <Icon className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium mb-1">{title}</p>
        <p className="text-xs text-muted-foreground max-w-sm mb-3">{message}</p>
        {ctaButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{message}</p>
      {ctaButton}
    </div>
  );
}
