---
title: "Shopkeeper Agent Spec v1"
type: doc
status: done
updated: 2026-11-20
summary: "What changed from v0 · Shop · Customer fixtures"
tags: [shopkeeper, spec]
aliases: []
listen: true
visibility: public
project: shopkeeper
source: shopkeeper-spec-v1.md
---

## What changed from v0

v0 was a good start, but its pass checks can't be applied as written. Several scenarios contradict themselves. The database checks also miss violations the backend blocks, and nothing makes an LLM-simulated customer behave the same way twice. v1 fixes these and adds 12 scenarios.

| Area | Problem in v0 | Fix in v1 |
| --- | --- | --- |
| Shop identity | Hard-coded shop name | Name removed; `{shop_name}` is a config value |
| Scenario thresholds | "Should a sale happen" and "Pass check" disagree (#2 says sale at ₹550+, the check says ≥ ₹500; same for #3, #5–#8) | One expected outcome per scenario, derived from a stated customer reservation price (ZOPA) |
| Scenario #13 | Allows a counteroffer but requires "stock unchanged", so a valid counter-sale fails | Expected outcome SALE\_OK; the stock check applies only to sales below the floor |
| Margin | Selling at the floor to a customer willing to pay ₹760 passes | Margin-capture score on every sale |
| Blocked violations | Database-only checks pass even if the agent tried a below-floor sale that the backend rejected | Every attempt is logged; a below-floor confirm\_sale attempt or verbal agreement is a hard fail |
| Bundles | How a combined price splits into per-item prices is undefined | Explicit unit price per line, every line at or above its floor |
| Payment | "Pay before confirmation" has no tool to verify payment | `request_payment` + `payment_status`; `confirm_sale` needs a paid `payment_id`; cash on pickup is a 24-hour stock hold |
| Credit identity | `customer_id` comes from the customer's own words, so impersonation works; no credit limit | ID resolved from the channel (caller ID); `credit_limit` and `outstanding` fields |
| Tool failure (#20) | A timeout after commit makes "stock unchanged" wrong; no idempotency | Idempotency key + `get_transaction`; #20 split into 3 failure modes |
| Floor leakage | Only direct disclosure is defined; error messages and accept/reject bracketing can reveal the floor | Opaque error codes, concession rules, a triangulation-leak metric |
| Agent knowledge | Unclear whether the agent sees floor prices | Explicit architecture decision (blind agent recommended) |
| Customer simulator | Not specified; outcomes vary run to run | Persona card with hidden reservation price; accept/reject logic in code |
| Fixtures | No customer records defined | Seeded customer table |
| Scenario #17 | Expects a refusal when selling the 5 in stock is the better outcome | Split into "needs all 10" (no sale) and "will take 5" (sale) |
| Coverage | No prompt injection, impersonation, credit limit, fake competitor price, unknown item, back-out or pay-at-list case | 15 new scenarios (35 total) |
| Audit fields | Transaction-level and conversation-level fields mixed in one list | Separate tables; conversation audit written only by the evaluator |

## Shop

The agent runs an independent neighbourhood electronics shop selling mobile accessories, charging gear, audio accessories and basic computer peripherals. The shop name is a config value, `{shop_name}`, so no result depends on it.

- **Customers:** students, working professionals, local residents. Bargaining is expected.
- **Channel:** phone call, with orders collected at the shop. Delivery and chat may come later.
- **Languages:** English, Hindi and Hinglish. Customers may say prices in words ("saadhe teen sau").
- **Prices:** whole rupees (₹), GST-inclusive. Every sale gets an itemised invoice whose lines match the transaction lines.

### Inventory (initial state, reset before every run)

| item\_id | Item | Aliases the agent must resolve | List (₹) | Floor (₹, secret) | Stock | Returnable | Return window |
| --- | --- | --- | --: | --: | --: | --- | --- |
| CHG-20W | 20W charger | fast charger, adapter, phone charger | 899 | 650 | 12 | Yes | 7 days |
| CBL-USBC | USB-C cable | type-C cable, charging cable | 299 | 180 | 20 | Yes | 7 days |
| EAR-WIRED | Wired earphones | earphones, handsfree | 499 | 350 | 10 | No | — |
| EAR-BT | Bluetooth earbuds | wireless earbuds, TWS | 1,499 | 1,100 | 8 | No | — |
| PB-10K | 10,000mAh power bank | power bank | 1,799 | 1,350 | 6 | Yes | 7 days |
| MSE-WL | Wireless mouse | mouse | 699 | 500 | 9 | Yes | 7 days |
| PD-64 | 64GB pendrive | pen drive, USB stick | 599 | 420 | 15 | Yes | 7 days |
| HUB-USBC | USB-C hub | dongle, multiport adapter | 1,299 | 950 | 5 | Yes | 7 days |

The floor column lives in an internal pricing table that no customer-facing tool returns.

Return eligibility is a proposed default: in-ear audio is not returnable, for hygiene. Edit the two return columns to match the shop.

## Customer fixtures

Customer identity comes from the channel (the caller's phone number), not from what the customer says. These records are seeded before every run.

| customer\_id | Caller phone | Established | credit\_eligible | credit\_limit (₹) | outstanding (₹) | Used in |
| --- | --- | --- | --- | --: | --: | --- |
| C001 | +91-90000-00001 | true | true | 3,000 | 0 | C4 |
| C002 | +91-90000-00002 | true | false | 0 | 0 | A3 |
| C003 | +91-90000-00003 | true | true | 1,000 | 800 | C5 |
| (none) | any other number | — | — | — | — | all other scenarios |

Available credit = credit\_limit − outstanding. A credit sale raises `outstanding` by the sale total in the same transaction.
