/**
 * Admin loading skeleton
 * Shown while admin pages are loading
 */
export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="mb-2 h-8 w-64 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-800" />
        </div>

        {/* Cards skeleton */}
        <div className="grid gap-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg bg-slate-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
