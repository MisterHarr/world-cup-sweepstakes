/**
 * Dashboard loading skeleton
 * Shown while dashboard page is loading
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="mx-auto max-w-7xl">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-10 w-32 animate-pulse rounded bg-slate-800" />
        </div>

        {/* Tabs skeleton */}
        <div className="mb-6 flex gap-2">
          <div className="h-10 w-32 animate-pulse rounded bg-slate-800" />
          <div className="h-10 w-32 animate-pulse rounded bg-slate-800" />
          <div className="h-10 w-32 animate-pulse rounded bg-slate-800" />
        </div>

        {/* Podium skeleton */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg bg-slate-800"
            />
          ))}
        </div>

        {/* Leaderboard skeleton */}
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex h-16 animate-pulse items-center gap-4 rounded-lg bg-slate-800 px-4"
            >
              <div className="h-8 w-8 rounded-full bg-slate-700" />
              <div className="h-4 flex-1 rounded bg-slate-700" />
              <div className="h-4 w-16 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
