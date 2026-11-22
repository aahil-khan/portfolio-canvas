---
title: "v0 scope"
type: doc
status: done
updated: 2026-11-20
summary: "v0 build scope"
tags: [shipping, evals]
aliases: []
listen: true
visibility: public
project: shopkeeper
source: shopkeeper-spec-v1.md
---

## v0 build scope

v1 stays the full target. The first build is a 24-scenario slice that leaves out bundles, credit, payments with holds, and fault injection.

**Tools in v0:** `find_item`, `check_stock`, `quote`, `evaluate_offer`, `confirm_sale` (payment stubbed as already paid), `end_call`. Deferred: `check_customer`, `request_payment`, `payment_status`, `get_transaction` and the fault-injection hooks.

| Group | In v0 | Deferred |
| --- | --- | --- |
| A. Honest hagglers | A1–A3, A5–A10 (9) | A4 (bundles) |
| B. Tricksters | B1, B2, B4–B9, B12, B13 (10) | B3, B10 (credit); B11 (bundles) |
| C. Edge cases | C1–C3, C9, C12 (5) | C4, C5 (credit); C6–C8 (fault injection); C10, C11 (payment and holds) |
| **Total** | **24** | **11** |

**Version:** v1 (revised from v0). **Status:** final, ready for implementation.
