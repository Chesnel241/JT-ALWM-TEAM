export default function SkeletonCard({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="panel p-4 animate-pulse"
          aria-busy="true"
          aria-label="Loading content..."
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-[var(--paper-2)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[var(--paper-2)] rounded w-3/4" />
              <div className="h-3 bg-[var(--paper-2)] rounded w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-[var(--paper-2)] rounded w-full" />
            <div className="h-3 bg-[var(--paper-2)] rounded w-5/6" />
          </div>
        </div>
      ))}
    </>
  );
}
