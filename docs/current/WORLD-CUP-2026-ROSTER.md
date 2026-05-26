# World Cup 2026 — frozen roster (target state)

**Freeze date:** 2026-05-02  
**Purpose:** Single reference for `lib/seed/teamsSeed.ts` updates (`TEAMS-ROSTER-UPDATE-SPRINT.md`).

## Sources (reconcile if they disagree)

- [FIFA — World Cup 2026](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026) — qualified teams and competition info.
- Draw / group reporting after **March 2026** inter-confederation and UEFA playoffs (e.g. press summaries listing all 48 nations by group).

**Rule:** If FIFA’s official published list differs from this table, **edit this file first**, then align `TEAMS_SEED` in Sprint 2.

## Conventions

- **`id`:** Three-letter codes aligned with **`TEAMS_SEED`** / FIFA-style usage (e.g. `COD` = DR Congo, `TUR` = Türkiye, `CZE` = Czechia, `BIH` = Bosnia and Herzegovina).
- **Order:** Rows are **draw order within the group** as commonly reported (verify against FIFA draw PDF or official group pages).

## Full roster — 48 teams

| `id` | Team | Group | Slot |
|------|------|-------|------|
| MEX | Mexico | A | 1 |
| ZAF | South Africa | A | 2 |
| KOR | South Korea | A | 3 |
| CZE | Czechia | A | 4 |
| CAN | Canada | B | 1 |
| BIH | Bosnia and Herzegovina | B | 2 |
| QAT | Qatar | B | 3 |
| SUI | Switzerland | B | 4 |
| BRA | Brazil | C | 1 |
| MAR | Morocco | C | 2 |
| HTI | Haiti | C | 3 |
| SCO | Scotland | C | 4 |
| USA | USA | D | 1 |
| PRY | Paraguay | D | 2 |
| AUS | Australia | D | 3 |
| TUR | Türkiye | D | 4 |
| GER | Germany | E | 1 |
| CUW | Curaçao | E | 2 |
| CIV | Côte d'Ivoire | E | 3 |
| ECU | Ecuador | E | 4 |
| NED | Netherlands | F | 1 |
| JPN | Japan | F | 2 |
| SWE | Sweden | F | 3 |
| TUN | Tunisia | F | 4 |
| BEL | Belgium | G | 1 |
| EGY | Egypt | G | 2 |
| IRN | IR Iran | G | 3 |
| NZL | New Zealand | G | 4 |
| ESP | Spain | H | 1 |
| CPV | Cabo Verde | H | 2 |
| KSA | Saudi Arabia | H | 3 |
| URU | Uruguay | H | 4 |
| FRA | France | I | 1 |
| SEN | Senegal | I | 2 |
| IRQ | Iraq | I | 3 |
| NOR | Norway | I | 4 |
| ARG | Argentina | J | 1 |
| DZA | Algeria | J | 2 |
| AUT | Austria | J | 3 |
| JOR | Jordan | J | 4 |
| POR | Portugal | K | 1 |
| COD | DR Congo | K | 2 |
| UZB | Uzbekistan | K | 3 |
| COL | Colombia | K | 4 |
| ENG | England | L | 1 |
| HRV | Croatia | L | 2 |
| GHA | Ghana | L | 3 |
| PAN | Panama | L | 4 |

## `teamsSeed.ts` status

Sprint 2 complete: **`lib/seed/teamsSeed.ts`** matches this table (including draw order and `tier` = roster slot 1–4). Retired placeholder ids: `PO_UE_D`, `PO_UE_A`, `PO_UE_C`, `PO_UE_B`, `PO_FIFA_2`, `PO_FIFA_1` — remove any leftover Firestore `teams/{id}` docs when you re-seed (Sprint 3).
