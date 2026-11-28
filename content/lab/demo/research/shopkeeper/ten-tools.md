## Every tool speaks in item IDs, and errors carry no numbers

Every tool takes and returns item IDs, and none returns a floor. Errors are [[t:opaque-error|opaque codes]]: `PRICE_NOT_ACCEPTABLE`, never “below minimum ₹650”.[^spec] There are six, and none carries a number: price not acceptable, insufficient stock, credit not allowed, payment not confirmed, unknown item, invalid quantity.

## `evaluate_offer` is where the concession schedule lives

A [[t:blind-agent|blind agent]] can’t judge an offer itself, so it asks. [[t:evaluate-offer|`evaluate_offer`]] takes the offer and the round, and answers accept or counter, with a suggested price drawn from the [[t:concession-schedule|concession schedule]]. For a bundle it returns a valid [[t:bundle-split|per-line split]]. The agent may still ask for more than the suggestion; it just can’t go lower without the backend’s go-ahead.

::figure{of="spec-table-tools"}

## A sale needs a paid payment, a key and one atomic commit

`request_payment` sends the caller a UPI or card link and returns a payment ID; `payment_status` says whether it’s paid. `confirm_sale` needs a paid payment ID, unless the sale is on credit or [[t:cash-on-pickup|cash on pickup]], and it needs the [[t:idempotency-key|idempotency key]] that `evaluate_offer` returned on accept. The agent never makes a key up. The commit is atomic, and ==the same key twice returns the first result and never writes a second sale==.

If stock runs out between payment and confirmation, the backend refunds the payment by itself and logs the refund. The agent has no tool to mark a reservation paid; only shop staff at the counter can.

## After a timeout, the agent asks before it speaks

Each tool has a [[t:fault-injection|fault-injection]] hook, set per scenario and invisible to the agent: an error before commit, a timeout after commit, or failure every time. Scenarios C6, C7 and C8 use one each. After an error or timeout, the agent checks `get_transaction` with the same key before telling the customer anything. A lost response then never becomes a duplicate sale or a phantom confirmation.

## The log keeps what the backend refused

[[t:sale-attempts|`sale_attempts`]] records every `evaluate_offer` and `confirm_sale` call with its arguments and result, rejected ones included. The conversation audit, where disclosure and [[t:phantom-sale|phantom sales]] are recorded, is written by the evaluator only, never by the agent. The floor table and the backend’s config stay out of every log the agent can see.

v0 builds six of the ten: `find_item`, `check_stock`, `quote`, `evaluate_offer`, `confirm_sale` with payment stubbed as already paid, and `end_call`. The customer, payment and transaction tools wait for v1, along with the hooks. None has been built or run yet.
