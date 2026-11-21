/*
 * prototype/lab/notebook/model.js: the vault, as a pure function of its files. No DOM, no clock.
 * check.mjs runs all of it in Node; the React build ports it to lib/lab/vault.ts.
 *
 *   NB.model.build({ files, study, essays, copy, autolink, hidden }) → vault
 *     files   { 'agent-reliability/shopkeeper/01-spec.md': text, … }   (vault.js)
 *     study   the tracker's public parts (study.js): topics, stages, log, phases
 *     essays  the two Medium essays' bodies (essay.js), keyed by a post's `essay`
 *
 *   vault.notes                     every visible note, in tree order
 *   vault.get(route)                a note by its route ('' is start-here)
 *   vault.resolve(target, from)     an ID, alias, route, or the shortest unique slug path → note
 *   vault.href(note, query)         '#/agent-reliability/shopkeeper/01-spec?w=W1'
 *   vault.out(note) / .back(note)   links out / backlinks: [{ note, kind, context }]
 *   vault.edges                     [{ a, b, kind: 'link' | 'typed' | 'tour' }], deduplicated
 *   vault.neighbours(note, depth)   the local graph: [{ note, hop }]
 *   vault.tree                      the folder tree for the sidebar
 *   vault.tours, .tourStep(note, w) walkthroughs, and where a note sits in one
 *   vault.prevNext(note, w)         { prev, next, up } in the tour, else in the folder
 *   vault.clock(note)               { read, listen } minutes, from the note's own text
 *   vault.totals(tour)              { n, read, listen }: sums of the steps' clocks
 *   vault.blockMd(note, id)         a computed block (studying now, tours, …) as Markdown
 *   vault.match(input)              the switcher: notes best first ('T02' exact first, #tag filters)
 *   vault.problems                  what the validator found: dangling links, bad names, …
 *
 * VISIBILITY. Every note (and every tracker item) has `visibility: public | hidden`. A hidden
 * note leaves the tree, the graph, the switcher and every backlink; a link to it reads as plain
 * text. `hidden: true` (the mockup's ?hidden=1) shows them, marked.
 */
