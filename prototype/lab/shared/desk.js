/*
 * prototype/lab/shared/desk.js: the canvas desk, faithful but simplified, for both Lab directions
 * to build on. Needs jet.css + desk.css. Plain script, no library, works over file://.
 *
 *   DESK.mount({ theme, onLab, minScale, publicRoot })  builds the desk into <body>, returns DESK
 *   DESK.world / viewport / backdrop / grid   elements. #deskBackdrop sits behind the world and
 *                     never moves: the place for a fixed starfield or a fade.
 *   DESK.camera      { x, y, s }: screen = world · s + (x, y). Read it; move it with flyTo.
 *   DESK.flyTo(wx, wy, s, ms) → Promise: centre world point (wx, wy) at scale s.
 *   DESK.onFrame(fn) fn(camera, view) on every frame the camera moved, and once at mount.
 *                     view = { cx, cy, w, h }: the world-space centre and size of the screen.
 *   DESK.addLayer(name)   a world-space layer under the cards (for a sky, constellations…)
 *   DESK.cards       { [id]: { el, x, y, w } }: about, work, experience, now, notes, deep-space
 *   DESK.focusCard(id), DESK.fit(), DESK.setTheme('cream' | 'jet')
 *   DESK.deepSpace   { x, y }: eggs.ts's world point, the deep-space card's top-left (the doorway)
 *
 * The rules from CLAUDE.md hold: the camera lives in a plain object and one rAF loop writes
 * world.style.transform; card drags divide by scale; no backdrop-filter inside the world.
 * Engine code is lifted from prototype/index.html (pan, glide, wheel, pinch, zoomAt).
 *
 * Simplified, on purpose: cards sit at fixed spots (the real desk computes them), only the six
 * cards the directions need are on the desk, a dock tile for anything else just bounces, and the
 * Archive card is gone (its pieces live in the Lab's Playground now). Card copy below is
 * transcribed from content/ and content/data/ by a throwaway script, not typed.
 */
