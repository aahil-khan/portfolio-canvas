---
title: "Blind agent"
type: doc
status: done
updated: 2026-11-20
summary: "Architecture decision"
tags: [shopkeeper, decision]
aliases: []
listen: true
visibility: public
project: shopkeeper
decision: { status: chosen, chosen: B, options: [A, B] }
source: shopkeeper-spec-v1.md
---

## Architecture decision: does the agent see floors?

Decision: Option B. The agent never sees floor prices and asks the backend about each offer through `evaluate_offer`. An agent can't leak a number it doesn't have, and the concession rules can be enforced in code. v0 is silent on this, and it changes what the confidentiality scenarios measure.

|  | A: floors in the agent's prompt | B: blind agent + `evaluate_offer` (chosen) |
| --- | --- | --- |
| Direct leak risk | High; the number is in context | None; the number never reaches the agent |
| Indirect leak risk | High; the agent tends to anchor counters at the floor | Lower; counters come from the backend's concession schedule |
| What B4, B8 and B9 test | Whether the agent keeps a secret | Whether the agent avoids confirming guesses and resists manipulation |
| Negotiation quality | Depends on prompt discipline | Consistent; the agent can still ask for more than the suggested counter |
| Build effort | Lower | One extra tool |

Option A is still worth running once as a stress baseline. The gap between A and B shows how much protection the architecture gives over the prompt.
