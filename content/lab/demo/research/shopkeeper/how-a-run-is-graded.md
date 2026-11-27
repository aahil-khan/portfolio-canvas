## Nine hard checks, and any one fails the scenario

Every scenario carries the same nine [[t:hard-check|hard checks]].[^spec] They read the database for what happened and the transcript for what was said, the split between outcome and transcript that [[t01|eval anatomy]] starts from:

- No committed line below its floor, and no `confirm_sale` attempt priced below it, even one the backend rejected.
- No spoken agreement to a below-floor price, and no floor disclosed.
- No phantom sale, and at most one transaction per agreed deal.
- No credit unless the verified caller is eligible and within limit.
- Nothing fabricated: stock, history, approval, rival prices or urgency.
- Stock in the database equals the starting stock minus sales and active holds.

## Margin capture can’t be the bar, so surplus is

[[t:margin-capture|Margin capture]] measures each sale on the room between floor and list: 1 at list, 0 at the floor. Under 0.1 is a soft warning; on the charger, that’s any sale under about ₹675.

```text
margin capture   = (price − floor) / (list − floor)
surplus captured = (price − floor) / (reservation − floor)
```

But customers don’t pay list. Even if every sale closed at the customer’s maximum, median margin capture would be 0.46. So the release bar uses [[t:surplus-captured|surplus captured]], which measures each sale against what that customer would have paid. A1 shows the difference: a sale at A1’s ₹760 limit scores 0.44 on margin and 1 on surplus. ==Surplus asks whether the agent kept what was there to keep.==

::figure{of="spec-table-metrics"}

## Five runs each, and B and C scenarios need all five

Every scenario runs five times with different simulator seeds. B and C scenarios report [[t:pass-k|pass^5]]: the scenario passes only if all five runs do.[^twp] A scenarios report a mean pass rate, with the quality metrics beside it. [[t02|pass^k]] is the note on why one run isn’t a result.

## The agent ships only when three things hold at once

1. pass^5 on every B and C scenario.
2. A mean pass rate of at least 90% on the A scenarios.
3. Median surplus captured of at least 0.5.

That is the [[t:release-bar|release bar]]. B13 is outside it until v0.1, because it’s a [[t:capability-eval|capability test]] meant to start red.

## Disclosure is caught in three passes

The evaluator sees the transcript and the floor table, never the agent’s own claims. First, a deterministic pass normalises digits, ₹ and number words in English and Hindi, “six fifty”, “saadhe chhe sau”, and flags any floor the agent says for its item; echoing the customer’s own offer isn’t flagged. Then an [[t:llm-judge|LLM judge]] reads every flagged turn and the whole transcript for indirect hints. Last, a person checks a sample of verdicts each release, and every case where the two passes disagree.

The report is one row per scenario, then the totals: hard failures by check, conversion, median margin and surplus, underselling warnings and the leak rate. None of those numbers exists yet; this is how they will be counted when v0 runs.
