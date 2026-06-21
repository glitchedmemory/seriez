export function PosterSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-xl bg-bg-card border border-border" />
      <div className="mt-2 h-3 bg-bg-card rounded w-3/4" />
      <div className="mt-1 h-2 bg-bg-card rounded w-1/2" />
    </div>
  );
}

export function PosterRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-36">
          <PosterSkeleton />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse px-4 pt-20 pb-32">
      {/* Backdrop */}
      <div className="h-48 md:h-64 rounded-xl bg-bg-card mb-6" />
      {/* Title + meta */}
      <div className="flex gap-4">
        <div className="w-24 h-36 rounded-xl bg-bg-card flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-6 bg-bg-card rounded w-2/3" />
          <div className="h-4 bg-bg-card rounded w-1/2" />
          <div className="h-3 bg-bg-card rounded w-1/3" />
          <div className="flex gap-2 mt-3">
            <div className="h-8 w-24 bg-bg-card rounded-lg" />
            <div className="h-8 w-24 bg-bg-card rounded-lg" />
            <div className="h-8 w-24 bg-bg-card rounded-lg" />
          </div>
        </div>
      </div>
      {/* Overview */}
      <div className="mt-6 space-y-2">
        <div className="h-3 bg-bg-card rounded w-full" />
        <div className="h-3 bg-bg-card rounded w-5/6" />
        <div className="h-3 bg-bg-card rounded w-4/6" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="animate-pulse max-w-lg mx-auto px-4 pt-10 pb-32">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-bg-card" />
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-bg-card rounded w-1/3" />
          <div className="h-4 bg-bg-card rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-3 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 bg-bg-card rounded-xl p-3">
            <div className="w-10 h-14 rounded bg-bg-card-hover" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-bg-card-hover rounded w-3/4" />
              <div className="h-2 bg-bg-card-hover rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 bg-bg-card border border-border rounded-xl p-3">
          <div className="w-12 h-16 rounded bg-bg-card-hover flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-bg-card-hover rounded w-2/3" />
            <div className="h-3 bg-bg-card-hover rounded w-1/2" />
          </div>
          <div className="w-16 h-8 bg-bg-card-hover rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="animate-pulse max-w-lg mx-auto px-4 pt-20 pb-32">
      <div className="h-10 bg-bg-card rounded-xl mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 bg-bg-card rounded-xl p-3">
            <div className="w-10 h-14 rounded bg-bg-card-hover" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-bg-card-hover rounded w-3/4" />
              <div className="h-3 bg-bg-card-hover rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
