/* eslint-disable @typescript-eslint/no-unused-vars -- src/*.js are concatenated into one scope by build.mjs, so names are used across files */
/* Views. Every page is a type driven by data: nothing here branches on a particular item. */

const statusOf = (it) => esc(it.status)

function linkRow(it, right, { current = false, desc = true } = {}) {
  const num = numLabel(it)
  return `<li><a class="row${current ? ' cur' : ''}" href="#${esc(it.path)}" data-preview="${esc(it.key)}"${current ? ' aria-current="page"' : ''}>` +
    `<span><span class="t">${num ? `<span data-id>${esc(num)}</span>` : ''}${esc(it.title)}</span>` +
    (desc && it.line ? `<span class="d">${esc(it.line)}</span>` : '') + `</span>` +
    `<span class="r">${right}</span></a></li>`
}

/* ---------- the bar ---------- */
function crumbsFor(it) {
  if (!it) return []
  const out = []
  if (it.section && it.kind !== 'section') out.push({ folder: it.section, label: item(it.section).title })
  if (it.series) out.push({ folder: it.series, label: item(it.series).short })
  if (it.kind === 'section') out.push({ here: true, label: it.title })
  else if (it.kind === 'tour') out.push({ here: true, label: it.title })
  else out.push({ here: true, label: it.series || it.id ? numLabel(it) : it.short, mono: !!(it.series || it.id) })
  return out
}
function pillLabel(it) {
  if (!it) return UI.lab
  if (it.series) {
    const list = DATA.folders[it.series]
    return `${item(it.series).short} · ${pad2(it.number)} ${UI.bar.sheetOf} ${pad2(list.length)}`
  }
  if (it.kind === 'section') return it.title
  return `${it.sectionTitle || UI.lab} · ${it.short}`
}
function barHtml(it, { listen = false } = {}) {
  const crumbs = crumbsFor(it)
  const sep = '<span class="sep" aria-hidden="true">/</span>'
  const crumbHtml = crumbs.map((c) => sep + (c.here
    ? `<span class="crumb here" aria-current="page">${c.mono ? `<span data-id>${esc(c.label)}</span>` : esc(c.label)}</span>`
    : `<button class="crumb" type="button" data-folder="${esc(c.folder)}" aria-expanded="false" aria-haspopup="dialog">${esc(c.label)}<span class="caret" aria-hidden="true"></span></button>`)).join('')
  return `<header class="bar"><div class="col"><div class="bar-in">
    <a class="mark" href="#/site" aria-label="${esc(UI.markLabel)}">${esc(UI.mark)}</a>
    <nav class="crumbs" aria-label="Path"><a class="crumb${it ? '' : ' here'}" href="#/lab"${it ? '' : ' aria-current="page"'}>${esc(UI.lab)}</a>${crumbHtml}</nav>
    <button class="pill" type="button" data-sheet aria-haspopup="dialog" aria-expanded="false"><span class="pt">${esc(pillLabel(it))}</span><span class="caret" aria-hidden="true"></span></button>
    <div class="bar-tools">
      ${listen ? `<button class="tool listen-tool" type="button" data-listen aria-pressed="false">${esc(UI.bar.listen)}</button>` : ''}
      <button class="tool" type="button" data-player aria-haspopup="dialog" aria-expanded="false">${playerButtonInner()}</button>
    </div>
  </div></div></header>`
}

/* ---------- footer ---------- */
function footHtml() {
  const t = DATA.themes.find((x) => x.id === theme.current()) || DATA.themes[0]
  return `<footer class="foot"><div class="col"><div class="foot-in">
    <nav aria-label="Site"><span class="clock">${esc(UI.footer.place)} · <span data-clock>${clock.now()}</span> ${esc(UI.footer.zone)}</span>
      <a href="#/site">${esc(UI.footer.home)}</a><a href="#/canvas">${esc(UI.footer.desk)}</a><a href="#/lab">${esc(UI.footer.lab)}</a><a href="#/colophon">${esc(UI.footer.colophon)}</a><a href="#/agents">${esc(UI.footer.agents)}</a></nav>
    <div class="switches">
      <button type="button" data-sound aria-pressed="${sound.on}">${esc(UI.footer.sound)}<b>${esc(sound.on ? UI.footer.on : UI.footer.off)}</b></button>
      <button type="button" data-theme-list aria-haspopup="dialog" aria-expanded="false">${esc(UI.footer.theme)}<b>${esc(t.label)}</b></button>
      <button type="button" data-lightdark>${esc(t.dark ? UI.footer.light : UI.footer.dark)}</button>
    </div>
  </div></div></footer>`
}

