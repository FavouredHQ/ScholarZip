import { Skeleton } from "@/components/ui/skeleton";

const ScholarshipSkeleton = () => (
  <div className="rounded-[1.5rem] bg-card border border-border overflow-hidden shadow-card">
    <Skeleton className="aspect-[4/3] rounded-none" />
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

const ScholarshipSkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {Array.from({ length: 8 }).map((_, i) => (
      <ScholarshipSkeleton key={i} />
    ))}
  </div>
);

export { ScholarshipSkeleton, ScholarshipSkeletonGrid };
