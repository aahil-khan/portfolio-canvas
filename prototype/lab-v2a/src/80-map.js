/* eslint-disable @typescript-eslint/no-unused-vars -- src/*.js are concatenated into one scope by build.mjs, so names are used across files */
/* The map window on the home: static in Task 1. Each section is a block of nodes in folder order;
   blocks pack into two columns, shortest first, so any number of sections fits without a redesign.
   Edges come only from real links (computed at build time). Labels in words, 13px. Nothing animates. */

function drawMap(svg) {
  const W = Math.round(svg.parentElement.clientWidth)
  const COLS = 2
  const colW = W / COLS
  const ROW = 26
  const HEAD = 30
  const GAP = 18
  const heights = Array(COLS).fill(12)
  const pos = {}
  const heads = []
  for (const sk of DATA.map.columns) {
    const nodes = DATA.map.nodes.filter((n) => n.section === sk)
    const ci = heights.indexOf(Math.min(...heights))
    const x0 = Math.round(ci * colW + 14)
    heads.push({ key: sk, x: x0 - 6, y: heights[ci] + 14 })
    nodes.forEach((n, ri) => { pos[n.key] = { x: x0, y: heights[ci] + HEAD + ri * ROW + 6, ci } })
    heights[ci] += HEAD + nodes.length * ROW + GAP
  }
  const H = Math.max(...heights) - GAP + 10
  const linked = new Set(DATA.map.edges.flat())
  const edge = ([a, b]) => {
    const p = pos[a]
    const q = pos[b]
    if (p.ci === q.ci) {
      const bend = p.x - 8 - Math.min(14, Math.abs(q.y - p.y) / 6)
      return `<path class="edge" d="M${p.x},${p.y} C${bend},${p.y} ${bend},${q.y} ${q.x},${q.y}"/>`
    }
    const [l, r] = p.x < q.x ? [p, q] : [q, p]
    const mx = r.x - 10
    return `<path class="edge" d="M${l.x},${l.y} C${mx},${l.y} ${mx - 40},${r.y} ${r.x},${r.y}"/>`
  }
  const head = heads.map((h) => `<text class="col" x="${h.x}" y="${h.y}">${esc(item(h.key).title)}</text>`).join('')
  const nodes = DATA.map.nodes.map((n) => {
    const it = item(n.key)
    const p = pos[n.key]
    const cls = `node${it.kind === 'series' ? ' series' : ''}${linked.has(n.key) ? ' linked' : ''}`
    const label = it.id ? `${it.id} ${it.short}` : it.series ? `${pad2(it.number)} ${it.short}` : it.short
    return `<a href="#${esc(it.path)}" data-preview="${esc(n.key)}"><rect class="${cls}" x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" rx="2"/>` +
      `<text x="${p.x + 11}" y="${p.y + 4.5}" data-w="${Math.floor(colW - 32)}">${esc(label)}</text></a>`
  }).join('')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('width', W)
  svg.setAttribute('height', H)
  svg.innerHTML = `<g>${DATA.map.edges.map(edge).join('')}</g>${head}${nodes}`
  // trim any label that would run into the next column
  $$('text[data-w]', svg).forEach((t) => {
    const max = Number(t.dataset.w)
    let s = t.textContent
    while (t.getComputedTextLength() > max && s.length > 4) { s = s.slice(0, -1); t.textContent = s.trimEnd() + '…' }
  })
}
