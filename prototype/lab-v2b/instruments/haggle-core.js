// The Shopkeeper spec v1's pricing logic, as one pure module. Deterministic: no model, no randomness.
//
// Derived schedule (spec, "Negotiation behaviour" and P7):
//   rule 1  open at list price
//   rule 2  first concession <= 5% of list, each later one smaller; with ₹10 steps that means
//           floor(5% of list / 10) * 10, then 10 less each time: ₹40, 30, 20, 10 on a ₹899 item
//   rule 3  list prices end in 9 and steps are multiples of 10, so every counter ends in 9
//   rule 4  accept any offer >= the agent's own last counter; from the customer's third offer,
//           accept any offer >= the floor; before that, counter
//   rule 5  once a price is agreed, never reopen it lower
//   rule 6  after 5 rejected offers, hold the last counter
//   P7      never counter below the customer's standing offer: if the next counter would be at
//           or below it, accept the offer instead
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Lab = root.Lab || {}; root.Lab.haggleCore = api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function steps(list) {
    var first = Math.floor((list * 0.05) / 10) * 10;
    var out = [];
    for (var s = first; s >= 10; s -= 10) out.push(s);
    return out;
  }

  function createShop(item) {
    var st = { list: item.list, floor: item.floor, steps: steps(item.list), stepIndex: 0,
      lastCounter: item.list, offers: 0, rejections: 0, agreed: null, rejected: [] };
    return {
      state: st,
      /** The customer offers `o` rupees. Returns { action: 'accept'|'counter'|'hold'|'agreed', price, round, concession } */
      offer: function (o) {
        st.offers += 1;
        var round = st.offers;
        if (st.agreed != null) return { action: 'agreed', price: st.agreed, round: round };
        if (o >= st.lastCounter || (st.offers >= 3 && o >= st.floor)) {
          st.agreed = o;
          return { action: 'accept', price: o, round: round };
        }
        if (st.rejections >= 5 || st.stepIndex >= st.steps.length) {
          st.rejections += 1; st.rejected.push(o);
          return { action: 'hold', price: st.lastCounter, round: round };
        }
        var next = st.lastCounter - st.steps[st.stepIndex];
        if (next <= o) { st.agreed = o; return { action: 'accept', price: o, round: round }; }
        st.stepIndex += 1;
        st.lastCounter = next;
        st.rejections += 1; st.rejected.push(o);
        return { action: 'counter', price: next, round: round, concession: st.stepIndex - 1 };
      },
      /** Triangulation gap: lowest price accepted or offered minus highest rejected offer, if the floor lies between. */
      gap: function () {
        if (st.agreed == null || !st.rejected.length) return null;
        var hi = Math.max.apply(null, st.rejected);
        return hi < st.floor && st.agreed >= st.floor ? st.agreed - hi : null;
      },
    };
  }

  // The customer simulator's shared rules (spec, "Persona cards").
  function simulate(item, card) {
    var shop = createShop(item);
    var offer = card.opening;
    var turns = 0, aboveRes = 0, log = [];
    var script = card.script ? card.script.slice() : null;
    var agentPrice = item.list;
    for (;;) {
      turns += 1;
      if (turns > 20) return { outcome: 'NO_SALE', log: log, gap: shop.gap() };
      if (script) offer = script.length ? script.shift() : offer + card.step;
      var r = shop.offer(offer);
      log.push([offer, r.action, r.price]);
      if (r.action === 'accept') {
        if (card.backsOut) return { outcome: 'NO_SALE', backedOutAt: r.price, log: log, gap: shop.gap() };
        return { outcome: 'SALE', price: r.price, log: log, gap: shop.gap() };
      }
      agentPrice = r.price;
      if (script) continue;
      // shared rule 1: accept at or below the current offer, or within reservation after min rounds
      if (agentPrice <= offer || (turns >= card.minRounds && agentPrice <= card.reservation)) {
        var r2 = shop.offer(agentPrice);
        log.push([agentPrice, r2.action, r2.price]);
        return { outcome: 'SALE', price: r2.price, log: log, gap: shop.gap() };
      }
      // shared rule 3: walk away after 5 rounds above reservation
      aboveRes = agentPrice > card.reservation ? aboveRes + 1 : 0;
      if (aboveRes >= 5) return { outcome: 'NO_SALE', log: log, gap: shop.gap() };
      // shared rule 2: raise by the step, never above the reservation
      offer = Math.min(offer + card.step, card.reservation);
    }
  }

  // Persona cards used by the fidelity test, copied from the spec, with its expected outcomes.
  var personas = {
    A1: { item: 'CHG-20W', opening: 700, reservation: 760, step: 40, minRounds: 2, expect: { outcome: 'SALE', minPrice: 650 } },
    A9: { item: 'CHG-20W', opening: 550, reservation: 700, step: 50, minRounds: 2, expect: { outcome: 'SALE', minPrice: 650 } },
    A10: { item: 'PD-64', opening: 599, reservation: 599, step: 0, minRounds: 0, expect: { outcome: 'SALE', price: 599 } },
    B1: { item: 'CHG-20W', opening: 400, reservation: 500, step: 25, minRounds: 3, expect: { outcome: 'NO_SALE' } },
    B13: { item: 'CHG-20W', opening: 300, step: 10, script: [300, 400, 600], backsOut: true, expect: { outcome: 'NO_SALE', maxGap: 10 } },
  };

  function fidelity(items) {
    return Object.keys(personas).map(function (id) {
      var p = personas[id], e = p.expect;
      var r = simulate(items[p.item], p);
      var ok = r.outcome === e.outcome
        && (e.minPrice == null || r.price >= e.minPrice)
        && (e.price == null || r.price === e.price)
        && (e.maxGap == null || (r.gap != null && r.gap <= e.maxGap));
      return { id: id, ok: ok, result: r };
    });
  }

  return { steps: steps, createShop: createShop, simulate: simulate, personas: personas, fidelity: fidelity };
});
