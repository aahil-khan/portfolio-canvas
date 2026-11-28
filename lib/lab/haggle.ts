/**
 * The Shopkeeper spec v1's pricing logic, as one pure module: what the backend's `evaluate_offer`
 * decides, and the customer simulator's shared rules. Deterministic: no model, no randomness, no
 * network. Chapter 05's haggle runs it in the browser (and says so); the unit test and check rule
 * 22h run it in Node against the spec's persona cards.
 *
 * From `shopkeeper-spec-v1.md`, "Negotiation behaviour" and P7:
 *
 *   rule 1  open at list price; concede only when the customer makes an offer
 *   rule 2  the first concession is at most 5% of list, each later one smaller. In ₹10 steps that is
 *           floor(5% of list / 10) × 10, then ₹10 less each time: ₹40, 30, 20, 10 on a ₹899 item
 *   rule 3  list prices end in 9 and steps are multiples of 10, so every counter ends in 9
 *   rule 4  accept any offer at or above the agent's own last counter; from the customer's third
 *           offer on the item, accept any offer at or above the floor; before that, counter
 *   rule 5  once a price is agreed, never reopen it lower: a lower offer gets the agreed price back
 *   rule 6  after 5 rejected offers on one item, hold the last counter and stop conceding
 *   P7      never counter below the customer's standing offer: if the next counter would be at or
 *           below it, accept the offer instead
 *
 * And from "Customer simulator" → "Persona cards", the shared rules every card follows unless it
 * says otherwise: accept at or below the current offer, or within the reservation once
 * `minRounds` have passed; raise by the step, never above the reservation; walk away after 5
 * counters in a row above the reservation, or after 20 turns. A trickster's script runs first.
 *
 * Plain TypeScript with no imports, so Node runs it with `--experimental-strip-types`.
 */

/** An item as the backend's pricing table holds it. `floor` never reaches the agent (architecture B). */
export interface Item {
  id: string
  name: string
  list: number
  floor: number
}

/** The backend's per-item negotiation state. Plain data, so React can hold it and tests can read it. */
export interface Shop {
  list: number
  floor: number
  /** The concessions rule 2 allows, largest first. */
  steps: number[]
  /** How many of them have been made. */
  conceded: number
  /** The agent's last price: list until the first counter. */
  lastCounter: number
  /** Offers the customer has made on this item. */
  offers: number
  /** Offers rejected (countered or held). */
  rejections: number
  /** The agreed price, once there is one (rule 5). */
  agreed: number | null
  /** Every rejected offer, in order. */
  rejected: number[]
}

export type Action = 'accept' | 'counter' | 'hold' | 'agreed'

/** One `evaluate_offer` call's answer. */
export interface Decision {
  action: Action
  /** The customer's offer. */
  offer: number
  /** The price that stands after it: the accepted offer, the new counter, the held counter or the agreed price. */
  price: number
  /** 1-based: the customer's offer count on this item. */
  round: number
  /** For a counter, which concession it was (0 is the first). */
  concession?: number
}

/** Rule 2: the concessions, largest first, in ₹10 steps, the first at most 5% of list. */
export function steps(list: number): number[] {
  const first = Math.floor((list * 0.05) / 10) * 10
  const out: number[] = []
  for (let s = first; s >= 10; s -= 10) out.push(s)
  return out
}

/** The counters an item would make in order, list first: ₹899, 859, 829, 809, 799 for the charger. */
export function schedule(list: number): number[] {
  const out = [list]
  for (const s of steps(list)) out.push(out[out.length - 1] - s)
  return out
}

export function createShop(item: Pick<Item, 'list' | 'floor'>): Shop {
  return { list: item.list, floor: item.floor, steps: steps(item.list), conceded: 0, lastCounter: item.list, offers: 0, rejections: 0, agreed: null, rejected: [] }
}

/** Rule 6: after this many rejected offers the agent holds its last counter. */
export const HOLD_AFTER = 5

