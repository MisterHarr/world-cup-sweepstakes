# Badge Feasibility Audit (2022 Data)

**Date:** 2026-02-22  
**Dataset Audited:** `/functions/src/fixtures/worldcup2022.json`  
**Current coverage:** 12 matches, `GROUP` stage only (`2022-11-20` to `2022-11-23`)

## Summary

- The previous badge catalog included multiple criteria that require data not currently tracked:
  - player-level awards (e.g., Golden Boot)
  - daily login streak telemetry
  - squad-view counts
  - full knockout progression fields
  - rank history by matchday
- Badge definitions have been adjusted in `/lib/badgeDefinitions.ts` so each badge criteria type maps to data already available in current user/team/transfer records.

## Badges Adjusted

| Badge ID | Previous Issue | Updated to Feasible Rule |
|---|---|---|
| `perf_weekly_winner` | Matchday rank history not stored | Total-score threshold (`minScore: 25`) |
| `perf_comeback` | Rank delta history not stored | Rank + score combo (`rankMax: 5`, `minScore: 45`) |
| `perf_consistent` | Rank consistency timeline unavailable | Top-10 with zero transfer penalties |
| `perf_perfect_week` | Matchday-perfect model unavailable | All six teams score at least 5 points |
| `port_tier_master` | Required tier 5 but current system tracks tiers 1-4 | Diversity requirement changed to tiers 1-4 |
| `port_underdog` | Tier 5 + rank-1 hard dependency | Majority tier 3-4 with top-10 finish |
| `pred_golden_boot` | Player-level award not ingested | Featured team points threshold |
| `pred_final_four` | Semi-final progression not available in current slice | Portfolio minimum points per team |
| `pred_dark_horse` | Tier 5 + final-stage dependency | Tier 3-4 featured points threshold |
| `pred_knockout_king` | Group advancement state not materialized | No team finishes negative |
| `pred_champions_pick` | Tournament winner dependency | Featured contribution share threshold |
| `pred_group_winner` | Group table position not computed | Featured team wins threshold |
| `engage_daily_visitor` | Login streak telemetry not stored | Conservative transfer-usage rule |
| `engage_social` | Squad view count telemetry not stored | Full-squad completion rule |
| `engage_squad_stalker` | Squad view count telemetry not stored | Exact-transfer-count rule |
| `fun_chaos_agent` | Live-transfer timing event not computed | Use-all-transfers + positive score rule |
| `fun_risk_taker` | Crucial-match timing signal not modeled | Tier-upgrade transfers + rank threshold |

## Remaining Hardening Note

- Feasibility is now aligned to available data fields, but automatic badge awarding still requires the planned badge engine implementation (`trigger + evaluate + award + audit log`).