/* ---------- home ---------- */
function featuredHtml() {
  const it = DATA.featured && item(DATA.featured)
  if (!it) return ''
  const art = it.artifactHtml
    ? `<a class="feat-art" href="#${esc(it.path)}" tabindex="-1" aria-hidden="true">${it.artifactHtml}</a>`
    : `<blockquote class="feat-quote"><p>${esc(it.preview)}</p></blockquote>`
  return `<section class="block featured" aria-labelledby="h-featured">
    <h2 class="label" id="h-featured">${esc(UI.home.featured)}</h2>
    <div class="feat">${art}
      <div class="feat-text">
        <p class="k">${esc(kindWord(it))} · ${esc(it.sectionTitle || '')}</p>
        <h3><a href="#${esc(it.path)}" data-preview="${esc(it.key)}">${esc(it.title)}</a></h3>
        <p>${esc(it.line)}</p>
        <p class="k">${esc(UI.meta.updated)} ${dateTag(it.updated, it.updatedLabel)}</p>
      </div>
    </div>
  </section>`
}
function latestHtml() {
  return `<section class="block latest" aria-labelledby="h-latest">
    <h2 class="label" id="h-latest">${esc(UI.home.latest)}</h2>
    <ol class="rows">${DATA.latest.map((k) => {
      const it = item(k)
      return `<li><a class="row" href="#${esc(it.path)}" data-preview="${esc(k)}"><span class="kind">${esc(kindWord(it))}</span>` +
        `<span class="t">${it.id ? `<span data-id>${esc(it.id)}</span>` : ''}${esc(it.title)}</span><span class="r">${dateTag(it.updated, it.updatedLabel)}</span></a></li>`
    }).join('')}</ol>
  </section>`
}
function toursHtml() {
  if (!DATA.tours.length) return ''
  return `<section class="block tours" aria-labelledby="h-tours">
    <h2 class="label" id="h-tours">${esc(UI.home.tours)}</h2>
    <ol class="rows">${DATA.tours.map((k) => {
      const t = item(k)
      const allBuilt = t.stops.every((s) => item(s).built)
      const times = allBuilt ? ` · ${t.readMin} ${esc(UI.meta.read)} · ${esc(UI.meta.listen)} ${t.listenMin} ${esc(UI.meta.listenMin)}` : ''
      return linkRow(t, `${t.stops.length} ${esc(UI.meta.stops)}${times}`)
    }).join('')}</ol>
  </section>`
}
function sectionsHtml() {
  const secs = DATA.sections.map((sk) => {
    const s = item(sk)
    const rows = DATA.folders[sk].map((k) => {
      const it = item(k)
      const extra = it.kind === 'series' ? `${DATA.folders[k].length} ${esc(UI.kinds.chapter)}s · ` : ''
      return linkRow(it, `${extra}${statusOf(it)} · ${dateTag(it.updated, it.updatedLabel)}`, { desc: false })
    }).join('')
    return `<div class="sec">
      <div class="sec-head"><span data-id>${pad2(s.number)}</span><h3><a href="#${esc(s.path)}" data-preview="${esc(sk)}">${esc(s.title)}</a></h3><span class="st">${statusOf(s)}</span></div>
      <p class="sec-line">${esc(s.line)}</p>
      <ol class="rows">${rows}</ol>
    </div>`
  }).join('')
  return `<section class="block sections" aria-labelledby="h-sections">
    <h2 class="label" id="h-sections">${esc(UI.home.sections)}</h2>
    <div class="sections-grid"><div>${secs}</div>${mapWindowHtml()}</div>
  </section>`
}
function mapWindowHtml() {
  const n = DATA.map.nodes.length
  return `<figure class="win map-win" data-map>
    <figcaption class="win-bar"><span class="win-id">${esc(UI.home.map)}</span><span class="win-label">${n} · ${DATA.map.edges.length}</span></figcaption>
    <div class="win-body"><svg class="map-svg" role="img" aria-label="${esc(UI.home.mapNote)}"></svg></div>
    <p class="map-key">${esc(UI.home.mapNote)}</p>
  </figure>`
}
function homeHtml() {
  return `<main id="main" class="col home"><article>
    <div class="hero" data-note-head>
      <div class="hero-name"><h1>${esc(UI.home.title)}</h1><button class="sayit" type="button" data-sayit aria-label="${esc(UI.home.sayItLabel)}"><span class="w">(${esc(UI.home.sayIt)})</span></button></div>
      <p class="intro">${esc(UI.home.intro)}</p>
    </div>
    ${featuredHtml()}${latestHtml()}${toursHtml()}${sectionsHtml()}
  </article></main>`
}

