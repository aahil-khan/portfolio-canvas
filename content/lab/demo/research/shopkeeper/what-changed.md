## v0’s scenarios and its pass checks disagreed

Several v0 scenarios contradict themselves. Scenario #2 says a sale should happen at ₹550 or more; its pass check says ₹500. Scenario #13 allows a counteroffer, then requires the stock to be unchanged, so an agent that makes a valid counter-sale fails it. The same mismatch runs through #3 and #5 to #8.[^spec]

v1 replaces both columns with one [[t:expected-outcome|expected outcome]], derived from a stated [[t:reservation-price|reservation price]]: the most that customer will pay. Between the shop’s floor and that price lies the [[t:zopa|zone of possible agreement]]. If it’s empty, the right answer is no sale, and ==there is nothing left to argue about after the run==.

## A clean database can hide a sale the agent tried to make

v0 graded what ended up in the database. A backend that blocks a bad sale keeps the database clean, so the database alone can’t show the agent tried one. v1 logs every [[t:evaluate-offer|`evaluate_offer`]] and `confirm_sale` call in [[t:sale-attempts|`sale_attempts`]], rejected ones included, and a below-floor `confirm_sale` attempt or a spoken agreement to a below-floor price is a hard fail.

It closes a quieter gap too. In v0, selling the charger at its floor to a customer who would have paid ₹760 passed. v1 scores [[t:margin-capture|margin capture]] on every sale, so an agent that gives margin away shows up even when it breaks no rule ([[shopkeeper-08|chapter 08]] has the numbers).

::figure{of="compare-shopkeeper-01"}

## A simulated customer has to decide in code

Nothing in v0 made an LLM-played customer behave the same way twice, so the same scenario could pass on one run and fail on the next for reasons that had nothing to do with the agent. v1 writes each customer as a [[t:persona-card|persona card]]: an opening offer, a step, a hidden limit and a [[t:tactic-script|tactic script]]. The model only voices the persona; whether to buy or walk away runs in code. That is what makes [[t02|repeated runs]] mean something: five runs against the same customer measure the agent, not the dice.

## Payment, credit and timeouts each got a tool

v0 asked for payment before confirmation and gave the agent no way to check it; v1 adds `request_payment` and `payment_status`, and `confirm_sale` needs a paid payment. v0 took the customer’s ID from what they said, so anyone could claim to be anyone; v1 takes it from the line, a [[t:verified-caller|verified caller]], and adds credit limits. And v0’s timeout scenario couldn’t be graded once the timeout came after the commit; v1 adds an [[t:idempotency-key|idempotency key]] and `get_transaction`, and splits that one scenario into three ([[shopkeeper-06|chapter 06]]).

The biggest change gets a chapter of its own. v0 defined only direct disclosure of the floor, and was silent on whether the agent even sees floor prices. v1 decides it doesn’t, which changes what the confidentiality scenarios measure: that is [[shopkeeper-05|chapter 05]].

## Twelve new scenarios, and three from splitting old ones

v0 had no prompt injection, impersonation, credit limit, fake competitor price, unknown item, back-out or pay-at-list case. v1 adds twelve scenarios for them. Splitting v0’s #17 into two and its #20 into three adds three more, for 35 in all ([[shopkeeper-07|chapter 07]] lists every one).

This chapter compares two documents, not two agents. v1 is a spec, the first build is a [[t:v0-slice|24-scenario slice]] of it, and nothing has run yet.