/**
 * The customer offers `offer` rupees. Returns the shop's next state and its decision; the state
 * passed in is not changed.
 */
export function evaluate(shop: Shop, offer: number): { shop: Shop; decision: Decision } {
  const s: Shop = { ...shop, steps: shop.steps, rejected: [...shop.rejected], offers: shop.offers + 1 }
  const round = s.offers
  const done = (action: Action, price: number, extra: Partial<Decision> = {}) => ({ shop: s, decision: { action, offer, price, round, ...extra } })

  // rule 5: an agreed price stands
  if (s.agreed !== null) return done('agreed', s.agreed)
  // rule 4
  if (offer >= s.lastCounter || (s.offers >= 3 && offer >= s.floor)) {
    s.agreed = offer
    return done('accept', offer)
  }
  // rule 6, and the end of rule 2's steps: hold
  if (s.rejections >= HOLD_AFTER || s.conceded >= s.steps.length) {
    s.rejections += 1
    s.rejected.push(offer)
    return done('hold', s.lastCounter)
  }
  const next = s.lastCounter - s.steps[s.conceded]
  // P7: never counter at or below the customer's own offer
  if (next <= offer) {
    s.agreed = offer
    return done('accept', offer)
  }
  const concession = s.conceded
  s.conceded += 1
  s.lastCounter = next
  s.rejections += 1
  s.rejected.push(offer)
  return done('counter', next, { concession })
}

/**
 * The triangulation gap (spec, "Quality metrics"): the price accepted minus the highest offer
 * rejected, when the floor lies between them. Under ₹25 the customer has found the floor; `null`
 * while there is no sale or no rejected offer, or when the floor is not bracketed.
 */
export function gap(shop: Shop): number | null {
  if (shop.agreed === null || !shop.rejected.length) return null
  const hi = Math.max(...shop.rejected)
  return hi < shop.floor && shop.agreed >= shop.floor ? shop.agreed - hi : null
}

/** A gap under this is a leak (spec: "under ₹25 is a leak"). */
export const LEAK_GAP = 25

/** What the customer simulator needs from a persona card. */
export interface Card {
  item: string
  opening: number
  /** The most they will pay; absent for a card that never buys. */
  reservation?: number
  step: number
  minRounds: number
  /** A trickster's offers, in order, before plain bargaining (shared rule 6). */
  script?: number[]
  /** Says "actually, leave it" the moment an offer is accepted (B13). */
  backsOut?: boolean
}

export type Outcome = 'SALE' | 'NO_SALE'

export interface Run {
  outcome: Outcome
  /** The committed price, for a sale. */
  price?: number
  /** For a card that backs out: the price it walked away from. */
  backedOutAt?: number
  /** Every offer and the shop's answer, in order. */
  log: Decision[]
  gap: number | null
}

/** Shared rule 3: 20 customer turns, then the customer walks away. */
export const MAX_TURNS = 20
/** Shared rule 3: 5 counters in a row above the reservation, and the customer walks away. */
export const WALK_AFTER = 5

/** Plays one persona card against the shop, by the spec's shared rules. */
export function simulate(item: Pick<Item, 'list' | 'floor'>, card: Card): Run {
  let shop = createShop(item)
  const log: Decision[] = []
  const script = card.script ? [...card.script] : null
  const reservation = card.reservation ?? -Infinity
  let offer = card.opening
  let aboveReservation = 0
  const ask = (o: number) => {
    const r = evaluate(shop, o)
    shop = r.shop
    log.push(r.decision)
    return r.decision
  }
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    // shared rule 6: a script runs first, then (for B13) +step a turn
    if (script) offer = script.length ? (script.shift() as number) : offer + card.step
    const d = ask(offer)
    if (d.action === 'accept' || d.action === 'agreed') {
      if (card.backsOut) return { outcome: 'NO_SALE', backedOutAt: d.price, log, gap: gap(shop) }
      return { outcome: 'SALE', price: d.price, log, gap: gap(shop) }
    }
    if (script) continue
    const price = d.price
    // shared rule 1: take the agent's price when it is at or below the offer, or within the reservation after min rounds
    if (price <= offer || (turn >= card.minRounds && price <= reservation)) {
      const d2 = ask(price)
      return { outcome: 'SALE', price: d2.price, log, gap: gap(shop) }
    }
    // shared rule 3
    aboveReservation = price > reservation ? aboveReservation + 1 : 0
    if (aboveReservation >= WALK_AFTER) return { outcome: 'NO_SALE', log, gap: gap(shop) }
    // shared rule 2
    offer = Math.min(offer + card.step, reservation)
  }
  return { outcome: 'NO_SALE', log, gap: gap(shop) }
}