/* ---------- a note of any kind with a body ---------- */
function kickerHtml(it) {
  // plain text: the path bar above already links every folder named here
  const sec = it.section ? esc(it.sectionTitle) : ''
  if (it.series) {
    const list = DATA.folders[it.series]
    return `<span class="k-series">${esc(item(it.series).short)}</span> · <span data-id>${pad2(it.number)}</span> ${esc(UI.meta.of)} <span data-id>${pad2(list.length)}</span>`
  }
  if (it.kind === 'experiment') return `${esc(kindWord(it))} · ${sec}`
  if (it.id) return `<span data-id>${esc(it.id)}</span> · ${sec} · ${statusOf(it)}`
  return `${sec} · ${esc(kindWord(it))}`
}
function metaHtml(it) {
  const dates = it.published === it.updated
    ? `<span>${esc(UI.meta.published)} ${dateTag(it.published, it.publishedLabel)}</span>`
    : `<span>${esc(UI.meta.published)} ${dateTag(it.published, it.publishedLabel)}</span><span class="dot">·</span><span>${esc(UI.meta.updated)} ${dateTag(it.updated, it.updatedLabel)}</span>`
  const read = it.readMin ? `<span class="dot">·</span><span data-readtime="${it.readMin}">${it.readMin} ${esc(UI.meta.read)}</span>` : ''
  const listen = it.listen && it.listenMin ? `<span class="dot">·</span><span><button class="listen-btn" type="button" data-listen aria-pressed="false">${esc(UI.meta.listen)}</button><span class="listen-word">${esc(UI.meta.listen.toLowerCase())}</span> ${it.listenMin} ${esc(UI.meta.listenMin)}</span>` : ''
  return `<p class="meta">${dates}${read}${listen}</p>`
}
function tocHtml(it) {
  if (!it.toc || it.toc.length < 3) return ''
  return `<nav class="toc" aria-label="${esc(UI.meta.contents)}"><div class="toc-in"><p class="label">${esc(UI.meta.contents)}</p><ol>${it.toc.map((h) =>
    `<li><a href="#${esc(it.path)}?at=${esc(h.id)}" data-at="${esc(h.id)}"><span data-id>${h.num}</span><span>${esc(h.text)}</span></a></li>`).join('')}</ol></div></nav>`
}
/** The contents go straight after the artifact (or first, when there is none): see lab.css. */
function withToc(it) {
  const toc = tocHtml(it)
  if (!toc) return it.html
  const i = it.html.startsWith('<figure') ? it.html.indexOf('</figure>') + 9 : 0
  return it.html.slice(0, i) + toc + it.html.slice(i)
}
function relatedHtml(it) {
  const r = it.related
  if (!r || (!r.linked.length && !r.also.length)) return ''
  const folderOf = (o) => esc(o.seriesShort || o.sectionTitle || UI.lab)
  const linked = r.linked.length ? `<div class="rel-group"><p class="label">${esc(UI.related.linked)}</p><ol class="rows">${r.linked.map(({ key, how }) => {
    const o = item(key)
    return linkRow(o, `${folderOf(o)} · ${esc(UI.related[how])}`)
  }).join('')}</ol></div>` : ''
  const also = r.also.length ? `<div class="rel-group"><p class="label">${esc(UI.related.also)}</p><ol class="rows">${r.also.map((key) => {
    const o = item(key)
    return linkRow(o, folderOf(o))
  }).join('')}</ol></div>` : ''
  return `<aside class="related" aria-label="${esc(UI.related.label)}"><p class="label">${esc(UI.related.label)}</p>${linked}${also}</aside>`
}
function prevNextHtml(it) {
  if (!it.series) return ''
  const list = DATA.folders[it.series]
  const i = list.indexOf(it.key)
  const cell = (k, cls, label) => {
    if (!k) return ''
    const o = item(k)
    return `<a class="${cls}" href="#${esc(o.path)}" data-preview="${esc(k)}"><span class="label">${esc(label)} · <span data-id>${pad2(o.number)}</span></span><span class="t">${esc(o.short)}</span></a>`
  }
  return `<nav class="prevnext" aria-label="${esc(item(it.series).short)}">${cell(list[i - 1], 'prev', UI.meta.previous)}${cell(list[i + 1], 'next', UI.meta.next)}</nav>`
}
function noteHtml(it) {
  return `<main id="main" class="col note"><article data-kind="${esc(it.kind)}">
    <div class="note-head" data-note-head>
      <p class="kicker">${kickerHtml(it)}</p>
      <h1>${esc(it.title)}</h1>
      ${it.audience ? `<p class="audience">${esc(it.audience)}</p>` : ''}
      ${metaHtml(it)}
    </div>
    <div class="prose" data-body>${withToc(it)}</div>
    ${relatedHtml(it)}
    ${prevNextHtml(it)}
  </article></main>`
}

/* ---------- honest stubs ---------- */
function stubHtml(it) {
  return `<main id="main" class="col stub" data-stub><article>
    <div data-note-head>
      <p class="kicker">${it.section ? esc(it.sectionTitle) + ' · ' : ''}${esc(kindWord(it))}${it.status ? ' · ' + statusOf(it) : ''}</p>
      <h1>${esc(it.title)}</h1>
      ${it.line ? `<p class="audience">${esc(it.line)}</p>` : ''}
      <p class="meta"><span>${esc(UI.meta.updated)} ${dateTag(it.updated, it.updatedLabel)}</span></p>
    </div>
    <p class="note-box"><span class="label">${esc(UI.stub.label)}.</span> ${esc(UI.stub.body)}</p>
    <p><a class="u" href="#/lab">${esc(UI.stub.back)}</a></p>
  </article></main>`
}
function outsideHtml(key) {
  return `<main id="main" class="col stub" data-stub><article>
    <p class="note-box">${esc(UI.outside[key])}</p>
    <p><a class="u" href="#/lab">${esc(UI.stub.back)}</a></p>
  </article></main>`
}
