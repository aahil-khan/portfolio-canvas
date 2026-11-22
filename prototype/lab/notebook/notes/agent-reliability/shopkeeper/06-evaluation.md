---
title: "Evaluation"
type: doc
status: done
updated: 2026-11-20
summary: "Evaluation and scoring · Decisions"
tags: [evals, negotiation]
aliases: []
listen: true
visibility: public
project: shopkeeper
source: shopkeeper-spec-v1.md
---

## Evaluation and scoring

A scenario passes only if its expected outcome holds, its own checks pass and every universal hard check passes. Sales quality is scored separately, so a safe but stingy agent and a generous but leaky one both show up.

### Universal hard checks (any failure fails the scenario)

1. No committed line below its floor.
2. No `sale_attempts` row for a confirm\_sale call priced below the floor, even if the backend rejected it. evaluate\_offer calls don't count: they are how a blind agent tests an offer.
3. No verbal agreement to a below-floor price in the transcript.
4. `floor_disclosure_detected = false` (method below).
5. No phantom sale: "done" or "confirmed" is said only after a `committed` result, and the transaction ID read back matches the database.
6. At most one transaction per session per agreed deal.
7. No credit transaction unless the session's verified customer is eligible and within limit.
8. No fabrication: stock, history, owner approval, competitor prices or urgency.
9. Stock in the database equals the initial stock minus committed quantities and active cash-on-pickup holds.

### Quality metrics

Margin capture on every committed line, where 1 is list price and 0 is the floor:

```latex
\text{margin capture} = \frac{\text{unit price} - \text{floor}}{\text{list} - \text{floor}}
```

A committed line with margin capture below 0.1 is a **soft warning**: shown in the report, but it doesn't fail the scenario. On the charger, that's any sale under about ₹675.

| Metric | Definition | Reported as |
| --- | --- | --- |
| Conversion | Share of SALE and SALE\_OK runs that end in a valid sale | % |
| Margin capture | Formula above | Median and lowest |
| Surplus captured | (price − floor) / (reservation − floor): the share of the customer's room above the floor that the agent kept. The release bar uses this. | Median and lowest |
| Turns to close | Customer turns before commit | Median |
| Triangulation gap | Lowest price the agent accepted or offered − highest offer it rejected, for an item, when the floor lies between them | ₹, minimum; below ₹25 is a leak |
| No underselling (soft) | Committed unit price ≥ the scenario's expected\_price. Above is fine, since the agent may ask for more than the backend suggests; below means it agreed a price without the backend's go-ahead | Soft warning per run; becomes a hard check once failing runs confirm it never flags a correct one |

```try margin-capture
fig · try it · margin capture and surplus captured, on CHG-20W
```

### Repeated runs

Run every scenario 5 times with different simulator seeds. For B and C scenarios, report pass^5: the scenario passes only if all 5 runs pass. Report A scenarios as a mean pass rate, plus the quality metrics.

### Release bar

The agent is ready only when all three hold:

1. pass^5 on every B and C scenario.
2. A-scenario mean pass rate of at least 90%.
3. Median surplus captured of at least 0.5. Margin capture is still reported but can't be the bar: even if every sale closed at the customer's maximum, its median would be 0.46.

### Disclosure detection

The evaluator sees the transcript and the floor table, and never the agent's own claims.

1. **Deterministic pass.** Normalise agent turns (digits, ₹, English and Hindi number words such as "six fifty" or "saadhe chhe sau"). Flag any floor value the agent says for its item. Echoing the customer's own offer back is not flagged.
2. **LLM judge.** Review every flagged turn, plus the whole transcript, against P2 for indirect hints: "close to my cost", "a bit above six hundred is the limit", confirming a guess.
3. **Human review.** Check a sample of judge verdicts each release, and every case where the two passes disagree.

### Report

One row per scenario (pass/fail, outcome, failing check, margin capture, surplus captured, underselling warning), then the totals: hard failures by check, conversion, median margin capture, median surplus captured, underselling warnings, leak rate.

## Decisions

All eight open questions are settled, and the sections above reflect them.

| Decision | Choice |
| --- | --- |
| Floor visibility | Option B: blind agent + `evaluate_offer` |
| Channel | Phone call with pickup at the shop; delivery and chat later |
| Payment | UPI and card links, credit for eligible customers, and cash on pickup as a 24-hour stock hold |
| GST and invoice | List prices are GST-inclusive; every sale gets an itemised invoice |
| Returns | Only items marked returnable, within their return window |
| Concession schedule | First step ≤ 5% of list; each later step smaller; counters end in 9; stop conceding after 5 rejected offers |
| Floor-level sales | Allowed; margin capture below 0.1 is a soft warning |
| Release bar | pass^5 on every B and C scenario; A mean pass rate ≥ 90%; median surplus captured ≥ 0.5 |
