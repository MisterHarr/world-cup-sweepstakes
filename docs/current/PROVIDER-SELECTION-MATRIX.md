# Provider Selection Matrix

Last updated: 2026-05-21

## Purpose

This document turns Sprint 7 into an evidence-based provider selection pass.
The winner is considered final only after contract testing and shadow rehearsal are complete.

## Current local reality

- Current implemented real-provider adapters: `football-data.org`, `Sportmonks (trial)`
- Current provider fetch path: [`functions/src/ingest.ts`](/Users/harrison.j/world-cup-sweepstakes-clean/functions/src/ingest.ts)
- Current normalized provider labels for live adapters: `football-data`, `sportmonks`
- Current shadow/replay infrastructure: ready
- Current second real-provider adapter: not implemented yet
- Latest real proof: `football-data.org` shadow contract test passed locally on 2026-05-15 using the free-tier token path
- Latest browser/admin rehearsal: `football-data.org` passed the live `/admin/fixtures` shadow contract test on 2026-05-15 with 72 mapped matches and 0 quarantined

## Evidence matrix

| Criterion | Weight | Sportmonks | API-Football | football-data.org |
|---|---:|---|---|---|
| World Cup 2026 fixture availability | 5 | Strong evidence. Official World Cup 2026 guide and coverage pages explicitly market tournament coverage. | Medium evidence. Broad competition coverage and detailed coverage table are present, but this pass did not capture a World Cup 2026-specific contract page as explicit as Sportmonks. | Medium evidence. Coverage page includes `Worldcup` and WC qualifiers, but current live World Cup 2026 specificity is less explicit. |
| Live score support | 5 | Strong. Official livescore endpoints and World Cup 2026 live docs exist. | Strong. Official site says livescores update every 15 seconds. | Strong enough for baseline. Paid live-score tiers exist. |
| Events/cards support | 5 | Strong. Official docs list events/timeline/statistics includes. | Strong. Pricing/feature pages include events and lineups. | Strong on paid tiers. Pricing/docs show bookings/cards, line-ups, scorers, squads. |
| Team ID mapping clarity | 5 | Medium. Rich entity model, but adapter not yet implemented locally. | Medium. Coverage and fixtures are broad, but adapter not yet implemented locally. | Medium-high. Adapter already exists locally using current mapping flow, but World Cup-specific contract still needs proving. |
| Rate limits | 4 | Strong. Public plan limits are stated per hour/entity. | Strong. Public plan limits are stated per day and per minute. | Medium. Public per-minute limits are clear, but lower than the other two on cheaper tiers. |
| Cost | 4 | Medium. More expensive for World Cup-specialized coverage. | Strong. Lowest public entry price among the three candidates. | Medium. Mid-range depending on tier and add-ons. |
| API stability / operational confidence | 4 | Medium-high. Explicit World Cup 2026 product focus is a positive signal, but local adapter work is still pending. | Medium. Mature commercial API, but still needs local contract proof. | Medium-high for current codebase only because the adapter already exists and compiles. |
| Documentation quality | 3 | Strong. Detailed endpoint docs and World Cup-specific guides. | Medium-high. Coverage, pricing, and onboarding are clear. | Medium-high. API reference is concrete and field-level, but older documentation surfaces remain visible. |
| Support responsiveness | 3 | Medium-high. Official FAQ claims 7-day human support. | Medium. Public site points to dashboard chat support. | Medium. Direct contact model; less operational tooling is visible on the public site. |
| Correction / duplicate handling readiness | 5 | Unknown until contract test. | Unknown until contract test. | Medium. Local adapter already flows through our validation/quarantine/idempotency path, but real correction behavior still must be proven. |

## Selected provider

### Selected provider: football-data.org

Why:

- It is already implemented locally and working in this codebase.
- It avoids a large new subscription decision while the product is still free and personally funded.
- It is the cheapest path to continued real-provider mechanics testing inside the current app.
- It has now passed a real local shadow contract test in this repo.
- It has now passed the live admin `/admin/fixtures` shadow rehearsal with 72 mapped matches and 0 quarantined updates.

Remaining caveats:

- World Cup 2026 specificity is weaker than Sportmonks on current public evidence.
- Its limits and coverage may still be insufficient for launch-scale expectations.
- Contract-test observability was fixed after the first proof; admin health panels now reflect provider shadow contract-test runs.

### Budget-conscious backup candidate: API-Football

Why:

- Broad competition coverage.
- Competitive pricing and generous daily/minute limits.
- Live/events/lineups support is clearly marketed.

Why not selected yet:

- No local adapter exists yet.
- This pass did not verify a World Cup 2026-specific official contract page with the same confidence level as Sportmonks.
- No local contract/shadow proof yet.

### Coverage-first but currently impractical candidate: Sportmonks

Why:

- It still appears strongest on paper for World Cup-specific coverage and match/event depth.
- The trial adapter is now wired into this repo.

Why not practical as primary right now:

- The current World Cup API pricing is too expensive for a personally funded free tool.
- The relevant World Cup product is not realistically trial-friendly for this project budget.
- A technically strong provider is still the wrong choice if it breaks the operating budget.

## Local implementation readiness

