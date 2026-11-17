# Momentum-weighted implied-value radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/San7674/token-radar-2/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/San7674/token-radar-2/reward.svg)](https://make.fun/bounty/token-radar-01)

Ranks every pre-token protocol in the sealed DefiLlama snapshot by what its token would be worth if it launched today, for the [make.fun bounty](https://make.fun/bounty/token-radar-01).

## Model

**Implied value = TVL × M × G × A × C**, all four from the snapshot's own figures:

- **M — peer multiple:** one market multiple for the whole board, the median mcap/TVL across the snapshot's own tokenized peers, derived from the data at run time.
- **G — growth:** 1 + the 7-day TVL change, clamped to −50%…+150%.
- **A — age premium:** 1 + 0.12 per year the protocol has run with no token, capped at 4 years.
- **C — chain breadth:** 1 + 0.06 per extra chain, capped at 10.

No protocol name is ever special-cased. The board covers the snapshot's whole watchlist plus every other rankable pre-token protocol below the floor.

## What the snapshot does not carry

The sealed snapshot holds ten fields per protocol and **no fees, no revenue, no volume and no user counts**. A revenue-multiple model is impossible from this snapshot, so this radar does not claim one — it uses TVL, 7-day growth, age and chain breadth, and says so in the dashboard.

## Run

Node 22, standard library only:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into `out/`.
