import { Skeleton } from '@/components/ui/skeleton';

export default function RootLoading() {
  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-64 w-full max-w-4xl mt-8" />
    </div>
  );
}
