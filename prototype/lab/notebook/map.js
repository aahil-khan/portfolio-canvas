/*
 * prototype/lab/notebook/map.js: the plain maps that replace the pictures (round 3). Each is
 * drawn from vault.mapData() (model.js, pure); this file only turns that data into HTML.
 *
 *   NB.map.has(id)              is this computed block drawn here?
 *   NB.map.html(id, vault)      'entries'  start-here's three ways in, in section colours
 *                               'map'      the three section cards: a line each, key entries, counts
 *                               'phases'   the study's phases as a progress list (dates, topics, hours)
 *                               'tracks'   the study's tracks as the same kind of list
 *
 * The narrator and the reading clock still read the block's Markdown (vault.blockMd), so what is
 * read aloud and what is drawn say the same thing.
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const C = NB.copy, esc = NB.md.escape
  const S = () => NB.shell
  // "2026-11-11" → "Nov 11"
  const day = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d)); return m ? `${C.months[+m[2] - 1]} ${+m[3]}` : String(d) }
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
  const bar = (done, of) => `<span class="nb-progress__bar" role="img" aria-label="${esc(C.progress.bar(done, of))}"><span style="width:${pct(done, of)}%"></span></span>`

  const draw = {
    entries(m) {
      return `<nav class="nb-entries" aria-label="${esc(C.start.entriesLabel)}">${m.entries.map((e) => `<a class="nb-entry" data-sec="${esc(e.section)}" href="${esc(S().href(e.note.route))}"><span class="nb-entry__title">${esc(e.title)}</span><span class="nb-entry__meta">${esc(e.meta)}</span></a>`).join('')}</nav>`
    },
    map(m) {
      const key = (k) => `<li><a href="${esc(S().href(k.note.route))}">${S().glyph(k.note)}<span class="nb-map__name">${esc(k.title)}</span></a>${k.meta ? `<span class="nb-map__meta">${esc(k.meta)}</span>` : ''}</li>`
      return `<div class="nb-map" aria-label="${esc(C.start.mapLabel)}">${m.sections.map((x) => `<section class="nb-map__card" data-sec="${esc(x.key)}">
        <h3 class="nb-map__head"><a href="${esc(S().href(x.hub.route))}">${esc(x.title)}</a><span class="nb-map__count">${esc(C.start.count(x.count))}</span></h3>
        <p class="nb-map__desc">${esc(x.desc)}</p>
        <ul class="nb-map__keys">${x.keys.map(key).join('')}</ul>
        <p class="nb-map__all"><a href="${esc(S().href(x.hub.route))}">${esc(C.start.allOf(x.title))}</a></p></section>`).join('')}</div>`
    },
    phases(m) {
      return `<ol class="nb-progress" aria-label="${esc(C.progress.phasesLabel)}">${m.phases.map((p) => `<li class="nb-progress__row"${p.now ? ' data-now' : ''}>
        <p class="nb-progress__top"><span class="nb-progress__name">${esc(p.name)}</span>${p.now ? `<span class="nb-progress__now">${esc(C.progress.now)}</span>` : ''}<span class="nb-progress__dates">${esc(C.progress.dates(day(p.start), day(p.end)))}</span></p>
        ${bar(p.done, p.topics)}
        <p class="nb-progress__nums"><span>${esc(C.progress.topics(p.done, p.topics))}</span><span>${esc(C.progress.hours(p.logged, p.planned))}</span></p></li>`).join('')}</ol>`
    },
    tracks(m) {
      return `<ul class="nb-progress nb-progress--tracks" aria-label="${esc(C.progress.tracksLabel)}">${m.tracks.map((t) => `<li class="nb-progress__row">
        <p class="nb-progress__top"><span class="nb-progress__name">${esc(t.name)}</span></p>
        ${bar(t.done, t.topics)}
        <p class="nb-progress__nums"><span>${esc(C.progress.done(t.done, t.topics))}</span></p></li>`).join('')}</ul>`
    },
  }
  NB.map = {
    has: (id) => Object.prototype.hasOwnProperty.call(draw, id),
    html: (id, v) => `<div class="nb-mapblock" data-map="${esc(id)}">${draw[id](v.mapData())}</div>`,
  }
})()