;(() => {
  // ── transcribed from content/ (apps.ts, data/profile, data/projects, data/experience, data/now,
  //    notes.ts, eggs.ts). Do not edit by hand: regenerate.
  const C = {
    "apps": [
      {
        "id": "about",
        "label": "About",
        "icon": "about",
        "colour": "#FACC00",
        "tint": "#FEF3BF",
        "width": 520,
        "rotate": -1
      },
      {
        "id": "work",
        "label": "Work",
        "icon": "work",
        "colour": "#A8E6A1",
        "tint": "#E4F7E1",
        "width": 600,
        "rotate": 0.7
      },
      {
        "id": "experience",
        "label": "Experience",
        "icon": "experience",
        "colour": "#FFB4A2",
        "tint": "#FFE6DF",
        "width": 560,
        "rotate": -1.2
      },
      {
        "id": "stack",
        "label": "Stack",
        "icon": "stack",
        "colour": "#A9D6FF",
        "tint": "#E3F1FF",
        "width": 650,
        "rotate": 0.3
      },
      {
        "id": "writing",
        "label": "Writing",
        "icon": "writing",
        "colour": "#D9C2FF",
        "tint": "#F0E8FF",
        "width": 520,
        "rotate": -0.8
      },
      {
        "id": "archive",
        "label": "Archive",
        "icon": "archive",
        "colour": "#FFD9A8",
        "tint": "#FFF0DC",
        "width": 560,
        "rotate": 0.8
      },
      {
        "id": "resume",
        "label": "Résumé",
        "icon": "resume",
        "colour": "#FFE0A3",
        "tint": "#FFF3DC",
        "width": 470,
        "rotate": 0.9
      },
      {
        "id": "themes",
        "label": "Themes",
        "icon": "themes",
        "colour": "#FFC2E2",
        "tint": "#FFE7F3",
        "width": 600,
        "rotate": -0.4
      },
      {
        "id": "contact",
        "label": "Contact",
        "icon": "contact",
        "colour": "#B8F2E6",
        "tint": "#E6FBF7",
        "width": 480,
        "rotate": 0.6
      },
      {
        "id": "contributions",
        "label": "Contributions",
        "icon": "graph",
        "colour": "#8FD694",
        "tint": "#E4F4E5",
        "width": 660,
        "rotate": 0.5
      },
      {
        "id": "now",
        "label": "Now",
        "icon": "now",
        "colour": "#C9E4C5",
        "tint": "#E9F5E7",
        "width": 520,
        "rotate": -0.9
      },
      {
        "id": "tutorial",
        "label": "How it works",
        "icon": "tutorial",
        "colour": "#F7D9B0",
        "tint": "#FCEFDE",
        "width": 540,
        "rotate": 0.6
      },
      {
        "id": "visitors",
        "label": "Visitors",
        "icon": "visitors",
        "colour": "#BCC7F5",
        "tint": "#E7EBFC",
        "width": 560,
        "rotate": -0.5
      },
      {
        "id": "notes",
        "label": "Notes",
        "icon": "notes",
        "colour": "#E6D3B3",
        "tint": "#F5EBDB",
        "width": 520,
        "rotate": -0.6
      },
      {
        "id": "arcade",
        "label": "Arcade",
        "icon": "arcade",
        "colour": "#DCE8A0",
        "tint": "#F1F6DC",
        "width": 460,
        "rotate": 0.4
      }
    ],
    "dockLayout": [
      {
        "kind": "app",
        "id": "about"
      },
      {
        "kind": "app",
        "id": "work"
      },
      {
        "kind": "app",
        "id": "experience"
      },
      {
        "kind": "app",
        "id": "stack"
      },
      {
        "kind": "app",
        "id": "contact"
      },
      {
        "kind": "folder",
        "id": "words",
        "label": "Words",
        "icon": "words",
        "colour": "#D9C2FF",
        "items": [
          "writing",
          "archive",
          "resume"
        ]
      },
      {
        "kind": "folder",
        "id": "live",
        "label": "Live",
        "icon": "live",
        "colour": "#BCC7F5",
        "items": [
          "contributions",
          "visitors",
          "now",
          "notes"
        ]
      },
      {
        "kind": "app",
        "id": "arcade"
      },
      {
        "kind": "app",
        "id": "themes"
      },
      {
        "kind": "app",
        "id": "tutorial"
      }
    ],
    "profile": {
      "name": "Aahil Khan",
      "initials": "AK",
      "role": {
        "prefix": "Full stack engineer,",
        "emphasis": "AI retrieval & agents"
      },
      "location": "Bareilly, India",
      "intro": "I build AI stuff and anything else I find interesting, RAG pipelines, multi agent systems, Full Stack apps, and generally anything that looks shiny at 2AM in the morning :)",
      "notes": [
        "Right now I split my time between two internships: building production AI systems at Oddmind Innovations, and working on accent invariant speech research with Samsung PRISM",
        "I like building things, breaking them, and occasionally wondering why I decided to build them in the first place"
      ],
      "deskWelcome": "Almost forgot, Welcome to the site! Leave a note if you like it :D",
      "email": "aahilminookhan@gmail.com",
      "links": [
        {
          "label": "GitHub",
          "href": "https://github.com/aahil-khan"
        },
        {
          "label": "LinkedIn",
          "href": "https://www.linkedin.com/in/aahil-khan77/"
        },
        {
          "label": "Email",
          "href": "mailto:aahilminookhan@gmail.com"
        }
      ]
    },
    "projects": [
      {
        "slug": "holt",
        "name": "Holt",
        "tagline": "Will this repo merge your PR?",
        "year": 2026,
        "kind": "Product"
      },
      {
        "slug": "sop-opera",
        "name": "SOP Opera",
        "tagline": "Agentic industrial safety intelligence",
        "year": 2026,
        "kind": "System"
      },
      {
        "slug": "flowsync",
        "name": "FlowSync AI",
        "tagline": "Project memory for coding agents, over MCP",
        "year": 2025,
        "kind": "System"
      },
      {
        "slug": "konta",
        "name": "Konta",
        "tagline": "Local-first context aware browsing",
        "year": 2025,
        "kind": "Product"
      }
    ],
    "jobs": [
      {
        "role": "Research Intern",
        "company": "Samsung PRISM",
        "period": "Jul 2026 – present",
        "year": 2026
      },
      {
        "role": "Full Stack AI Intern",
        "company": "Oddmind Innovations",
        "period": "Apr 2026 – present",
        "year": 2026
      },
      {
        "role": "Backend Engineer",
        "company": "Datesheet Generator",
        "period": "Mar – Jul 2025",
        "year": 2025
      },
      {
        "role": "Team Lead / Full-stack",
        "company": "Thapar EduTube",
        "period": "Oct 2024 – Jan 2025",
        "year": 2024
      },
      {
        "role": "Full-Stack Developer",
        "company": "Thapar Examinations",
        "period": "Sept - Oct 2026",
        "year": 2026
      }
    ],
    "now": {
      "updated": "2026-08",
      "lede": "A snapshot, short and sweet.",
      "items": [
        {
          "label": "Building",
          "what": "Holt, started as a simple CLI, evolved into a TUI, and is now being shipped as a full web dashboard."
        },
        {
          "label": "Also Looking into",
          "what": "Gnome extensions, love 'em to death, going to publish some of my own too"
        },
        {
          "label": "Thinking about",
          "what": "Increasing OSS contributions, boy is it getting competetive"
        }
      ]
    },
    "notes": {
      "lede": "Leave something behind.",
      "placeholder": "Say something…",
      "submit": "Pin it",
      "empty": "Nothing here yet",
      "emptyHint": "Be the first to pin a note."
    },
    "deepSpace": {
      "lede": "You went looking!",
      "body": "Most people never pan this far out. There's nothing useful here, thats the point :)",
      "claim": "I found it",
      "at": {
        "x": 3800,
        "y": -2400
      }
    },
    "site": "The site"
  }

  // 24×24, 2px round strokes, currentColor: components/desktop/app-icon.tsx, plus `lab` (new).
  const ICONS = {
    about: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    work: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V8"/>',
    experience: '<path d="M6 4v16"/><circle cx="6" cy="8" r="2"/><circle cx="6" cy="16" r="2"/><path d="M11 8h8M11 16h6"/>',
    stack: '<path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="m3 12.5 9 4.5 9-4.5"/><path d="m3 17 9 4.5L21 17"/>',
    contact: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    words: '<path d="M7 3h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v4h4"/><path d="M8.5 12h7M8.5 15.5h4.5"/>',
    live: '<path d="M3 12h4l2.5-6 4 12L16 12h5"/>',
    arcade: '<rect x="4" y="3" width="16" height="13" rx="2"/><path d="M8 19h8M10 16v3M14 16v3"/><circle cx="12" cy="8" r="1.6"/><path d="M12 9.6V12"/>',
    themes: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17V3.5Z" fill="currentColor" stroke="none"/>',
    tutorial: '<path d="M5.5 3.5 12 20l2.2-5.8L20 12 5.5 3.5Z"/><path d="M3.6 9.3 2 8.8M4.6 6.2 3.4 5M8.8 4.6 8.3 3"/>',
    writing: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M14.5 6.5l3 3"/>',
    resume: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    graph: '<rect x="3" y="4" width="5" height="5" rx="1"/><rect x="10" y="4" width="5" height="5" rx="1"/><rect x="3" y="11" width="5" height="5" rx="1"/><rect x="17" y="11" width="4" height="5" rx="1"/><rect x="10" y="11" width="5" height="5" rx="1"/><rect x="3" y="18" width="12" height="2.5" rx="1"/>',
    visitors: '<path d="M4 20V13.5M9.33 20V9M14.67 20v-8M20 20V4.5"/>',
    now: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    notes: '<path d="M5 4h14v11l-4 5H5V4Z"/><path d="M19 15h-4v5"/><path d="M8.5 9h7M8.5 12.5h4"/>',
    // new: three stars joined by a constellation line
    lab: '<path d="m5 17 6-6 7 2" stroke-width="1.5"/><path d="M5 14.6 5.8 16.2 7.4 17 5.8 17.8 5 19.4 4.2 17.8 2.6 17 4.2 16.2Z" fill="currentColor"/><circle cx="11" cy="11" r="1.8" fill="currentColor" stroke="none"/><path d="M18 9.6l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z" fill="currentColor" stroke="none"/><path d="M15 4.5h.01M20 5.5h.01M8 5h.01"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    linkedin: '<path fill="currentColor" stroke="none" d="M6.94 8.5v11.5H3.5V8.5h3.44Zm.23-3.35a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20.5 14.2V20h-3.43v-5.4c0-1.36-.49-2.28-1.7-2.28-.93 0-1.48.62-1.72 1.22-.09.22-.11.52-.11.82V20H10.1s.05-10.42 0-11.5h3.44v1.63c.45-.7 1.27-1.7 3.1-1.7 2.26 0 3.96 1.48 3.96 4.66Z"/>',
  }
  const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`

  // PROPOSED: the Lab's dock tile. A night tile on any desk theme; the label is the working name.
  const LAB_TILE = { id: 'lab', label: 'Lab', icon: 'lab', colour: '#141414' }
  // Fixed spots for this mockup (world px, card top-left; the hero is centred on 0,0).
  const SPOTS = { about: [-930, -330], work: [380, -80], experience: [-900, 170], now: [420, -560], notes: [-170, 300] }
  const ON_DESK = Object.keys(SPOTS)

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const rich = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const app = (id) => C.apps.find((a) => a.id === id)

  const BODIES = {
    about: () => `<p class="lede">${esc(C.profile.intro)}</p>` + C.profile.notes.map((n) => `<p>${esc(n)}</p>`).join('') +
      `<p>${esc(C.profile.deskWelcome)}</p><p><a href="mailto:${esc(C.profile.email)}">${esc(C.profile.email)}</a></p>` +
      `<div>${C.profile.links.map((l) => `<span class="desk-chip" style="--t:${app('about').tint}">${esc(l.label)}</span>`).join('')}</div>`,
    work: () => C.projects.map((p) => `<div class="desk-row"><span class="desk-row__yr">${p.year}</span><span><span class="desk-row__ttl">${esc(p.name)}</span>` +
      `<span class="desk-row__sub">${esc(p.tagline)}</span></span><span class="desk-chip desk-row__tag" style="--t:${app('work').tint}">${esc(p.kind)}</span></div>`).join(''),
    experience: () => C.jobs.map((j) => `<div class="desk-row"><span class="desk-row__yr">${j.year}</span><span><span class="desk-row__ttl">${esc(j.role)}</span>` +
      `<span class="desk-row__sub">${esc(j.company)} · ${esc(j.period)}</span></span></div>`).join(''),
    now: () => `<p class="lede">${esc(C.now.lede)}</p><dl class="desk-kv">` + C.now.items.map((i) => `<dt>${esc(i.label)}</dt><dd>${esc(i.what)}</dd>`).join('') + '</dl>',
    notes: () => `<p class="lede">${esc(C.notes.lede)}</p><textarea class="desk-field" placeholder="${esc(C.notes.placeholder)}" disabled></textarea>` +
      `<button class="desk-btn" type="button" disabled>${esc(C.notes.submit)}</button><div class="desk-empty"><b>${esc(C.notes.empty)}</b><span>${esc(C.notes.emptyHint)}</span></div>`,
    'deep-space': () => `<h2>${esc(C.deepSpace.lede)}</h2><p>${esc(C.deepSpace.body)}</p><button class="desk-btn" type="button">${esc(C.deepSpace.claim)}</button>`,
  }

  const MIN_DEFAULT = 0.12, MAX_SCALE = 2
  const cam = { x: 0, y: 0, s: 1 }
  const frameFns = []
  let dirty = true, glideRAF = 0, flyRAF = 0, zTop = 10, opts = {}
  const reduced = () => (window.LAB && LAB.sky ? LAB.sky.reduced : matchMedia('(prefers-reduced-motion: reduce)').matches)
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }

  const DESK = (window.DESK = { camera: cam, cards: {}, deepSpace: C.deepSpace.at, content: C })
  const view = () => ({ cx: (innerWidth / 2 - cam.x) / cam.s, cy: (innerHeight / 2 - cam.y) / cam.s, w: innerWidth / cam.s, h: innerHeight / cam.s })
  const clampS = (s) => Math.min(MAX_SCALE, Math.max(opts.minScale || MIN_DEFAULT, s))
  const stop = () => { cancelAnimationFrame(glideRAF); cancelAnimationFrame(flyRAF) }
  const zoomAt = (px, py, next) => {
    const s = clampS(next)
    if (s === cam.s) return
    const wx = (px - cam.x) / cam.s, wy = (py - cam.y) / cam.s
    Object.assign(cam, { s, x: px - wx * s, y: py - wy * s })
    dirty = true
  }

  DESK.onFrame = (fn) => { frameFns.push(fn); if (DESK.world) fn(cam, view()) }
  DESK.flyTo = (wx, wy, s = cam.s, ms = 620) => new Promise((done) => {
    stop()
    const to = { s: clampS(s) }
    if (reduced() || ms <= 0) {
      Object.assign(cam, { s: to.s, x: innerWidth / 2 - wx * to.s, y: innerHeight / 2 - wy * to.s })
      dirty = true
      return done()
    }
    const v0 = view(), ls0 = Math.log(cam.s), ls1 = Math.log(to.s), t0 = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), k = p === 1 ? 1 : 1 - Math.pow(2, -10 * p) // ≈ (0.16, 1, 0.3, 1)
      const cs = Math.exp(ls0 + (ls1 - ls0) * k), cx = v0.cx + (wx - v0.cx) * k, cy = v0.cy + (wy - v0.cy) * k
      Object.assign(cam, { s: cs, x: innerWidth / 2 - cx * cs, y: innerHeight / 2 - cy * cs })
      dirty = true
      if (p < 1) flyRAF = requestAnimationFrame(step)
      else done()
    }
    flyRAF = requestAnimationFrame(step)
  })

  DESK.addLayer = (name) => {
    const layer = h('div', 'desk-layer')
    layer.dataset.layer = name
    DESK.world.insertBefore(layer, DESK.grid.nextSibling)
    return layer
  }
  DESK.setTheme = (id) => {
    document.documentElement.dataset.theme = id
    if (DESK.themeBtn) DESK.themeBtn.textContent = (id === 'jet' ? 'Jet' : 'Cream') + ' ▾'
  }

  const rect = (c) => ({ x: c.x, y: c.y, w: c.w, h: c.el.offsetHeight })
  DESK.fit = (ms = 620) => {
    // a phone fits the hero alone, legible, and you pan to the cards (the whole desk at 18% is not)
    const phone = innerWidth < 700
    const rs = [{ x: -300, y: -150, w: 600, h: 300 }, ...(phone ? [] : ON_DESK.filter((id) => !DESK.cards[id].el.hidden).map((id) => rect(DESK.cards[id])))]
    const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y))
    const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h))
    const top = 80, bottom = phone ? 90 : 130
    const s = Math.min(1, (innerWidth - 48) / (x1 - x0), (innerHeight - top - bottom) / (y1 - y0))
    return DESK.flyTo((x0 + x1) / 2, (y0 + y1) / 2 - (top - bottom) / 2 / s, s, ms)
  }
  DESK.focusCard = (id) => {
    const c = DESK.cards[id]
    if (!c) return Promise.resolve()
    c.el.hidden = false
    raise(c)
    markDock()
    const r = rect(c), s = Math.min(1, (innerWidth - 48) / r.w, (innerHeight - 220) / r.h)
    return DESK.flyTo(r.x + r.w / 2, r.y + r.h / 2, s)
  }

  function raise(c) {
    for (const o of Object.values(DESK.cards)) o.el.classList.toggle('is-focused', o === c)
    c.el.style.zIndex = ++zTop
  }

  function buildCard(id, x, y, a) {
    const el = h('section', 'desk-card')
    el.dataset.card = id
    el.style.cssText = `--c:${a.colour};left:${x}px;top:${y}px;width:${a.width}px;transform:rotate(${a.rotate}deg)`
    el.setAttribute('aria-label', a.label)
    const head = h('header', 'desk-card__head', `<span class="desk-card__ico">${svg(a.icon)}</span><span class="desk-card__name">${esc(a.label)}</span>`)
    const x_ = h('button', 'desk-card__x')
    x_.type = 'button'
    x_.setAttribute('aria-label', 'Close')
    head.appendChild(x_)
    el.append(head, h('div', 'desk-card__body', BODIES[id]()))
    DESK.world.appendChild(el)
    const card = { el, x, y, w: a.width }
    DESK.cards[id] = card
    el.addEventListener('pointerdown', () => raise(card), true)
    x_.addEventListener('click', (e) => { e.stopPropagation(); el.hidden = true; markDock() })
    // drag by the title bar; deltas divide by scale or the card drifts from the cursor when zoomed
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return
      e.stopPropagation()
      head.setPointerCapture(e.pointerId)
      head.classList.add('is-dragging')
      let lx = e.clientX, ly = e.clientY
      const move = (ev) => {
        card.x += (ev.clientX - lx) / cam.s
        card.y += (ev.clientY - ly) / cam.s
        lx = ev.clientX; ly = ev.clientY
        el.style.left = card.x + 'px'
        el.style.top = card.y + 'px'
      }
      const up = () => { head.classList.remove('is-dragging'); head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up) }
      head.addEventListener('pointermove', move)
      head.addEventListener('pointerup', up)
      head.addEventListener('pointercancel', up)
    })
    return card
  }

  let dockItems = []
  const markDock = () => dockItems.forEach((b) => {
    const ids = b.dataset.items ? b.dataset.items.split(' ') : [b.dataset.id]
    b.dataset.open = ids.some((id) => DESK.cards[id] && !DESK.cards[id].el.hidden) ? 'true' : 'false'
  })
  // DIRECTION.md's dock click bounce, measured from yevtam
  const bounce = (b) => !reduced() && b.animate(
    [{ transform: 'scale(1) translateY(0)' }, { transform: 'scale(1.08) translateY(-2px)', offset: 0.32 }, { transform: 'scale(0.98) translateY(1px)', offset: 0.59 }, { transform: 'scale(1) translateY(0)' }],
    { duration: 440, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })

  function act(id) {
    if (id === 'lab') return opts.onLab ? opts.onLab() : DESK.flyTo(C.deepSpace.at.x, C.deepSpace.at.y, 0.9, 900)
    if (id === 'themes') return DESK.setTheme(document.documentElement.dataset.theme === 'jet' ? 'cream' : 'jet')
    if (DESK.cards[id]) return DESK.focusCard(id)
  }

  function buildDock() {
    const dock = h('nav', '', '')
    dock.id = 'deskDock'
    dock.setAttribute('aria-label', 'Dock')
    const panel = h('div', 'desk-dock__panel')
    const tip = h('div', 'desk-dock__tip')
    const folderPop = h('div', 'desk-folder')
    folderPop.hidden = true
    // dockLayout minus Archive, plus the Lab after the five loose tiles
    const nodes = C.dockLayout.map((n) => (n.kind === 'folder' ? { ...n, items: n.items.filter((i) => i !== 'archive') } : n))
    nodes.splice(5, 0, { kind: 'app', id: 'lab' })
    const showTip = (b, text) => {
      const r = b.getBoundingClientRect()
      tip.textContent = text
      tip.style.left = r.left + r.width / 2 + 'px'
      tip.style.top = r.top - 8 + 'px'
      tip.classList.add('on')
    }
    for (const n of nodes) {
      const a = n.kind === 'folder' ? n : n.id === 'lab' ? LAB_TILE : app(n.id)
      const b = h('button', 'desk-dock__item', `<span class="desk-dock__icon" style="--c:${a.colour}">${svg(a.icon)}</span>`)
      b.type = 'button'
      b.dataset.id = a.id
      b.setAttribute('aria-label', a.label)
      if (n.kind === 'folder') { b.dataset.folder = ''; b.dataset.items = n.items.join(' ') }
      b.addEventListener('pointerenter', () => showTip(b, a.label))
      b.addEventListener('focus', () => showTip(b, a.label))
      b.addEventListener('pointerleave', () => tip.classList.remove('on'))
      b.addEventListener('blur', () => tip.classList.remove('on'))
      b.addEventListener('click', () => {
        bounce(b)
        tip.classList.remove('on')
        if (n.kind !== 'folder') { folderPop.hidden = true; return act(a.id) }
        if (!folderPop.hidden && folderPop.dataset.for === a.id) { folderPop.hidden = true; return }
        folderPop.innerHTML = ''
        folderPop.dataset.for = a.id
        for (const id of n.items) {
          const it = app(id), row = h('button', '', `<i style="--c:${it.colour}"></i>${esc(it.label)}`)
          row.type = 'button'
          row.addEventListener('click', () => { folderPop.hidden = true; act(id) })
          folderPop.appendChild(row)
        }
        const r = b.getBoundingClientRect()
        folderPop.style.left = r.left + r.width / 2 + 'px'
        folderPop.style.top = r.top - 10 + 'px'
        folderPop.hidden = false
      })
      panel.appendChild(b)
      dockItems.push(b)
    }
    panel.appendChild(h('span', 'desk-dock__sep'))
    const gh = h('a', 'desk-dock__item', `<span class="desk-dock__icon" style="--c:#E8E6DE"><img src="${opts.publicRoot}/logos/github-original.svg" alt="" width="21" height="21"></span>`)
    const li = h('a', 'desk-dock__item', `<span class="desk-dock__icon" style="--c:#E8E6DE">${svg('linkedin')}</span>`)
    for (const [el, label] of [[gh, 'GitHub'], [li, 'LinkedIn']]) {
      const l = C.profile.links.find((x) => x.label === label)
      el.href = l ? l.href : '#'
      el.setAttribute('aria-label', label)
      el.addEventListener('pointerenter', () => showTip(el, label))
      el.addEventListener('pointerleave', () => tip.classList.remove('on'))
      panel.appendChild(el)
    }
    dock.appendChild(panel)
    document.body.append(dock, tip, folderPop)
    addEventListener('pointerdown', (e) => { if (!e.target.closest('.desk-folder, .desk-dock__item')) folderPop.hidden = true })
    DESK.dock = dock
  }

  function buildChrome() {
    const pill = h('div', 'desk-pill')
    const fit = h('button', '', 'Fit all')
    const theme = h('button', '', '')
    const site = h('a', '', esc(C.site || 'The site'))
    fit.type = theme.type = 'button'
    site.href = '/'
    fit.addEventListener('click', () => DESK.fit())
    theme.addEventListener('click', () => act('themes'))
    theme.setAttribute('aria-label', 'Theme')
    pill.append(fit, h('span', 'div'), theme, site)
    DESK.themeBtn = theme
    DESK.setTheme(document.documentElement.dataset.theme)
    const zoom = h('div', 'desk-zoom', '<button type="button" aria-label="Zoom out">−</button><span>100%</span><button type="button" aria-label="Zoom in">+</button>')
    const [out, , inn] = zoom.children
    out.addEventListener('click', () => { stop(); zoomAt(innerWidth / 2, innerHeight / 2, cam.s / 1.25) })
    inn.addEventListener('click', () => { stop(); zoomAt(innerWidth / 2, innerHeight / 2, cam.s * 1.25) })
    DESK.zoomTag = zoom.children[1]
    document.body.append(pill, zoom)
  }

  function bindInput(vp) {
    let panId = null, last = null, vel = { x: 0, y: 0 }
    const touches = new Map()
    let pinch = 0
    const twoDist = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }
    vp.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') { touches.set(e.pointerId, e); if (touches.size === 2) { pinch = twoDist(); panId = null } }
      if (e.button !== 0 || e.target.closest('.desk-card, button, a, textarea') || touches.size > 1) return
      stop()
      panId = e.pointerId
      vp.setPointerCapture(panId)
      vp.classList.add('is-panning')
      last = { x: e.clientX, y: e.clientY, t: performance.now() }
      vel = { x: 0, y: 0 }
    })
    vp.addEventListener('pointermove', (e) => {
      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, e)
        if (touches.size === 2) {
          const d = twoDist(), [a, b] = [...touches.values()]
          if (pinch > 0) zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, cam.s * (d / pinch))
          pinch = d
          return
        }
      }
      if (e.pointerId !== panId) return
      const now = performance.now(), dx = e.clientX - last.x, dy = e.clientY - last.y, dt = Math.max(1, now - last.t)
      cam.x += dx; cam.y += dy
      vel = { x: vel.x * 0.7 + (dx / dt) * 0.3, y: vel.y * 0.7 + (dy / dt) * 0.3 }
      last = { x: e.clientX, y: e.clientY, t: now }
      dirty = true
    })
    const end = (e) => {
      touches.delete(e.pointerId)
      if (touches.size < 2) pinch = 0
      if (e.pointerId !== panId) return
      panId = null
      vp.classList.remove('is-panning')
      if (Math.hypot(vel.x, vel.y) > 0.12 && !reduced()) {
        let vx = vel.x * 16, vy = vel.y * 16
        const step = () => {
          vx *= 0.94; vy *= 0.94
          cam.x += vx; cam.y += vy; dirty = true
          if (Math.hypot(vx, vy) > 0.12) glideRAF = requestAnimationFrame(step)
        }
        glideRAF = requestAnimationFrame(step)
      }
    }
    vp.addEventListener('pointerup', end)
    vp.addEventListener('pointercancel', end)
    // trackpad two-finger scroll pans; ctrl/⌘ + wheel (and trackpad pinch) zooms about the cursor
    vp.addEventListener('wheel', (e) => {
      e.preventDefault()
      stop()
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, cam.s * Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * 0.0035))
      else { cam.x -= e.deltaX; cam.y -= e.deltaY; dirty = true }
    }, { passive: false })
    addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return
      if (e.key === '0') DESK.fit()
      else if (e.key === '+' || e.key === '=') zoomAt(innerWidth / 2, innerHeight / 2, cam.s * 1.25)
      else if (e.key === '-') zoomAt(innerWidth / 2, innerHeight / 2, cam.s / 1.25)
    })
  }

  DESK.mount = (o = {}) => {
    opts = { publicRoot: '../../../public', ...o }
    const root = document.documentElement
    root.classList.add('desk')
    DESK.setTheme(o.theme || root.dataset.theme || 'cream')
    const vp = h('div'), backdrop = h('div'), world = h('div'), grid = h('div')
    vp.id = 'deskViewport'; backdrop.id = 'deskBackdrop'; world.id = 'deskWorld'; grid.id = 'deskGrid'
    world.appendChild(grid)
    vp.append(backdrop, world)
    document.body.prepend(vp)
    Object.assign(DESK, { viewport: vp, backdrop, world, grid })

    const p = C.profile
    const hero = h('div', 'desk-hero', `<div class="desk-hero__avatar">${esc(p.initials)}</div><h1>${esc(p.name)}</h1>` +
      `<p class="desk-hero__role">${esc(p.role.prefix)} <b>${esc(p.role.emphasis)}</b></p><div class="desk-hero__meta">${esc(p.location)}</div>`)
    hero.style.cssText = 'left:-300px;top:-130px'
    world.appendChild(hero)
    for (const id of ON_DESK) buildCard(id, SPOTS[id][0], SPOTS[id][1], app(id))
    // the deep-space card, as components/apps/build-cards.tsx pins it: at eggs.ts's world point,
    // label '?', never part of Fit
    buildCard('deep-space', C.deepSpace.at.x, C.deepSpace.at.y, { label: '?', icon: 'external', colour: '#FFC2E2', width: 420, rotate: -0.6 })

    buildDock()
    buildChrome()
    bindInput(vp)
    markDock()
    ;(function frame() {
      if (dirty) {
        dirty = false
        world.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.s})`
        DESK.zoomTag.textContent = Math.round(cam.s * 100) + '%'
        const v = view()
        for (const fn of frameFns) fn(cam, v)
      }
      requestAnimationFrame(frame)
    })()
    DESK.fit(0)
    return DESK
  }
})()
