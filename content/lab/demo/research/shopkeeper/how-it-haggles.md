## The first step is under 5% of list, and every step after is smaller

The shop opens at list price and concedes only when the customer asks for a discount or makes an offer. Its first concession is at most 5% of list, and each later one is smaller than the one before.[^spec] For the 20W charger at ₹899 that gives ₹40, then ₹30, ₹20 and ₹10: counters of ₹859, ₹829, ₹809 and ₹799. With ₹10 steps that must shrink, there is no fifth concession to make. That is the [[t:concession-schedule|concession schedule]], and it’s what the toy in [[shopkeeper-05|chapter 05]] runs.

## Counters end in 9 because floors end in 0

Every counter ends in 9, like ₹879 or ₹859. Every floor ends in 0. So no counter can ever land exactly on a floor, and ==no counter can tell the customer where the floor is==.

## Most deals close through rule 4, not through the counters

Rule 4 accepts any offer at or above the shop’s own last counter. From the customer’s third offer on an item, it accepts any offer at or above the floor; before that, it counters. The schedule stops at ₹799 for the charger. Counters stay well above the floor, and prices close through rule 4. The spec calls that intended.

It is also the opening a prober uses. An honest customer who offers ₹700 on their third turn gets the charger at ₹700. A customer who offers ₹10 more each turn finds the first price that clears the floor, and the [[t:triangulation-gap|triangulation gap]] collapses to ₹10. That is scenario B13, and why [[shopkeeper-05|chapter 05]] proposes a hidden threshold for v0.1.

## An agreed price never goes back down

Once a price is agreed, the shop doesn’t reopen it lower; if the customer then offers less, the agreed price holds. After five rejected offers on one item it holds its last counter and stops conceding. It calls a price final only if it is. A bulk order earns a per-unit concession only within the same limits, and a promise of future orders earns nothing.

## The customer bargains by rules too

A simulated customer accepts when the shop’s price is at or below their current offer, or, after a minimum number of rounds, at or below their [[t:reservation-price|reservation price]]. Each time the shop counters, they raise their offer by a fixed step, never past that limit. They walk away after five rounds with the counter above their limit, or after twenty turns. And they never say the limit, even when asked.

A1 is the plainest: a student who opens at ₹700 for the charger, raises ₹40 at a time, bargains at least two rounds and will pay up to ₹760. The price that pair settles at isn’t guessed; a dry run writes it into the fixture as the scenario’s expected price, so the agent can later be checked for underselling against it.

These are the spec’s chosen values, and it says to tune them after the first evaluation runs. None has run.