| Provider | Local adapter status | Notes |
|---|---|---|
| Sportmonks | Trial adapter implemented | Wired into live-ops settings and normalized ingest path; still needs real token contract test and shadow rehearsal evidence. |
| API-Football | Not started | Requires new provider adapter, team-ID mapping, and contract test fixture capture. |
| football-data.org | Implemented and selected | Passed local demo-project shadow contract test on 2026-05-15: preview `24`, updated `24`, quarantined `0`, no public collection pollution. Passed live `/admin/fixtures` shadow contract test on 2026-05-15: mapped `72`, updated `72`, quarantined `0`. |

## Latest football-data.org proof result

Run date: 2026-05-15

Execution path:

- Emulator project: `demo-football-data-proof`
- Script: [`scripts/test-football-data-shadow-proof.ts`](/Users/harrison.j/world-cup-sweepstakes-clean/scripts/test-football-data-shadow-proof.ts)
- Provider: `football-data.org`
- Mode: `shadow`

Observed result:

- Preview mapped matches: `24`
- Shadow matches written: `24`
- Quarantined updates: `0`
- Public `matches`: `0`
- Public `leaderboard/current`: untouched
- `shadowLeaderboard/current`: created and updated successfully

Interpretation:

- The free-tier `football-data.org` token is sufficient for at least the current baseline contract proof path in this codebase.
- Team-ID mapping worked cleanly for this proof sample.
- The provider is now beyond “theoretical candidate” status and has real shadow evidence in this repo.
- Final provider selection should still wait for a fuller operator rehearsal and any live-window checks we want before go-live.

## Normal local project rehearsal result

Run date: 2026-05-15

Execution path:

- Emulator project: `worldcup-sweepstake-2026`
- Script: [`scripts/rehearse-football-data-local.ts`](/Users/harrison.j/world-cup-sweepstakes-clean/scripts/rehearse-football-data-local.ts)
- Provider: `football-data.org`
- Mode: `shadow`

Observed result:

- Local emulator state before run was empty (`users: 0`, `teams: 0`, `matches: 0`)
- Script seeded the 2026 teams because `teams` was empty
- Preview mapped matches: `24`
- Shadow matches written: `24`
- Quarantined updates: `0`
- Public `matches`: `0`
- `shadowLeaderboard/current`: created successfully

Interpretation:

- The normal local project wiring is working on the expected emulator ports.
- Keeping existing local data would have been safe, but in this run there was no existing local emulator data to preserve.
- A true browser-level operator rehearsal with a signed-in admin is still a distinct final check if we want to validate the UI flow end to end.

## Browser/admin rehearsal result

Run date: 2026-05-15

Execution path:

- Environment: local app on `http://localhost:3001/admin/fixtures`
- Emulator project: `worldcup-sweepstake-2026`
- Provider: `football-data.org`
- Mode: `shadow`

Observed result:

- Live automation settings saved as `shadow` + `football-data.org`
- Contract test result: `mapped 72`, `updated 72`, `quarantined 0`
- `shadowMatches` count on the admin page updated to `72`
- `shadowLeaderboard/current` updated with:
  - `sourceCollection: shadowMatches`
  - `target: shadow`
  - `rowCount: 1`
  - no last-error value
- Public leaderboard remained empty in this emulator session, which is acceptable for this rehearsal

Interpretation:

- `football-data.org` has now passed the real browser/admin shadow rehearsal, not just script-driven proof.
- That is sufficient to promote it from practical candidate to selected provider for this repo.
- The original observability gap was closed after this rehearsal; health panels now reflect contract-test ingest and recompute status.

## Selection rule for this repo

The selected provider should continue to satisfy all of the following inside this codebase:

1. Fixture fetch works against a real token.
2. Live/current endpoint returns usable match states.
3. Team IDs map cleanly into our `teams` collection.
4. Unknown or unmapped IDs are quarantined, not written.
5. Correction/duplicate behavior is observed and handled correctly.
6. Shadow ingest succeeds repeatedly without polluting public collections.
7. Full operator rehearsal succeeds using the chosen provider.

## Immediate next implementation path

1. Treat `football-data.org` as the selected provider.
2. Keep the Sportmonks adapter as a non-default trial path, not the assumed launch provider.
3. Evaluate `API-Football` next only if `football-data.org` later proves insufficient on real cost-to-coverage grounds.
4. Use the local visible fabricated-live simulator for UI-visible launch rehearsal before production shadow sign-off.

## Sources checked on 2026-05-14

- Sportmonks pricing: https://www.sportmonks.com/football-api/plans-pricing/
- Sportmonks live score docs: https://docs.sportmonks.com/football/endpoints-and-entities/endpoints/livescores
- Sportmonks World Cup 2026 live docs: https://docs.sportmonks.com/v3/world-cup-2026/live-matches-livescores-and-events
- Sportmonks World Cup 2026 guide: https://www.sportmonks.com/blogs/world-cup-2026-api-guide-coverage-endpoints-data-types/
- Sportmonks coverage: https://www.sportmonks.com/football-api/coverage/
- API-Football homepage/features: https://www.api-football.com/?language=en
- API-Football coverage: https://www.api-football.com/coverage
- API-Football pricing: https://www.api-football.com/pricing
- API-Sports football plan details: https://api-sports.io/sports/football
- football-data.org pricing: https://www.football-data.org/pricing
- football-data.org coverage: https://www.football-data.org/coverage
- football-data.org API reference: https://www.football-data.org/documentation/api
- football-data.org v4 match docs: https://docs.football-data.org/general/v4/match.html
