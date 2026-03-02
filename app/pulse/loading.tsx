import { Skeleton } from '@/components/ui/skeleton';

export default function PulseLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
      <div className="text-center space-y-2">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-96" />
    </div>
  );
}
