import { Skeleton } from '@/components/ui/skeleton';

export default function DRepProfileLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
      </div>

      {/* Score card */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
