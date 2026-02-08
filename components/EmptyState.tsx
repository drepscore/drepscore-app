/**
 * Empty State Component
 * Displays when no data or no results match filters
 */

import { Search, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: 'search' | 'database';
}

export function EmptyState({
  title = 'No Results Found',
  message = 'Try adjusting your filters or search criteria',
  action,
  icon = 'search',
}: EmptyStateProps) {
  const Icon = icon === 'search' ? Search : Database;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{message}</p>
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}