;(() => {
  const root_ = typeof window !== 'undefined' ? window : globalThis
  const NB = (root_.NB = root_.NB || {})
  const M = () => NB.md

  const SECTIONS = ['agent-reliability', 'builds', 'writing']
  const TYPES = ['hub', 'doc', 'topic', 'stage', 'build', 'post', 'walkthrough', 'log']
  const STATUSES = ['done', 'final', 'live', 'progress', 'planned', 'parked', 'published', 'stub']
  const REQUIRED = {
    all: ['title', 'type', 'status', 'updated', 'summary', 'tags', 'aliases', 'listen', 'visibility'],
    topic: ['id', 'track', 'est_h', 'learn'], stage: ['id', 'ship'], doc: ['project'], build: ['stack', 'links'],
    post: ['date', 'source', 'href', 'entry'], walkthrough: ['id', 'steps'], hub: [], log: [],
  }
  const FILE = /^(\d{2}-[a-z0-9-]+|T\d{2}|PW\d|W\d(-[a-z0-9-]+)?)\.md$/
  // read: every word counts, prose at 200 wpm and table cells at 120 (a table is read slower)
  const WPM_READ = 200, WPM_CELL = 120, WPM_LISTEN = 150
  // the Shopkeeper's row IDs: rules P1–P13 and scenarios A1–C12
  const ROW_SCOPES = { 'agent-reliability/shopkeeper': /P\d{1,2}|[ABC]\d{1,2}/ }
  // where a track's folder sits, and the study's own folder
  const STUDY = 'agent-reliability/study'
  const TRACK_ORDER = ['evals', 'observability', 'reliability', 'latency', 'voice', 'guardrails', 'fde', 'open-source']
  const ROOT_ORDER = ['agent-reliability', 'builds', 'writing', 'walkthroughs']

  const PART_NUM = /^\d+\s*·\s*/
  const iso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s))
  const round1 = (n) => Math.round(n * 10) / 10
  const minutes = (n) => Math.max(1, Math.round(n))

  function build({ files, study, essays = {}, copy, autolink = true, hidden = false }) {
    const C = copy
    const problems = []
    const raw = []

    // ── 1. every note, from a file or from the tracker ───────────────────────────────────
    for (const [file, text] of Object.entries(files)) {
      const name = file.split('/').pop()
      if (!FILE.test(name)) problems.push(`${file}: the filename does not match the numbering pattern`)
      let fm
      try { fm = M().frontmatter(text) } catch (e) { problems.push(`${file}: ${e.message}`); continue }
      raw.push({ file, fm: fm.data, body: fm.body })
    }
    // a topic's or stage's optional .md adds "my notes" to the generated note
    const extra = Object.fromEntries(raw.filter((r) => /^(T\d\d|PW\d)\.md$/.test(r.file.split('/').pop())).map((r) => [r.file.split('/').pop().slice(0, -3), r]))
    const notes = []
    for (const r of raw) {
      const name = r.file.split('/').pop().slice(0, -3)
      if (extra[name] === r) continue
      notes.push(fromFile(r, name))
    }
    for (const t of study.topics) notes.push(topicNote(t))
    for (const s of study.stages) notes.push(stageNote(s))
    notes.push(logNote())

    function fromFile(r, name) {
      const parts = r.file.slice(0, -3).split('/')
      parts.pop()
      const folder = parts.join('/')
      const m = /^(\d{2})-(.+)$/.exec(name)
      const isHub = m && m[1] === '00'
      const num = m ? m[1] : (/^(W\d)/.exec(name) || [])[1] || name
      const slug = m ? m[2] : name.replace(/^W\d-?/, '') || name
      const id = r.fm.id || (/^(T\d\d|PW\d|W\d)/.exec(name) || [])[1] || ''
      // a hub's route is its folder; the root hub (00-start-here) is the empty route
      const route = isHub ? folder : (folder ? folder + '/' : '') + name
      let body = r.body
      if (r.fm.type === 'post' && r.fm.essay) body = postBody(r.fm, essays[r.fm.essay])
      return note({ file: r.file, folder, num, slug: isHub ? (folder.split('/').pop() || slug) : slug, id, route, isHub, fm: r.fm, body })
    }
    function postBody(fm, essay) {
      if (!essay) { problems.push(`${fm.title}: its essay "${fm.essay}" is not in essay.js`); return '' }
      const host = (/^https?:\/\/([^/]+)/.exec(fm.href) || [])[1] || fm.href
      return `## ${C.partHead(2, C.parts.post[2])}\n\n${fm.summary}\n\n[${C.readOn(host)} ${C.external}](${fm.href})\n\n## ${C.partHead(5, C.parts.post[5])}\n\n${essay.body}`
    }
    function topicNote(t) {
      const folder = `${STUDY}/${t.track}`
      const P = C.parts.topic, log = study.log.filter((r) => r.id === t.id)
      const lines = [`## ${C.partHead(2, P[2])}`, '', t.learn, '', `## ${C.partHead(4, P[4])}`, '', `- ${C.hours(t.spent_h, t.est_h)}`]
      if (t.finished) lines.push(`- ${C.finishedOn(t.finished)}`)
      if (t.start && t.target) lines.push(`- ${C.window(t.start, t.target)}`)
      lines.push('')
      if (log.length) {
        lines.push(`| ${C.logHead.join(' | ')} |`, `| ${C.logHead.map(() => '---').join(' | ')} |`)
        for (const r of log) lines.push(`| ${r.date} | ${r.id} | ${r.h} | ${r.did.replace(/\|/g, '\\|')} |`)
        lines.push('')
      }
      const five = []
      if (t.resource) { const host = (/^https?:\/\/([^/]+)/.exec(t.resource) || [])[1] || t.resource; five.push(`- ${C.resource}: [${host} ${C.external}](${t.resource})`) }
      if (t.proof.length) five.push(`- ${C.proofOf}: ${t.proof.map((p) => `[[${p}]]`).join(', ')}`)
      if (five.length) lines.push(`## ${C.partHead(5, P[5])}`, '', ...five, '')
      const mine = extra[t.id]
      if (mine && mine.body.trim()) lines.push(`## ${C.myNotes}`, '', mine.body.trim(), '')
      const fm = {
        title: t.title, type: 'topic', status: t.parked ? 'parked' : t.status, updated: t.finished || (log.length ? log[log.length - 1].date : ''),
        summary: t.learn, tags: ['study', t.track], aliases: [], listen: true, visibility: t.visibility,
        id: t.id, track: t.trackName, phase: t.phase, est_h: t.est_h, spent_h: t.spent_h, start: t.start, target: t.target, finished: t.finished,
        learn: t.learn, resource: t.resource, proof: t.proof,
      }
      return note({ file: null, folder, num: t.id, slug: t.id, id: t.id, route: `${folder}/${t.id}`, fm, body: lines.join('\n'), generated: 'study' })
    }
    function stageNote(s) {
      const shop = s.topics.length && s.id !== 'PW6'
      const folder = shop ? 'agent-reliability/shopkeeper' : `${STUDY}/open-source`
      const P = C.parts.stage
      const lines = [`## ${C.partHead(2, P[2])}`, '', s.ship, '', `## ${C.partHead(4, P[4])}`, '', C.noRuns, '', `## ${C.partHead(5, P[5])}`, '', s.topics.map((x) => `[[${x}]]`).join(' · '), '']
      if (s.link) lines.push(`## ${C.partHead(6, P[6])}`, '', `[${s.link} ${C.external}](${s.link})`, '')
      const mine = extra[s.id]
      if (mine && mine.body.trim()) lines.push(`## ${C.myNotes}`, '', mine.body.trim(), '')
      const fm = {
        title: s.title.replace(/^Shopkeeper:?\s*/i, '').replace(/^Shopkeeper (v0|on voice)/i, '$1'), fullTitle: s.title, type: 'stage', status: s.status, updated: '', summary: s.ship.split(/(?<=\.)\s/)[0],
        tags: ['shopkeeper', 'stage'], aliases: [], listen: true, visibility: s.visibility, id: s.id, project: shop ? 'shopkeeper' : '', topics: s.topics, phase: s.phase, target: s.target, ship: s.ship,
      }
      return note({ file: null, folder, num: s.id, slug: s.id, id: s.id, route: `${folder}/${s.id}`, fm, body: lines.join('\n'), generated: 'study' })
    }
    function logNote() {
      const lines = [`| ${C.logHead.join(' | ')} |`, `| ${C.logHead.map(() => '---').join(' | ')} |`]
      for (const r of study.log) lines.push(`| ${r.date} | ${r.id} | ${r.h} | ${r.did.replace(/\|/g, '\\|')} |`)
      const last = study.log.length ? study.log[study.log.length - 1].date : ''
      const fm = { title: 'log', type: 'log', status: 'progress', updated: last, summary: C.blocks.progress ? `${study.log.length} sessions` : '', tags: ['study'], aliases: [], listen: true, visibility: 'public' }
      return note({ file: null, folder: STUDY, num: 'log', slug: 'log', id: '', route: `${STUDY}/log`, fm, body: study.log.length ? lines.join('\n') : C.logRowsNone, generated: 'study' })
    }
    function note({ file, folder, num, slug, id, route, isHub, fm, body, generated }) {
      // a part's number is a schema the reader never sees: the heading keeps its name only
      const blocks = M().parse(body).map((b) => (b.t === 'h' && PART_NUM.test(b.text) ? { ...b, text: b.text.replace(PART_NUM, '') } : b))
      const section = route === '' ? 'root' : SECTIONS.includes(route.split('/')[0]) ? route.split('/')[0] : route.split('/')[0] === 'walkthroughs' ? 'tours' : 'root'
      return {
        file, folder, num, slug, id, route, isHub: !!isHub || (fm.type === 'hub'), fm, body, blocks, generated: generated || '', section,
        title: String(fm.title || slug), type: fm.type, status: fm.status, visibility: fm.visibility === 'hidden' ? 'hidden' : 'public',
        tags: fm.tags || [], aliases: fm.aliases || [], updated: fm.updated || '', summary: fm.summary || '',
        // the slug path: the folders, then the slug (the number never is part of it)
        slugPath: [...(isHub ? folder.split('/').slice(0, -1) : folder ? folder.split('/') : []), slug].filter(Boolean).join('/'),
      }
    }

    // ── 2. checks on the notes themselves ─────────────────────────────────────────────────
    for (const n of notes) {
      const where = n.file || n.route
      for (const k of [...REQUIRED.all, ...(REQUIRED[n.type] || [])]) if (n.fm[k] === undefined || n.fm[k] === '' && !['summary', 'updated', 'phase'].includes(k)) problems.push(`${where}: "${k}" is missing`)
      if (!TYPES.includes(n.type)) problems.push(`${where}: type "${n.type}" is not one of ${TYPES.join(', ')}`)
      if (!STATUSES.includes(n.status)) problems.push(`${where}: status "${n.status}" is not one of ${STATUSES.join(', ')}`)
      if (n.updated && !iso(n.updated)) problems.push(`${where}: updated "${n.updated}" is not a date`)
      if (String(n.summary).length > 200 || (String(n.summary).match(/[.!?](\s|$)/g) || []).length > 2) problems.push(`${where}: the summary is over 200 characters or 2 sentences`)
      if (n.type === 'post' && !n.fm.entry) problems.push(`${where}: a post must set "entry" (a note, or none)`)
      if (n.isHub && n.num !== '00' && n.route !== '') problems.push(`${where}: a hub must be numbered 00`)
      if (!n.isHub && n.num === '00') problems.push(`${where}: 00 is only for hubs`)
      for (const b of n.blocks) if (b.t === 'fence' && !M().FENCES.includes(b.kind)) problems.push(`${where}: unknown fence "${b.kind}"`)
      for (const b of n.blocks) if (b.t === 'fence' && b.kind === 'clip' && !(+b.attrs.dur >= 15 && +b.attrs.dur <= 60)) problems.push(`${where}: a clip's dur must be 15–60`)
    }
    const seen = new Map()
    for (const n of notes) {
      for (const k of [n.route, n.id, ...n.aliases].filter((x) => x !== '' && x != null)) {
        if (k === n.route && n.route === '' ) continue
        if (seen.has(k) && seen.get(k) !== n) problems.push(`"${k}" names two notes: ${seen.get(k).route} and ${n.route}`)
        seen.set(k, n)
      }
      const sib = notes.filter((o) => o !== n && o.folder === n.folder && o.num === n.num && !o.isHub && !n.isHub)
      if (sib.length) problems.push(`${n.route}: its number ${n.num} is used twice in ${n.folder}`)
    }
    for (const n of notes) for (const a of n.aliases) if (notes.some((o) => o.route === a)) problems.push(`${n.route}: alias "${a}" shadows a real path`)

    // ── 3. visibility ───────────────────────────────────────────────────────────────────
    const all = notes
    const shown = notes.filter((n) => hidden || n.visibility === 'public')

    // ── 4. resolving ────────────────────────────────────────────────────────────────────
    const byRoute = new Map(shown.map((n) => [n.route, n]))
    const byKey = new Map()
    const ambiguous = new Set()
    const index = (k, n) => { if (!k) return; const x = k.toLowerCase(); if (byKey.has(x) && byKey.get(x) !== n) ambiguous.add(x); else byKey.set(x, n) }
    for (const n of all) {
      if (n.id) index(n.id, n)
      for (const a of n.aliases) index(a, n)
      const segs = n.slugPath.split('/')
      for (let i = 0; i < segs.length; i++) index(segs.slice(i).join('/'), n)
    }
    const resolveAny = (target) => {
      const t = String(target || '').replace(/^\/+|\/+$/g, '')
      if (all.some((n) => n.route === t)) return all.find((n) => n.route === t)
      const k = t.toLowerCase()
      if (ambiguous.has(k)) return null
      return byKey.get(k) || null
    }
    const visible = (n) => n && (hidden || n.visibility === 'public') ? n : null
    const resolve = (target) => visible(resolveAny(target))
    const href = (n, q) => `#/${n.route}${q ? '?' + q : ''}`

    // ── 5. links, typed links and tour steps → edges and backlinks ───────────────────────
    const out = new Map(all.map((n) => [n, []]))
    const back = new Map(all.map((n) => [n, []]))
    const edges = []
    const edgeKey = new Map()
    const addEdge = (a, b, kind) => {
      if (!a || !b || a === b) return
      const k = [a.route, b.route].sort().join('→')
      const rank = { link: 0, typed: 1, tour: 2 }
      if (edgeKey.has(k)) { const e = edgeKey.get(k); if (rank[kind] < rank[e.kind]) e.kind = kind; return }
      const e = { a, b, kind }
      edgeKey.set(k, e)
      edges.push(e)
    }
    const rowNote = new Map()
    for (const n of all) {
      for (const b of n.blocks) if (b.t === 'table') for (const r of b.rows) if (M().ROW_ID.test(r[0])) rowNote.set(`${n.folder}:${r[0]}`, n)
    }
    const rowIdsOf = (n) => ROW_SCOPES[n.folder] || null
    for (const n of all) {
      const ls = M().links(n.blocks, { rowIds: rowIdsOf(n), autolink })
      for (const l of ls) {
        let to = null
        if (l.kind === 'row') to = rowNote.get(`${n.folder}:${l.target}`) || null
        else to = resolveAny(l.target)
        if (!to) { if (l.kind === 'wiki') problems.push(`${n.route || 'start-here'} links to [[${l.target}]], which is not a note`); continue }
        if (l.kind === 'wiki' && l.anchor && !anchorsOf(to).includes(l.anchor.toLowerCase())) problems.push(`${n.route} links to [[${l.target}#${l.anchor}]], which is not a heading or row there`)
        if (to === n || out.get(n).some((x) => x.note === to)) continue
        out.get(n).push({ note: to, kind: 'link', context: l.context })
        back.get(to).push({ note: n, kind: 'link', context: l.context })
      }
      const typed = []
      if (n.type === 'topic') for (const p of n.fm.proof || []) typed.push(p)
      if (n.type === 'stage') for (const p of n.fm.topics || []) typed.push(p)
      if (n.type === 'post' && n.fm.entry && n.fm.entry !== 'none') typed.push(n.fm.entry)
      if ((n.type === 'doc' || n.type === 'stage') && n.fm.project) typed.push(n.fm.project)
      for (const t of typed) {
        const to = resolveAny(t)
        if (!to) { problems.push(`${n.route}: "${t}" in its frontmatter is not a note`); continue }
        if (!out.get(n).some((x) => x.note === to)) { out.get(n).push({ note: to, kind: 'typed', context: '' }); back.get(to).push({ note: n, kind: 'typed', context: '' }) }
      }
    }
    function anchorsOf(n) {
      const a = []
      const used = new Set()
      for (const b of n.blocks) {
        if (b.t === 'h') { const base = M().slugify(M().plain(b.text)); let s = base, k = 2; while (used.has(s)) s = `${base}-${k++}`; used.add(s); a.push(s) }
        if (b.t === 'table') for (const r of b.rows) if (M().ROW_ID.test(r[0])) a.push(r[0].toLowerCase())
      }
      return a
    }

    // ── 6. walkthroughs ─────────────────────────────────────────────────────────────────
    const tours = all.filter((n) => n.type === 'walkthrough').sort((a, b) => a.id.localeCompare(b.id))
    for (const w of tours) {
      w.steps = []
      for (const s of w.fm.steps || []) {
        const to = resolveAny(s)
        if (!to) { problems.push(`${w.id}: step "${s}" is not a note`); continue }
        if (w.steps.includes(to)) problems.push(`${w.id}: step "${s}" repeats`)
        w.steps.push(to)
      }
      if (w.steps.length < 2) problems.push(`${w.id}: a walkthrough needs at least 2 steps`)
      w.steps = w.steps.filter((x) => hidden || x.visibility === 'public')
      for (const s of w.steps) if (!out.get(w).some((x) => x.note === s)) { out.get(w).push({ note: s, kind: 'tour', context: '' }); back.get(s).push({ note: w, kind: 'tour', context: '' }) }
    }
    for (const n of all) for (const l of out.get(n)) addEdge(n, l.note, l.kind)

    // ── 7. what a reader is shown, and the clocks ───────────────────────────────────────
    // the public view drops a placeholder clip and a heading left with nothing under it, so a
    // build opens on what it is; the author view (?hidden=1) keeps every slot
    const reads = new Map()
    const readBlocks = (n) => {
      if (hidden) return n.blocks
      if (reads.has(n)) return reads.get(n)
      const B = n.blocks, isClip = (b) => b && b.t === 'fence' && b.kind === 'clip'
      // a heading whose only content is the clip goes with it (a stub's empty parts stay)
      const kept = B.filter((b, i) => !isClip(b) && !(b.t === 'h' && isClip(B[i + 1]) && (!B[i + 2] || (B[i + 2].t === 'h' && B[i + 2].level <= b.level))))
      reads.set(n, kept)
      return kept
    }
    const clocks = new Map()
    const clock = (n) => {
      if (clocks.has(n)) return clocks.get(n)
      const s = M().stats(readBlocks(n), { lines: C.say, block: (id) => blockSpoken(n, id) })
      const read = s.prose / WPM_READ + s.cells / WPM_CELL
      const v = { read: round1(read), listen: round1(s.spoken / WPM_LISTEN), prose: s.prose, rows: s.rows, cells: s.cells, spoken: s.spoken }
      clocks.set(n, v)
      return v
    }
    const totals = (w) => {
      const r = w.steps.reduce((a, s) => a + clock(s).read, 0), l = w.steps.reduce((a, s) => a + clock(s).listen, 0)
      return { n: w.steps.length, read: minutes(r), listen: minutes(l), readExact: round1(r), listenExact: round1(l) }
    }

    // ── 8. the tree ─────────────────────────────────────────────────────────────────────
    const ORDER = (n) => (n.isHub ? '0' : /^\d\d$/.test(n.num) ? '1' + n.num : /^W\d/.test(n.num) ? '2' + n.num : /^PW\d/.test(n.num) ? '3' + n.num : /^T\d\d/.test(n.num) ? '4' + n.num : '5' + n.num)
    const trackName = Object.fromEntries(study.topics.map((t) => [t.track, t.trackName]))
    function folderNode(path) {
      const kids = shown.filter((n) => n.folder === path && !(n.isHub && n.route === path)).sort((a, b) => ORDER(a).localeCompare(ORDER(b)))
      const hub = shown.find((n) => n.isHub && n.route === path) || null
      const subs = [...new Set(shown.filter((n) => n.folder.startsWith(path ? path + '/' : '') && n.folder !== path).map((n) => n.folder.slice(path ? path.length + 1 : 0).split('/')[0]))]
      const order = path === '' ? ROOT_ORDER : path === STUDY ? TRACK_ORDER : []
      subs.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b))
      const name = path.split('/').pop()
      return { path, name, title: hub ? hub.title : trackName[name] || name, hub, notes: kids, folders: subs.map((s) => folderNode(path ? `${path}/${s}` : s)) }
    }
    const tree = folderNode('')
    const folderTitles = new Map()
    const titles = (f) => { folderTitles.set(f.path, f.title); f.folders.forEach(titles) }
    titles(tree)
    const folderTitle = (path) => folderTitles.get(path) || path.split('/').pop()
    const order = []
    const walk = (f) => { if (f.hub) order.push(f.hub); for (const n of f.notes) order.push(n); for (const s of f.folders) walk(s) }
    walk(tree)

    // ── 9. prev / next / up ─────────────────────────────────────────────────────────────
    const hubOf = (n) => {
      let path = n.isHub ? n.route.split('/').slice(0, -1).join('/') : n.folder
      while (true) {
        const h = shown.find((x) => x.isHub && x.route === path)
        if (h && h !== n) return h
        if (path === '') return n.route === '' ? null : shown.find((x) => x.route === '') || null
        path = path.split('/').slice(0, -1).join('/')
      }
    }
    const tourStep = (n, wid) => {
      const w = tours.find((t) => t.id === wid)
      if (!w) return null
      const i = w.steps.indexOf(n)
      return i < 0 ? null : { tour: w, i, n: w.steps.length }
    }
    function prevNext(n, wid) {
      const ts = wid && tourStep(n, wid)
      if (ts) return { prev: ts.tour.steps[ts.i - 1] || null, next: ts.tour.steps[ts.i + 1] || null, up: ts.tour, tour: ts }
      const list = order.filter((x) => x.folder === n.folder)
      const i = list.indexOf(n)
      return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null, up: hubOf(n), tour: null }
    }

    // ── 10. the local graph ──────────────────────────────────────────────────────────────
    const vis = (l) => (hidden || l.note.visibility === 'public')
    const neighbourList = (n) => {
      const seenN = new Set(), list = []
      for (const l of [...out.get(n), ...back.get(n)].filter(vis)) if (!seenN.has(l.note)) { seenN.add(l.note); list.push(l.note) }
      return list
    }
    function neighbours(n, depth = 1) {
      const res = neighbourList(n).map((note) => ({ note, hop: 1 }))
      if (depth > 1) {
        const have = new Set([n, ...res.map((r) => r.note)])
        for (const r of res.slice()) for (const m of neighbourList(r.note)) if (!have.has(m)) { have.add(m); res.push({ note: m, hop: 2 }) }
      }
      return res
    }

    // ── 11. computed blocks, as Markdown ────────────────────────────────────────────────
    const glyphOf = (n) => (C.status[n.status] || C.status.planned)[0]
    const label = (n) => (n.id ? `${n.id} ${n.title}` : n.isHub ? n.title : `${n.num} ${n.title}`)
    const linkTo = (n, text) => `[[${n.id || n.route || 'index'}|${(text || label(n)).replace(/[|\]]/g, ' ')}]]`
    const phaseTopics = (name) => study.topics.filter((t) => t.phase === name && (hidden || t.visibility === 'public'))
    const current = (() => {
      const lastLog = study.log.length ? study.log[study.log.length - 1] : null
      const t = lastLog && study.topics.find((x) => x.id === lastLog.id)
      return t ? t.phase : study.phases[0] && study.phases[0].name
    })()
    const B = C.blocks
    const tableMd = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
    function blockMd(n, id) {
      const loggedH = round1(study.log.reduce((a, r) => a + r.h, 0))
      const lastDate = study.log.length ? study.log[study.log.length - 1].date : ''
      if (id === 'studying-now') {
        const ts = phaseTopics(current), done = ts.filter((t) => t.status === 'done').length
        const prog = ts.filter((t) => t.status === 'progress')
        const ph = study.log.filter((r) => ts.some((t) => t.id === r.id)).reduce((a, r) => a + r.h, 0)
        return [B.studyingNow(current, done, ts.length, round1(ph), lastDate), '', ...(prog.length ? [`${B.inProgress}: ${prog.map((t) => `${t.id}`).join(' · ')}`] : [])].join('\n')
      }
      if (id === 'tours') return tours.filter((w) => hidden || w.visibility === 'public').map((w) => { const t = totals(w); return `- ${linkTo(w, `${w.id} ${w.title}`)} · ${B.tourLine(t.n, t.read, t.listen)}` }).join('\n')
      if (id === 'latest') {
        return shown.filter((x) => !x.isHub && x.type !== 'walkthrough' && x.type !== 'log' && x.status !== 'stub' && iso(x.updated))
          .sort((a, b) => b.updated.localeCompare(a.updated) || order.indexOf(a) - order.indexOf(b)).slice(0, 5)
          .map((x) => `- ${x.updated} · ${glyphOf(x)} ${linkTo(x)}`).join('\n')
      }
      if (id === 'contents') {
        const f = findFolder(tree, n.route)
        if (!f) return ''
        return [...f.notes.map((x) => `- ${glyphOf(x)} ${linkTo(x)}`), ...f.folders.map((s) => `- ${s.hub ? linkTo(s.hub, s.title + '/') : s.title + '/'}`)].join('\n')
      }
      if (id === 'portfolio-line') return study.portfolioLine
      if (id === 'stages') {
        const ss = shown.filter((x) => x.type === 'stage' && x.fm.project === 'shopkeeper')
        return tableMd(B.stagesHead, ss.map((s) => [s.id, s.title.replace(/\|/g, '\\|'), s.fm.phase || B.unscheduled, s.fm.target, `${glyphOf(s)} ${(C.status[s.status] || [])[1]}`]))
      }
      if (id === 'study-progress') {
        const ts = study.topics.filter((t) => hidden || t.visibility === 'public')
        const active = ts.filter((t) => !t.parked)
        return B.progress(active.length, active.filter((t) => t.status === 'done').length, active.filter((t) => t.status === 'progress').length, ts.filter((t) => t.parked).length, loggedH)
      }
      if (id === 'phases') {
        return tableMd(B.phasesHead, study.phases.map((p) => {
          const ts = phaseTopics(p.name)
          const lh = round1(study.log.filter((r) => ts.some((t) => t.id === r.id)).reduce((a, r) => a + r.h, 0))
          return [p.name, `${p.start} → ${p.end}`, ts.length, ts.filter((t) => t.status === 'done').length, ts.reduce((a, t) => a + t.est_h, 0), lh]
        }))
      }
      if (id === 'tracks') {
        const f = findFolder(tree, STUDY)
        return tableMd(B.tracksHead, (f ? f.folders : []).map((s) => {
          const ts = s.notes.filter((x) => x.type === 'topic')
          return [s.title, ts.length, ts.filter((x) => x.status === 'done').length, `${s.name}/`]
        }))
      }
      if (id === 'steps') {
        return (n.steps || []).map((s, i) => { const c = clock(s); return `${i + 1}. ${glyphOf(s)} ${linkTo(s)} · ${C.stepLine(minutes(c.read), minutes(c.listen))}` }).join('\n')
      }
      if (id === 'gallery') {
        const imgs = n.fm.images || []
        return imgs.map((src, i) => `![${B.gallery(n.title, i + 1, imgs.length)}](${src})`).join('\n')
      }
      problems.push(`${n.route}: unknown block "${id}"`)
      return ''
    }
    function findFolder(f, path) { if (f.path === path) return f; for (const s of f.folders) { const r = findFolder(s, path); if (r) return r } return null }
    // the summary as a TL;DR: shown only when it is a real sentence the body does not already say.
    // why: ok | missing | headings (a ·-joined list of the note's own headings) | repeat
    function ledeOf(n) {
      const s = String(n.summary || '').trim()
      if (!s) return { text: '', why: 'missing' }
      // a part names a heading when it is that heading, or how it starts ("Architecture decision: …")
      const heads = n.blocks.filter((b) => b.t === 'h').map((b) => M().plain(b.text).trim().toLowerCase())
      const names = (x) => heads.some((h) => h === x || (h.startsWith(x) && /^[\s:(—–-]/.test(h.slice(x.length))))
      if (s.split(/\s+·\s+/).every((x) => names(x.trim().toLowerCase()))) return { text: s, why: 'headings' }
      const first = s.split(/(?<=[.!?])\s/)[0].trim().toLowerCase()
      const said = n.blocks.filter((b) => b.t === 'p' || b.t === 'quote').map((b) => M().plain(b.text).toLowerCase()).join(' ')
      if (said.includes(first.replace(/[.!?]$/, ''))) return { text: s, why: 'repeat' }
      return { text: s, why: 'ok' }
    }
    const blockSpoken = (n, id) => M().spoken(M().parse(blockMd(n, id)), { lines: C.say }).map((s) => s.text).join(' ')

    // ── 12. the switcher's matcher ──────────────────────────────────────────────────────
    function match(input) {
      const q = String(input || '').trim()
      if (!q) return order.slice()
      const tag = /^#(\S+)/.exec(q)
      let pool = order
      let rest = q
      if (tag) { pool = order.filter((n) => n.tags.includes(tag[1].toLowerCase())); rest = q.slice(tag[0].length).trim() }
      if (!rest) return pool.slice()
      const lq = rest.toLowerCase(), words = lq.split(/\s+/)
      const score = (n) => {
        const id = (n.id || '').toLowerCase(), title = n.title.toLowerCase(), path = n.route.toLowerCase()
        const hay = [id, title, path, n.slugPath, ...n.tags, ...n.aliases, n.summary.toLowerCase()].join(' ')
        if (id && id === lq) return 0
        if (n.aliases.includes(lq) || n.slug === lq) return 1
        if (title.startsWith(lq) || (id && id.startsWith(lq))) return 2
        if (words.every((w) => title.includes(w))) return 3
        if (words.every((w) => path.includes(w))) return 4
        if (words.every((w) => hay.includes(w))) return 5
        return 9
      }
      return pool.map((n, i) => [score(n), i, n]).filter((x) => x[0] < 9).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2])
    }

    // block-level checks that need the whole vault
    for (const n of all) for (const b of n.blocks) if (b.t === 'fence' && b.kind === 'block') blockMd(n, b.id)
    for (const n of all) for (const b of n.blocks) if (b.t === 'fence' && ['try', 'chart', 'diagram'].includes(b.kind) && !REGISTERED[b.kind].includes(b.id)) problems.push(`${n.route}: ${b.kind} "${b.id}" is not registered`)

    return {
      notes: order, all, tree, edges: edges.filter((e) => (hidden || (e.a.visibility === 'public' && e.b.visibility === 'public'))), tours, problems, study, current,
      get: (route) => byRoute.get(String(route).replace(/^\/+|\/+$/g, '')) || null,
      resolve, href, rowIdsOf, rowHref: (n, id) => { const to = rowNote.get(`${n.folder}:${id}`); return to && visible(to) ? href(to, `a=${id.toLowerCase()}`) : null },
      out: (n) => out.get(n).filter(vis), back: (n) => back.get(n).filter(vis), neighbours, neighbourList,
      tourStep, prevNext, hubOf, clock, totals, readBlocks, ledeOf, folderTitle, blockMd, blockSpoken, match, glyphOf, label, anchorsOf,
    }
  }
  // embeds whose id must name something the mockup knows how to draw
  const REGISTERED = { try: ['margin-capture'], chart: ['study-hours'], diagram: ['sale-confirmation'] }

  // the switcher's `>` prefix: "> voice sam" → { cmd: 'voice sam', head: 'voice', arg: 'sam', known }
  function command(input, list) {
    const m = /^>\s*(.*)$/.exec(String(input || '').trim())
    if (!m) return null
    const cmd = m[1].trim().toLowerCase().replace(/\s+/g, ' ')
    const [head, ...rest] = cmd.split(' ')
    return { cmd, head, arg: rest.join(' '), known: list.some((c) => c.cmd === cmd) }
  }

  NB.model = { build, command, SECTIONS, TYPES, STATUSES, REQUIRED, FILE, REGISTERED, WPM_READ, WPM_CELL, WPM_LISTEN }
})()
