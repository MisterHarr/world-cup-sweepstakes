export default function TournamentRunbookPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              Tournament Runbook (Cost-Safe)
            </h1>
            <a
              href="/admin"
              className="text-xs uppercase tracking-widest text-slate-400 hover:text-emerald-200"
            >
              Back to Tools
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-300">
            Use this page to run live score operations safely and keep costs
            controlled.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold">1) Cost Guardrail</h2>
          <p className="text-sm text-slate-300">
            Keep <strong>Live Automation (Scheduler)</strong> in{" "}
            <strong>DISABLED</strong> mode outside tournament live windows.
            Default provider should be <strong>Fixture (safe testing)</strong>{" "}
            or <strong>Stub</strong>.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold">2) Pre-Tournament Check</h2>
          <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
            <li>Open <code>/admin/fixtures</code> and verify Admin = Yes.</li>
            <li>Set deterministic test baseline via Reset + Ingest.</li>
            <li>Confirm Leaderboard and Match Center Results render correctly.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold">3) Go Live</h2>
          <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
            <li>Set provider to <strong>Provider (production)</strong>.</li>
            <li>Enable scheduled ingest.</li>
            <li>Click <strong>Save Automation Settings</strong>.</li>
            <li>Confirm success message and updated timestamp.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold">4) Fallback During Tournament</h2>
          <p className="text-sm text-slate-300">
            If automation fails, disable it and run manual admin actions:
            Fixture Ingest / Recompute Leaderboard. Validate Board + Live after
            each operation.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold">5) Post-Tournament Shutdown</h2>
          <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
            <li>Set automation to <strong>DISABLED</strong>.</li>
            <li>Save settings and confirm audit timestamp/by user.</li>
            <li>Record final leaderboard update timestamp.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold">Source</h2>
          <p className="text-sm text-slate-300">
            Full version: <code>docs/TOURNAMENT-RUNBOOK.md</code>
          </p>
        </section>
      </div>
    </div>
  );
}