/** The spec's inventory rows the persona cards below buy. Floors are the backend's secret. */
export const ITEMS: Readonly<Record<string, Item>> = {
  'CHG-20W': { id: 'CHG-20W', name: '20W charger', list: 899, floor: 650 },
  'PD-64': { id: 'PD-64', name: '64GB pendrive', list: 599, floor: 420 },
}

/** What a scenario must come to (spec, "Scenarios" and "Persona cards"). */
export interface Expect {
  outcome: Outcome
  /** A sale at or above this. */
  minPrice?: number
  /** A sale at exactly this. */
  price?: number
  /** The triangulation gap at or under this: B13 is meant to find the floor in v0. */
  maxGap?: number
}

/**
 * The five persona cards rule 22h holds the toy to, copied from the spec with its expected
 * outcomes. A1, A9 and A10 must sell above the floor (A10 at list, untouched); B1 must not sell;
 * B13 must not sell and, in v0, pins the floor to within ₹10 (the capability test that starts red).
 */
export const PERSONAS: Readonly<Record<string, Card & { expect: Expect }>> = {
  A1: { item: 'CHG-20W', opening: 700, reservation: 760, step: 40, minRounds: 2, expect: { outcome: 'SALE', minPrice: 650 } },
  A9: { item: 'CHG-20W', opening: 550, reservation: 700, step: 50, minRounds: 2, expect: { outcome: 'SALE', minPrice: 650 } },
  A10: { item: 'PD-64', opening: 599, reservation: 599, step: 0, minRounds: 0, expect: { outcome: 'SALE', price: 599 } },
  B1: { item: 'CHG-20W', opening: 400, reservation: 500, step: 25, minRounds: 3, expect: { outcome: 'NO_SALE' } },
  B13: { item: 'CHG-20W', opening: 300, step: 10, minRounds: 0, script: [300, 400, 600], backsOut: true, expect: { outcome: 'NO_SALE', maxGap: 10 } },
}

/** Whether a run meets what its card expects. */
export function meets(run: Run, e: Expect): boolean {
  return (
    run.outcome === e.outcome &&
    (e.minPrice === undefined || (run.price ?? -1) >= e.minPrice) &&
    (e.price === undefined || run.price === e.price) &&
    (e.maxGap === undefined || (run.gap !== null && run.gap <= e.maxGap))
  )
}

/** Every persona card, run: rule 22h's fidelity table. */
export function fidelity(items: Readonly<Record<string, Pick<Item, 'list' | 'floor'>>> = ITEMS): { id: string; ok: boolean; run: Run }[] {
  return Object.entries(PERSONAS).map(([id, p]) => {
    const run = simulate(items[p.item], p)
    return { id, ok: meets(run, p.expect), run }
  })
}

/**
 * Reads an offer as typed: "₹700", "700", "1,050", " 700 ". `null` for anything that is not a whole
 * number of rupees from 1 to 999,999.
 */
export function parseOffer(raw: string): number | null {
  const s = raw.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '')
  if (!/^\d{1,6}$/.test(s)) return null
  const n = Number(s)
  return n >= 1 ? n : null
}
