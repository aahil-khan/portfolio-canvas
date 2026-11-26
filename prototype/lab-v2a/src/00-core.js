/* eslint-disable @typescript-eslint/no-unused-vars -- src/*.js are concatenated into one scope by build.mjs, so names are used across files */
/* Core: the data, small DOM helpers, storage, and the two single owners the site insists on:
   reduced motion (here) and sound (10-audio.js). Plain script; build.mjs concatenates src/NN-*.js
   in order inside one function scope, because file:// can't load modules. */

const DATA = JSON.parse(document.getElementById('lab-data').textContent)
const UI = DATA.ui
const ITEMS = DATA.items

const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const pad2 = (n) => String(n).padStart(2, '0')

/** localStorage that never throws (private windows, blocked storage, file:// quirks). */
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* storage unavailable: keep going */ } },
}

/* ---- reduced motion: the one owner ---- */
const motion = (() => {
  const mq = matchMedia('(prefers-reduced-motion: reduce)')
  const apply = () => document.documentElement.classList.toggle('rm', mq.matches)
  apply()
  mq.addEventListener('change', apply)
  return {
    get reduced() { return mq.matches },
    /** WAAPI with the site's easing; under reduced motion only opacity survives. */
    animate(el, frames, ms = 320) {
      if (!el.animate) return null
      const fr = mq.matches ? frames.map((f) => ('opacity' in f ? { opacity: f.opacity } : {})) : frames
      if (mq.matches && !fr.some((f) => 'opacity' in f)) return null
      return el.animate(fr, { duration: ms, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
    },
  }
})()

const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
const phone = matchMedia('(max-width: 600px)')

/* ---- items ---- */
const item = (k) => ITEMS[k]
const kindWord = (it) => UI.kinds[it.kind] || it.kind
const numLabel = (it) => it.id || (it.number != null ? pad2(it.number) : '')
const dateTag = (iso, label) => `<time datetime="${esc(iso)}">${esc(label)}</time>`

/** Parse the hash: #/lab/a/b?theme=x → { path: '/lab/a/b', query: {theme:'x'} } */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/lab'
  const [p, q = ''] = raw.split('?')
  const query = Object.fromEntries(q.split('&').filter(Boolean).map((kv) => kv.split('=').map(decodeURIComponent)))
  return { path: p.replace(/\/+$/, '') || '/lab', query }
}
const byPath = (p) => Object.values(ITEMS).find((it) => it.path === p)

/** Events other modules listen to: 'route', 'theme'. */
const bus = new EventTarget()
const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }))
const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail))
