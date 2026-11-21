/*
 * prototype/lab/notebook/embeds.js: the five embeds, as the mockup shows them. Each is a fenced
 * block in a note (md.js renders the frame and the caption; this fills the body), with a reserved
 * aspect ratio so nothing shifts when it fills in.
 *
 *   NB.embeds.html(block, n, note)   the embed's body, as HTML
 *   NB.embeds.hydrate(root, note)    wires what is live: the terminal replay, the try-it inputs
 *
 *   clip      a 16:9 frame, an ASCII poster, ▶ 0:42, labelled as a placeholder (no clips exist)
 *   terminal  real commands, replayed with a cursor; ▶ replay, speed, copy. Outputs that are in no
 *             source show as …. Reduced motion (LAB.sky.reduced, the one owner) shows it whole.
 *   try       margin-capture: LIVE. The spec's two formulas on CHG-20W (list 899, floor 650,
 *             reservation 760), and its 0.1 soft-warning line
 *   chart     study-hours: planned and logged hours per phase, from study.js; a table beside it
 *   diagram   sale-confirmation: the spec's own placeholder, drawn in mono SVG
 */
;(() => {
  const NB = (window.NB = window.NB || {})
  const C = NB.copy, E = C.embeds, esc = NB.md.escape
  const reduced = () => !!(window.LAB && LAB.sky && LAB.sky.reduced)
  const X = (NB.embeds = {})
  const dur = (s) => { const n = +s || 0; return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` }

  X.html = (b) => {
    if (b.kind === 'clip') {
      const poster = [' .------------------------. ', ' |  >_                     | ', ' |                        | ', " '------------------------' "].join('\n')
      return `<div style="aspect-ratio:16/9;display:grid;place-items:center;align-content:center;gap:10px;background:var(--lab-pane)"><pre aria-hidden="true" style="margin:0;color:var(--lab-dim)">${esc(poster)}</pre><span><span style="border:1px solid var(--lab-line);padding:2px 8px">${esc(E.clipPlay(dur(b.attrs.dur)))}</span> <span style="color:var(--lab-dim)">${esc(E.clip)}</span></span></div>`
    }
    if (b.kind === 'terminal') {
      const lines = b.body.split('\n')
      return `<div class="nb-term" style="background:var(--lab-pane)"><div style="display:flex;gap:12px;padding:5px 10px;border-bottom:1px solid var(--lab-faint)"><button type="button" data-term="replay" aria-label="${esc(E.replayLabel)}">${esc(E.replay)}</button><button type="button" data-term="speed" data-speed="1" aria-label="${esc(E.speedLabel(1))}">${esc(E.speed(1))}</button><button type="button" data-term="copy" aria-label="${esc(E.copyLabel)}">${esc(E.copy)}</button></div><pre class="nb-term__out" style="margin:0;padding:10px 12px;min-height:${lines.length * 1.45 + 1.4}em;line-height:1.45;overflow-x:auto" data-src="${esc(b.body)}">${lines.map((l) => `<span${/^\s*…\s*$/.test(l) ? ' style="color:var(--lab-dim)"' : ''}>${esc(l)}</span>`).join('\n')}</pre></div>`
    }
    if (b.kind === 'try' && b.id === 'margin-capture') {
      const F = E.tryFields
      const field = (k, v) => `<label style="display:grid;gap:2px"><span style="color:var(--lab-dim)">${esc(F[k])}</span><input type="number" inputmode="numeric" step="1" min="0" value="${v}" data-try="${k}" style="width:100%;font:inherit;color:var(--lab-fg);background:var(--lab-bg);border:1px solid var(--lab-line);padding:4px 6px"></label>`
      return `<div class="nb-try" style="padding:12px;display:grid;gap:12px"><p style="margin:0;color:var(--lab-dim)">${esc(E.tryPreset)}</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">${field('unit', 760)}${field('floor', 650)}${field('list', 899)}${field('reservation', 760)}</div><output class="nb-try__out" aria-live="polite" style="display:grid;gap:4px"></output></div>`
    }
    if (b.kind === 'chart' && b.id === 'study-hours') return chart()
    if (b.kind === 'diagram' && b.id === 'sale-confirmation') return diagram()
    return ''
  }

  // planned vs logged hours per phase, from the tracker (study.js), and a table fallback
  function chart() {
    const S = NB.study, ph = S.phases.map((p) => {
      const ts = S.topics.filter((t) => t.phase === p.name)
      return { name: p.name, planned: ts.reduce((a, t) => a + t.est_h, 0), logged: Math.round(S.log.filter((r) => ts.some((t) => t.id === r.id)).reduce((a, r) => a + r.h, 0) * 10) / 10 }
    })
    const max = Math.max(...ph.map((p) => p.planned), 1), W = 640, rowH = 34, H = ph.length * rowH + 30, x0 = 220
    const bars = ph.map((p, i) => {
      const y = 12 + i * rowH, w1 = ((W - x0 - 60) * p.planned) / max, w2 = ((W - x0 - 60) * p.logged) / max
      return `<text x="0" y="${y + 13}">${esc(p.name)}</text><rect x="${x0}" y="${y + 2}" width="${w1.toFixed(1)}" height="10" fill="none" stroke="var(--lab-line)"/><rect x="${x0}" y="${y + 15}" width="${Math.max(w2, p.logged ? 2 : 0).toFixed(1)}" height="10" fill="var(--lab-ar)"/><text x="${(x0 + w1 + 6).toFixed(1)}" y="${y + 11}">${p.planned}</text><text x="${(x0 + Math.max(w2, 2) + 6).toFixed(1)}" y="${y + 24}">${p.logged}</text>`
    }).join('')
    const legend = `<text x="${x0}" y="${H - 4}">□ ${esc(E.chartLegend.planned)}   ■ ${esc(E.chartLegend.logged)}</text>`
    return `<div style="padding:12px"><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;aspect-ratio:${W}/${H}" role="img" aria-label="${esc(E.chartHead.join(', '))}"><g style="font-family:var(--mono);font-size:11px;fill:var(--lab-dim)">${bars}${legend}</g></svg>
      <details style="margin-top:8px"><summary>${esc(E.chartTable)}</summary><table style="border-collapse:collapse;margin-top:6px"><thead><tr>${E.chartHead.map((x) => `<th style="text-align:left;padding:2px 10px 2px 0;color:var(--lab-dim)">${esc(x)}</th>`).join('')}</tr></thead><tbody>${ph.map((p) => `<tr><td style="padding:2px 10px 2px 0">${esc(p.name)}</td><td>${p.planned}</td><td>${p.logged}</td></tr>`).join('')}</tbody></table></details></div>`
  }

  // the spec's sale-confirmation flow: evaluate → accept → pay → confirm → three outcomes, and a
  // timeout that checks get_transaction before the agent tells the customer anything
  function diagram() {
    const box = (x, y, w, t, c = 'var(--lab-fg)') => `<rect x="${x}" y="${y}" width="${w}" height="26" fill="var(--lab-bg)" stroke="${c}"/><text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" fill="${c}">${esc(t)}</text>`
    const arrow = (x1, y1, x2, y2, dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--lab-line)"${dash ? ' stroke-dasharray="3 3"' : ''} marker-end="url(#nbArrow)"/>`
    const steps = ['evaluate_offer', 'accept', 'request_payment', 'payment_status', 'confirm_sale']
    const xs = [0, 128, 222, 362, 498], ws = [118, 84, 130, 126, 110]
    let s = ''
    steps.forEach((t, i) => { s += box(xs[i], 20, ws[i], t); if (i) s += arrow(xs[i - 1] + ws[i - 1], 33, xs[i] - 2, 33) })
    const outs = [['committed', 'var(--lab-builds)'], ['reserved', 'var(--lab-ar)'], ['rejected', 'var(--lab-dim)']]
    outs.forEach(([t, c], i) => { const y = 92 + i * 34; s += box(420, y, 110, t, c); s += arrow(553, 46, 532, y + 6) })
    s += box(150, 160, 150, 'get_transaction', 'var(--lab-hi)')
    s += arrow(520, 46, 302, 166, true)
    s += `<text x="352" y="118" fill="var(--lab-dim)">${esc(E.diagramTimeout)}</text>`
    return `<div style="padding:12px"><svg viewBox="-4 0 620 200" style="width:100%;height:auto;display:block;aspect-ratio:620/200" role="img" aria-label="${esc([...steps, ...outs.map((o) => o[0]), 'get_transaction'].join(' → '))}"><defs><marker id="nbArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="var(--lab-line)"/></marker></defs><g style="font-family:var(--mono);font-size:11px">${s}</g></svg></div>`
  }

  X.hydrate = (root) => {
    for (const t of root.querySelectorAll('.nb-try')) {
      const out = t.querySelector('.nb-try__out')
      const calc = () => {
        const v = Object.fromEntries([...t.querySelectorAll('[data-try]')].map((i) => [i.dataset.try, +i.value]))
        const margin = (v.unit - v.floor) / (v.list - v.floor), surplus = (v.unit - v.floor) / (v.reservation - v.floor)
        const f = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—')
        out.innerHTML = `<span>${esc(E.tryOut.margin)} = (${v.unit} − ${v.floor}) / (${v.list} − ${v.floor}) = <b data-out="margin">${f(margin)}</b> · ${esc(margin < 0.1 ? E.tryOut.warn : E.tryOut.ok)}</span><span>${esc(E.tryOut.surplus)} = (${v.unit} − ${v.floor}) / (${v.reservation} − ${v.floor}) = <b data-out="surplus">${f(surplus)}</b></span>`
      }
      t.addEventListener('input', calc)
      calc()
    }
    for (const term of root.querySelectorAll('.nb-term')) {
      const pre = term.querySelector('.nb-term__out'), src = pre.dataset.src
      let timer = 0
      term.addEventListener('click', (e) => {
        const b = e.target.closest('[data-term]')
        if (!b) return
        if (b.dataset.term === 'copy') {
          const cmds = src.split('\n').filter((l) => /^\$ /.test(l)).map((l) => l.slice(2)).join('\n')
          try { navigator.clipboard.writeText(cmds) } catch { /* no clipboard */ }
          b.textContent = E.copied
          setTimeout(() => (b.textContent = E.copy), 1200)
        }
        if (b.dataset.term === 'speed') { const s = b.dataset.speed === '1' ? 2 : b.dataset.speed === '2' ? 4 : 1; b.dataset.speed = s; b.textContent = E.speed(s); b.setAttribute('aria-label', E.speedLabel(s)) }
        if (b.dataset.term === 'replay') {
          clearTimeout(timer)
          if (reduced()) { pre.textContent = src; return }
          const speed = +term.querySelector('[data-term="speed"]').dataset.speed
          let i = 0
          const step = () => {
            i = Math.min(src.length, i + 1)
            pre.textContent = src.slice(0, i) + (i < src.length ? '▌' : '')
            if (i < src.length) timer = setTimeout(step, (src[i - 1] === '\n' ? 260 : 28) / speed)
          }
          step()
        }
      })
    }
  }
})()
